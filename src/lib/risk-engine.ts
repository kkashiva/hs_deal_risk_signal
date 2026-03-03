// ============================================================
// Risk Engine — Orchestration Pipeline
// ============================================================

import {
    HubSpotDeal,
    RiskInput,
    RiskAnalysisResult,
    ScanResult,
} from './types';
import { getConfig } from './config';
import {
    fetchOpenDeals,
    fetchDeal,
    fetchDealEngagements,
    computeActivityMetrics,
    updateDealRiskFields,
    createTaskForHighRisk,
    isDealOpen,
    PIPELINE_MAP
} from './hubspot';
import { getTranscriptsFromCallIds, isGongConfigured, extractGongCallIds } from './gong';
import { analyzeDealRisk } from './ai-analyzer';
import { sendHighRiskAlert, sendScanSummary, isSlackConfigured } from './slack';
import { insertRiskEvaluation, insertScanRun } from '@/db/queries';

const BATCH_SIZE = 5;

// --- Build Risk Input for a Deal ---

async function buildRiskInput(deal: HubSpotDeal): Promise<RiskInput> {
    const props = deal.properties;
    const now = Date.now();

    // Fetch engagements
    const engagements = await fetchDealEngagements(deal.id);
    const activityMetrics = computeActivityMetrics(engagements);

    // Compute stage duration
    const createDate = new Date(props.createdate).getTime();
    const daysSinceCreation = Math.round((now - createDate) / (1000 * 60 * 60 * 24));

    // Days in current stage
    const hsDaysInStage = props.hs_v2_time_in_current_stage
        ? Math.round((now - new Date(props.hs_v2_time_in_current_stage).getTime()) / (1000 * 60 * 60 * 24))
        : null;

    // Calculate close date drift
    let closeDateDrift: number | null = null;
    if (props.closedate) {
        const closeDate = new Date(props.closedate).getTime();
        if (closeDate < now) {
            closeDateDrift = Math.round((now - closeDate) / (1000 * 60 * 60 * 24));
        }
    }

    // Extract Gong call IDs from note engagements (Gong syncs notes to HubSpot)
    let transcriptSummary: string | null = null;
    if (isGongConfigured()) {
        try {
            const gongCallIds: string[] = [];
            for (const eng of engagements) {
                if (eng.type === 'NOTE' && eng.body) {
                    const ids = extractGongCallIds(eng.body);
                    gongCallIds.push(...ids);
                }
            }

            if (gongCallIds.length > 0) {
                // De-duplicate and take most recent (notes are already sorted by timestamp desc)
                const uniqueIds = [...new Set(gongCallIds)];
                console.log(`Found ${uniqueIds.length} Gong call ID(s) in HubSpot notes for deal ${deal.id}`);
                transcriptSummary = await getTranscriptsFromCallIds(uniqueIds);
            } else {
                console.log(`No Gong call IDs found in notes for deal ${deal.id}`);
            }
        } catch (error) {
            console.error(`Gong error for deal ${deal.id}:`, error);
        }
    }

    // Format recent engagements for the prompt
    // Emails get their own dedicated pool (up to 5, 500-char truncation)
    // so they can't be crowded out by notes/calls
    const recentEmails = engagements
        .filter(e => e.type === 'EMAIL')
        .slice(0, 5)
        .map(e => ({
            type: e.type,
            date: new Date(e.timestamp).toISOString().split('T')[0],
            summary: (e.subject || e.body || '').substring(0, 500),
        }));

    const recentOtherEngagements = engagements
        .filter(e => e.type !== 'EMAIL')
        .slice(0, 5)
        .map(e => ({
            type: e.type,
            date: new Date(e.timestamp).toISOString().split('T')[0],
            summary: (e.subject || e.body || '').substring(0, 200),
        }));

    const recentEngagements = [...recentEmails, ...recentOtherEngagements]
        .sort((a, b) => b.date.localeCompare(a.date));

    return {
        deal_metadata: {
            deal_id: deal.id,
            deal_name: props.dealname,
            amount: props.hs_mrr ? parseFloat(props.hs_mrr) : (props.amount ? parseFloat(props.amount) : null),
            mrr: props.hs_mrr ? parseFloat(props.hs_mrr) : (props.mrr ? parseFloat(props.mrr) : null),
            stage: props.deal_stage_name__text_ || props.dealstage,
            pipeline: props.pipeline ? (PIPELINE_MAP[props.pipeline] || props.pipeline) : null,
            days_in_stage: hsDaysInStage,
            days_since_creation: daysSinceCreation,
            close_date: props.closedate,
            close_date_drift_days: closeDateDrift,
            forecast_category: props.hs_manual_forecast_category || props.hs_forecast_category,
            owner_id: props.hubspot_owner_id,
            num_contacts: parseInt(props.num_associated_contacts || '0'),
        },
        engagement_metrics: activityMetrics,
        recent_engagements: recentEngagements,
        transcript_summary: transcriptSummary,
    };
}

// --- Process a Single Deal ---

async function processDeal(
    deal: HubSpotDeal,
    isOpen: boolean = true
): Promise<{ success: boolean; riskLevel?: string }> {
    try {
        console.log(`Processing deal: ${deal.properties.dealname} (${deal.id})`);

        // Build risk input
        const riskInput = await buildRiskInput(deal);

        // Analyze with AI
        const { result, provider, promptVersion } = await analyzeDealRisk(riskInput);

        // Write back to HubSpot
        await updateDealRiskFields(deal.id, result);

        // Store in database
        try {
            await insertRiskEvaluation({
                deal_id: deal.id,
                deal_name: deal.properties.dealname,
                deal_amount: riskInput.deal_metadata.mrr,
                pipeline: deal.properties.pipeline || null,
                risk_level: result.risk_level,
                risk_reason: result.primary_risk_reason,
                explanation: result.explanation,
                recommended_action: result.recommended_action,
                confidence: result.confidence_score,
                escalation_target: result.escalation_target,
                model_used: provider,
                prompt_version: promptVersion,
                was_lost_later: false,
                is_deal_open: isOpen,
                deal_metadata: riskInput.deal_metadata as unknown as Record<string, unknown>,
                engagement_metrics: riskInput.engagement_metrics,
            });
        } catch (dbError) {
            console.error(`DB error for deal ${deal.id}:`, dbError);
            // Non-fatal: the HubSpot update already succeeded
        }

        // Send Slack alert for HIGH risk deals
        if (
            result.risk_level === 'HIGH' &&
            result.confidence_score >= 70 &&
            isSlackConfigured()
        ) {
            const config = getConfig();
            const amount = deal.properties.amount ? parseFloat(deal.properties.amount) : 0;

            if (amount >= config.highRiskDealValueThreshold || result.escalation_target === 'exec') {
                await sendHighRiskAlert(
                    {
                        id: deal.id,
                        name: deal.properties.dealname,
                        amount: amount || null,
                        stage: deal.properties.dealstage,
                        owner: deal.properties.hubspot_owner_id,
                    },
                    result
                );

                // Create HubSpot task for HIGH risk deals
                await createTaskForHighRisk(
                    deal.id,
                    deal.properties.hubspot_owner_id,
                    `🚨 AI Risk Alert: ${result.explanation}\n\nRecommended: ${result.recommended_action}`
                );
            }
        }

        console.log(
            `✅ Deal "${deal.properties.dealname}": ${result.risk_level} risk ` +
            `(${result.primary_risk_reason}, ${result.confidence_score}% confidence)`
        );

        return { success: true, riskLevel: result.risk_level };
    } catch (error) {
        console.error(`❌ Error processing deal ${deal.id}:`, error);
        return { success: false };
    }
}

// --- Run Full Risk Scan ---

export async function runRiskScan(
    singleDealId?: string,
    pipelineId?: string
): Promise<ScanResult> {
    const startTime = Date.now();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Risk scan started at ${new Date().toISOString()}`);
    if (pipelineId) console.log(`Target Pipeline: ${pipelineId}`);
    console.log(`${'='.repeat(60)}\n`);

    let deals: HubSpotDeal[];
    let isSingleDealMode = false;

    if (singleDealId) {
        // Single deal mode (for testing) — scan even if closed
        isSingleDealMode = true;
        const deal = await fetchDeal(singleDealId);
        deals = deal ? [deal] : [];
        if (!deal) {
            console.log(`Deal ${singleDealId} not found`);
        }
    } else {
        // Full scan mode (with optional pipeline filter)
        const allDeals = await fetchOpenDeals(pipelineId ? [pipelineId] : undefined);

        // Filter out closed deals (hs_is_open_count !== '1') to conserve AI credits
        const openDeals = allDeals.filter(d => isDealOpen(d));
        const skippedCount = allDeals.length - openDeals.length;
        if (skippedCount > 0) {
            console.log(`Skipped ${skippedCount} closed deal(s) (hs_is_open_count ≠ 1)`);
        }
        deals = openDeals;
    }

    console.log(`Found ${deals.length} deals to analyze\n`);

    let analyzed = 0;
    let highRisk = 0;
    let mediumRisk = 0;
    let lowRisk = 0;
    let errors = 0;

    // Process in batches
    for (let i = 0; i < deals.length; i += BATCH_SIZE) {
        const batch = deals.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
            batch.map(deal => {
                const isOpen = isDealOpen(deal);
                return processDeal(deal, isOpen);
            })
        );

        for (const r of results) {
            if (r.success) {
                analyzed++;
                if (r.riskLevel === 'HIGH') highRisk++;
                if (r.riskLevel === 'MEDIUM') mediumRisk++;
                if (r.riskLevel === 'LOW') lowRisk++;
            } else {
                errors++;
            }
        }

        // Small delay between batches to respect rate limits
        if (i + BATCH_SIZE < deals.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    const durationMs = Date.now() - startTime;

    const result: ScanResult = {
        total: deals.length,
        analyzed,
        highRisk,
        mediumRisk,
        lowRisk,
        errors,
        duration_ms: durationMs,
    };

    // Log scan run to database
    try {
        await insertScanRun({
            started_at: new Date(startTime),
            completed_at: new Date(),
            total_deals: deals.length,
            high_risk_count: highRisk,
            errors,
            summary: result as unknown as Record<string, unknown>,
        });
    } catch (dbError) {
        console.error('Failed to log scan run:', dbError);
    }

    // Send Slack summary
    if (isSlackConfigured() && !singleDealId) {
        try {
            await sendScanSummary(deals.length, highRisk, mediumRisk, errors, durationMs);
        } catch (slackError) {
            console.error('Failed to send scan summary:', slackError);
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Risk scan completed in ${(durationMs / 1000).toFixed(1)}s`);
    console.log(`Results: ${analyzed} analyzed, ${highRisk} HIGH, ${mediumRisk} MEDIUM, ${lowRisk} LOW, ${errors} errors`);
    console.log(`${'='.repeat(60)}\n`);

    return result;
}
