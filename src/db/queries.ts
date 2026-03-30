// ============================================================
// Database Queries — Raw SQL
// ============================================================

import { query } from './client';
import { RiskEvaluation, ScanRun, RiskCounts } from '@/lib/types';

// Subquery that identifies deal_ids whose most recent evaluation is closed.
// Used to fully exclude lost deals from all dashboard queries.
const CLOSED_DEAL_IDS_SUBQUERY = `
  SELECT deal_id FROM (
    SELECT DISTINCT ON (deal_id) deal_id, is_deal_open
    FROM risk_evaluations
    ORDER BY deal_id, evaluation_date DESC
  ) latest_status
  WHERE is_deal_open = FALSE
`;

// --- Risk Evaluations ---

export async function insertRiskEvaluation(
    evaluation: Omit<RiskEvaluation, 'id' | 'evaluation_date' | 'created_at'>
): Promise<RiskEvaluation> {
    const rows = await query<RiskEvaluation>(
        `INSERT INTO risk_evaluations (
      deal_id, deal_name, deal_amount, pipeline, owner_name, risk_level, risk_reason,
      explanation, recommended_action, confidence, escalation_target,
      model_used, prompt_version, was_lost_later, is_deal_open,
      deal_metadata, engagement_metrics,
      deal_analysis, email_analysis, transcript_analysis, risk_type_change_date
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
    RETURNING *`,
        [
            evaluation.deal_id,
            evaluation.deal_name,
            evaluation.deal_amount,
            evaluation.pipeline,
            evaluation.owner_name || null,
            evaluation.risk_level,
            evaluation.risk_reason,
            evaluation.explanation,
            evaluation.recommended_action,
            evaluation.confidence,
            evaluation.escalation_target,
            evaluation.model_used,
            evaluation.prompt_version,
            evaluation.was_lost_later,
            evaluation.is_deal_open ?? true,
            evaluation.deal_metadata ? JSON.stringify(evaluation.deal_metadata) : null,
            evaluation.engagement_metrics ? JSON.stringify(evaluation.engagement_metrics) : null,
            evaluation.deal_analysis || null,
            evaluation.email_analysis || null,
            evaluation.transcript_analysis || null,
            evaluation.risk_type_change_date || null,
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

export async function getPreviousEvaluation(dealId: string): Promise<RiskEvaluation | null> {
    const rows = await query<RiskEvaluation>(
        `SELECT * FROM risk_evaluations
     WHERE deal_id = $1
     ORDER BY evaluation_date DESC
     LIMIT 1`,
        [dealId]
    );
    return rows.length > 0 ? rows[0] : null;
}

export async function getLatestEvaluations(filters?: {
    riskLevel?: string;
    limit?: number;
    offset?: number;
}): Promise<RiskEvaluation[]> {
    let sql = `
    SELECT DISTINCT ON (deal_id) *
    FROM risk_evaluations
    WHERE is_deal_open = TRUE
      AND deal_id NOT IN (${CLOSED_DEAL_IDS_SUBQUERY})
  `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.riskLevel) {
        sql += ` AND risk_level = $${paramIndex++}`;
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

export async function getRiskCounts(): Promise<RiskCounts> {
    const rows = await query<{ risk_level: string; pipeline: string; count: string }>(
        `SELECT risk_level, pipeline, COUNT(DISTINCT deal_id)::text as count
     FROM (
       SELECT DISTINCT ON (deal_id) deal_id, risk_level, pipeline
       FROM risk_evaluations
       WHERE is_deal_open = TRUE
         AND deal_id NOT IN (${CLOSED_DEAL_IDS_SUBQUERY})
       ORDER BY deal_id, evaluation_date DESC
     ) latest
     GROUP BY risk_level, pipeline`
    );

    const counts: RiskCounts = {
        total: 0,
        high: 0,
        medium: 0,
        low: 0,
        pipelineBreakdown: {
            total: {},
            high: {},
            medium: {},
            low: {},
        },
    };

    for (const row of rows) {
        const c = parseInt(row.count);
        const level = row.risk_level.toLowerCase() as 'high' | 'medium' | 'low';
        const pipeline = row.pipeline || 'unknown';

        counts.total += c;
        if (level === 'high') counts.high += c;
        else if (level === 'medium') counts.medium += c;
        else if (level === 'low') counts.low += c;

        // Pipeline breakdowns
        counts.pipelineBreakdown.total[pipeline] = (counts.pipelineBreakdown.total[pipeline] || 0) + c;
        counts.pipelineBreakdown[level][pipeline] = (counts.pipelineBreakdown[level][pipeline] || 0) + c;
    }
    return counts;
}

export async function getDistinctPipelines(): Promise<string[]> {
    const rows = await query<{ pipeline: string }>(
        `SELECT DISTINCT pipeline FROM risk_evaluations WHERE pipeline IS NOT NULL AND is_deal_open = TRUE AND deal_id NOT IN (${CLOSED_DEAL_IDS_SUBQUERY}) ORDER BY pipeline`
    );
    return rows.map(r => r.pipeline);
}

export async function getDistinctRiskReasons(): Promise<string[]> {
    const rows = await query<{ risk_reason: string }>(
        `SELECT DISTINCT risk_reason FROM risk_evaluations WHERE risk_reason IS NOT NULL AND is_deal_open = TRUE AND deal_id NOT IN (${CLOSED_DEAL_IDS_SUBQUERY}) ORDER BY risk_reason`
    );
    return rows.map(r => r.risk_reason);
}

export async function getDistinctStages(): Promise<string[]> {
    const rows = await query<{ stage: string }>(
        `SELECT DISTINCT deal_metadata->>'stage' as stage 
     FROM risk_evaluations 
     WHERE deal_metadata->>'stage' IS NOT NULL AND is_deal_open = TRUE AND deal_id NOT IN (${CLOSED_DEAL_IDS_SUBQUERY})
     ORDER BY stage`
    );
    return rows.map(r => r.stage);
}

export async function getDistinctOwners(): Promise<string[]> {
    const rows = await query<{ owner_name: string }>(
        `SELECT DISTINCT owner_name FROM risk_evaluations WHERE owner_name IS NOT NULL AND is_deal_open = TRUE AND deal_id NOT IN (${CLOSED_DEAL_IDS_SUBQUERY}) ORDER BY owner_name`
    );
    return rows.map(r => r.owner_name);
}

// --- Lost Deals ---

export async function getLostDealEvaluations(): Promise<RiskEvaluation[]> {
    return query<RiskEvaluation>(`
        SELECT * FROM (
            SELECT DISTINCT ON (deal_id) *
            FROM risk_evaluations
            ORDER BY deal_id, evaluation_date DESC
        ) latest
        WHERE is_deal_open = FALSE
          AND LOWER(deal_metadata->>'stage') LIKE '%closed lost%'
        ORDER BY evaluation_date DESC
    `);
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
