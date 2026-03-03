// ============================================================
// Database Queries — Raw SQL
// ============================================================

import { query } from './client';
import { RiskEvaluation, ScanRun } from '@/lib/types';

// --- Risk Evaluations ---

export async function insertRiskEvaluation(
    evaluation: Omit<RiskEvaluation, 'id' | 'evaluation_date' | 'created_at'>
): Promise<RiskEvaluation> {
    const rows = await query<RiskEvaluation>(
        `INSERT INTO risk_evaluations (
      deal_id, deal_name, deal_amount, pipeline, risk_level, risk_reason,
      explanation, recommended_action, confidence, escalation_target,
      model_used, prompt_version, was_lost_later, deal_metadata, engagement_metrics
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *`,
        [
            evaluation.deal_id,
            evaluation.deal_name,
            evaluation.deal_amount,
            evaluation.pipeline,
            evaluation.risk_level,
            evaluation.risk_reason,
            evaluation.explanation,
            evaluation.recommended_action,
            evaluation.confidence,
            evaluation.escalation_target,
            evaluation.model_used,
            evaluation.prompt_version,
            evaluation.was_lost_later,
            evaluation.deal_metadata ? JSON.stringify(evaluation.deal_metadata) : null,
            evaluation.engagement_metrics ? JSON.stringify(evaluation.engagement_metrics) : null,
        ]
    );
    return rows[0];
}

export async function getEvaluationsForDeal(dealId: string): Promise<RiskEvaluation[]> {
    return query<RiskEvaluation>(
        `SELECT * FROM risk_evaluations
     WHERE deal_id = $1
     ORDER BY evaluation_date DESC`,
        [dealId]
    );
}

export async function getLatestEvaluations(filters?: {
    riskLevel?: string;
    limit?: number;
    offset?: number;
}): Promise<RiskEvaluation[]> {
    let sql = `
    SELECT DISTINCT ON (deal_id) *
    FROM risk_evaluations
  `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.riskLevel) {
        sql += ` WHERE risk_level = $${paramIndex++}`;
        params.push(filters.riskLevel);
    }

    sql += ` ORDER BY deal_id, evaluation_date DESC`;

    // Wrap in a subquery to apply additional ordering and pagination
    sql = `
    SELECT * FROM (${sql}) AS latest
    ORDER BY
      CASE risk_level
        WHEN 'HIGH' THEN 1
        WHEN 'MEDIUM' THEN 2
        WHEN 'LOW' THEN 3
      END,
      confidence DESC
  `;

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    return query<RiskEvaluation>(sql, params);
}

export async function getRiskCounts(): Promise<{
    total: number;
    high: number;
    medium: number;
    low: number;
}> {
    const rows = await query<{ risk_level: string; count: string }>(
        `SELECT risk_level, COUNT(DISTINCT deal_id)::text as count
     FROM (
       SELECT DISTINCT ON (deal_id) deal_id, risk_level
       FROM risk_evaluations
       ORDER BY deal_id, evaluation_date DESC
     ) latest
     GROUP BY risk_level`
    );

    const counts = { total: 0, high: 0, medium: 0, low: 0 };
    for (const row of rows) {
        const c = parseInt(row.count);
        counts.total += c;
        if (row.risk_level === 'HIGH') counts.high = c;
        if (row.risk_level === 'MEDIUM') counts.medium = c;
        if (row.risk_level === 'LOW') counts.low = c;
    }
    return counts;
}

export async function getDistinctPipelines(): Promise<string[]> {
    const rows = await query<{ pipeline: string }>(
        `SELECT DISTINCT pipeline FROM risk_evaluations WHERE pipeline IS NOT NULL ORDER BY pipeline`
    );
    return rows.map(r => r.pipeline);
}

export async function getDistinctRiskReasons(): Promise<string[]> {
    const rows = await query<{ risk_reason: string }>(
        `SELECT DISTINCT risk_reason FROM risk_evaluations WHERE risk_reason IS NOT NULL ORDER BY risk_reason`
    );
    return rows.map(r => r.risk_reason);
}

export async function getDistinctStages(): Promise<string[]> {
    const rows = await query<{ stage: string }>(
        `SELECT DISTINCT deal_metadata->>'stage' as stage 
     FROM risk_evaluations 
     WHERE deal_metadata->>'stage' IS NOT NULL 
     ORDER BY stage`
    );
    return rows.map(r => r.stage);
}

export async function markDealAsLost(dealId: string): Promise<void> {
    await query(
        `UPDATE risk_evaluations SET was_lost_later = true WHERE deal_id = $1`,
        [dealId]
    );
}

// --- Scan Runs ---

export async function insertScanRun(
    run: Omit<ScanRun, 'id'>
): Promise<ScanRun> {
    const rows = await query<ScanRun>(
        `INSERT INTO scan_runs (started_at, completed_at, total_deals, high_risk_count, errors, summary)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
        [
            run.started_at,
            run.completed_at || null,
            run.total_deals,
            run.high_risk_count,
            run.errors,
            run.summary ? JSON.stringify(run.summary) : null,
        ]
    );
    return rows[0];
}

export async function getRecentScanRuns(limit = 20): Promise<ScanRun[]> {
    return query<ScanRun>(
        `SELECT * FROM scan_runs ORDER BY started_at DESC LIMIT $1`,
        [limit]
    );
}
