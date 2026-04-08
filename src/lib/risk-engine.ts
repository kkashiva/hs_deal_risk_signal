// ============================================================
// Risk Engine — Orchestration Pipeline
// ============================================================

import {
    HubSpotDeal,
    HubSpotEngagement,
    RiskInput,
    RiskAnalysisResult,
    ScanResult,
    EngagementDiscoveredContact,
} from './types';
import { getConfig } from './config';
import {
    fetchOpenDeals,
    fetchDeal,
    fetchDealEngagements,
    fetchDealContacts,
    computeActivityMetrics,
    updateDealRiskFields,
    createTaskForHighRisk,
    isDealOpen,
    fetchOwners,
    fetchMeetingAttendeeContactIds,
    batchFetchContacts,
    batchSearchContactsByEmail,
} from './hubspot';
import { PIPELINE_MAP, getNormalizedStage } from './mappings';
import { getTranscriptsFromCallIds, isGongConfigured, extractGongCallIds } from './gong';
import { analyzeDealRisk } from './ai-analyzer';
import { sendHighRiskAlert, sendScanSummary, isSlackConfigured } from './slack';
import { insertRiskEvaluation, insertScanRun, updateScanRun, getPreviousEvaluation } from '../db/queries';

const BATCH_SIZE = 5;

// --- Engagement-Discovered Contacts ---

function parseEmailList(semicolonSeparated: string | undefined): string[] {
    if (!semicolonSeparated) return [];
    return semicolonSeparated
        .split(';')
        .map(e => e.trim().toLowerCase())
        .filter(e => e.length > 0 && e.includes('@'));
}

async function extractEngagementDiscoveredContacts(
    engagements: HubSpotEngagement[],
    associatedContactIds: Set<string>,
    associatedContactEmails: Set<string>,
): Promise<EngagementDiscoveredContact[]> {
    try {
        // Step 1: Collect unique emails from email To/CC/From fields
        const emailAddresses = new Set<string>();
        for (const eng of engagements) {
            if (eng.type === 'EMAIL') {
                for (const addr of [
                    ...parseEmailList(eng.emailTo),
                    ...parseEmailList(eng.emailCc),
                    ...parseEmailList(eng.emailFrom),
                ]) {
                    if (!associatedContactEmails.has(addr)) {
                        emailAddresses.add(addr);
                    }
                }
            }
        }

        // Step 2: Collect contact IDs from meeting attendees
        const meetingIds = engagements
            .filter(e => e.type === 'MEETING')
            .map(e => e.id);
        const meetingAttendeeIds = await fetchMeetingAttendeeContactIds(meetingIds);

        // Filter out contacts already associated with the deal
        const newMeetingContactIds = [...meetingAttendeeIds].filter(id => !associatedContactIds.has(id));

        // Step 3: Resolve emails and meeting contacts in parallel
        const [emailContactsMap, meetingContacts] = await Promise.all([
            batchSearchContactsByEmail([...emailAddresses]),
            batchFetchContacts(newMeetingContactIds),
        ]);

        // Step 4: Build deduplicated discovered contacts list
        const discovered = new Map<string, EngagementDiscoveredContact>();

        // Email-discovered contacts
        for (const addr of emailAddresses) {
            const resolved = emailContactsMap.get(addr);
            discovered.set(addr, {
                email: addr,
                job_title: resolved?.jobtitle || null,
                persona_group: resolved?.persona_group || null,
                persona_seniority: resolved?.persona_seniority || null,
                source: 'email',
            });
        }

        // Meeting-discovered contacts (deduplicate against email-discovered)
        for (const contact of meetingContacts) {
            const email = contact.email;
            if (email && !associatedContactEmails.has(email) && !discovered.has(email)) {
                discovered.set(email, {
                    email,
                    job_title: contact.jobtitle || null,
                    persona_group: contact.persona_group || null,
                    persona_seniority: contact.persona_seniority || null,
                    source: 'meeting',
                });
            }
        }

        return [...discovered.values()];
    } catch (error) {
        console.error('Failed to extract engagement-discovered contacts:', error);
        return [];
    }
}

// --- Build Risk Input for a Deal ---

async function buildRiskInput(deal: HubSpotDeal): Promise<RiskInput> {
    const props = deal.properties;
    const now = Date.now();

    // Fetch engagements and contacts in parallel
    const [engagements, contacts] = await Promise.all([
        fetchDealEngagements(deal.id),
        fetchDealContacts(deal.id),
    ]);
    const activityMetrics = computeActivityMetrics(engagements);

    // Extract contacts discovered from email threads and meeting attendees
    const associatedContactIds = new Set(contacts.map(c => c.id));
    const associatedContactEmails = new Set(
        contacts.map(c => c.email?.toLowerCase()).filter((e): e is string => !!e)
    );
    const engagementDiscoveredContacts = await extractEngagementDiscoveredContacts(
        engagements, associatedContactIds, associatedContactEmails,
    );
    if (engagementDiscoveredContacts.length > 0) {
        console.log(`  Found ${engagementDiscoveredContacts.length} engagement-discovered contact(s) for deal ${deal.id}`);
    }

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
            closeDateDrift = Math.max(0, Math.round((now - closeDate) / (1000 * 60 * 60 * 24)));
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
        .slice(0, 10)
        .map(e => ({
            type: e.type,
            date: new Date(e.timestamp).toISOString().split('T')[0],
            summary: `Subject: ${e.subject || 'N/A'}\nContent: ${e.body || 'N/A'}`.substring(0, 3000),
        }));

    const recentOtherEngagements = engagements
        .filter(e => e.type !== 'EMAIL')
        .slice(0, 5)
        .map(e => ({
            type: e.type,
            date: new Date(e.timestamp).toISOString().split('T')[0],
            summary: `Subject: ${e.subject || 'N/A'}\nContent: ${e.body || 'N/A'}`.substring(0, 500),
        }));

    const recentEngagements = [...recentEmails, ...recentOtherEngagements]
        .sort((a, b) => b.date.localeCompare(a.date));

    return {
        deal_metadata: {
            deal_id: deal.id,
            deal_name: props.dealname,
            amount: props.hs_mrr ? parseFloat(props.hs_mrr) : (props.amount ? parseFloat(props.amount) : null),
            mrr: props.hs_mrr ? parseFloat(props.hs_mrr) : (props.mrr ? parseFloat(props.mrr) : null),
            stage: getNormalizedStage(props.deal_stage_name__text_ || props.dealstage, props.pipeline || null),
            pipeline: props.pipeline || null,
            days_in_stage: hsDaysInStage,
            days_since_creation: daysSinceCreation,
            close_date: props.closedate,
            close_date_drift_days: closeDateDrift,
            forecast_category: props.hs_manual_forecast_category || props.hs_forecast_category,
            owner_id: props.hubspot_owner_id,
            num_contacts: parseInt(props.num_associated_contacts || '0'),

            // Company & Team
            company_size: props.company_size || null,
            industry: props.riverside_industries || null,
            clay_industry: props.clay_industry || null,

            // Champions / Decision Makers
            champion_email: props.champion_email_address || null,
            decision_maker_email: props.decision_maker_email_address || null,
            contacts_job_titles: props.contacts_job_titles || null,

            // Use Cases
            primary_use_case: props.primary_use_case || null,
            secondary_use_cases: props.secondary_use_cases || null,
            riverside_use_case: props.riverside_use_case || null,

            // Budget
            budget_scoring: props['budget__scoring_'] || null,
            economic_buyer_stage: props['economic_buyer___third_stage'] || null,
            metrics_stage: props['metrics___third_stage'] || null,

            // Competition
            competition_stage: props['competition___third_stage'] || null,
            competitive: props['competitive_'] || null,
            competitors_considered: props['what_competitors_are_they_looking_into_'] || null,

            // Pricing
            customer_plan: props['customer_plan__line_item_'] || null,
            pricing_package: props['pricing_package__line_item_'] || null,
            add_on_licenses: props['add_on_licenses__line_item_'] || null,
            add_on_productions: props['add_on_productions__line_item_'] || null,
            webinar_add_on_mrr: props.webinar_add_on_mrr || null,
            num_accounts_given: props['how_many_accounts_are_being_given___customer_'] || null,
            num_productions_given: props['how_many_productions_are_being_given_'] || null,

            // Pain (Enterprise)
            pain_net_new: props['identify_pain__net_new____third_stage'] || null,
            pain_vs_pro: props['identify_pain__vs_pro____third_stage'] || null,

            // Notes
            notes: props.notes || null,
            manager_notes: props.manager_notes || null,

            // MEDPICC (Enterprise)
            decision_process_stage: props['decision_process___third_stage'] || null,
            paper_process_stage: props['paper_process___third_stage'] || null,
            champion_stage: props['champion___third_stage'] || null,

            // Associated contacts
            contacts: contacts.map(c => ({
                id: c.id,
                email: c.email,
                job_title: c.jobtitle,
                persona_group: c.persona_group,
                persona_seniority: c.persona_seniority,
            })),

            // Contacts discovered from email threads and meeting attendees
            engagement_discovered_contacts: engagementDiscoveredContacts,
            total_engaged_contacts: parseInt(props.num_associated_contacts || '0') + engagementDiscoveredContacts.length,
        },
        engagement_metrics: activityMetrics,
        recent_engagements: recentEngagements,
        transcript_summary: transcriptSummary,
    };
}

// --- Process a Single Deal ---

async function processDeal(
    deal: HubSpotDeal,
    isOpen: boolean = true,
    ownerName: string | null = null
): Promise<{ success: boolean; riskLevel?: string }> {
    try {
        console.log(`Processing deal: ${deal.properties.dealname} (${deal.id})`);

        // Build risk input
        const riskInput = await buildRiskInput(deal);

        // Analyze with AI
        const { result, provider, promptVersion, dealAnalysis, emailAnalysis, transcriptAnalysis } = await analyzeDealRisk(riskInput);

        // Determine risk_type_change_date
        let riskTypeChangeDate: Date;
        try {
            const previousEval = await getPreviousEvaluation(deal.id);
            if (!previousEval) {
                // First scan for this deal
                riskTypeChangeDate = new Date();
            } else if (previousEval.risk_level !== result.risk_level) {
                // Risk level changed
                riskTypeChangeDate = new Date();
            } else {
                // Risk level unchanged — carry forward
                riskTypeChangeDate = previousEval.risk_type_change_date
                    ? new Date(previousEval.risk_type_change_date)
                    : new Date();
            }
        } catch (err) {
            console.error(`Failed to fetch previous evaluation for deal ${deal.id}:`, err);
            riskTypeChangeDate = new Date();
        }

        // Write back to HubSpot
        await updateDealRiskFields(deal.id, result);

        // Store in database
        try {
            await insertRiskEvaluation({
                deal_id: deal.id,
                deal_name: deal.properties.dealname,
                deal_amount: riskInput.deal_metadata.mrr,
                pipeline: deal.properties.pipeline || null,
                owner_name: ownerName,
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
                deal_analysis: dealAnalysis,
                email_analysis: emailAnalysis,
                transcript_analysis: transcriptAnalysis,
                risk_type_change_date: riskTypeChangeDate,
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
                        stage: getNormalizedStage(
                            deal.properties.deal_stage_name__text_ || deal.properties.dealstage,
                            deal.properties.pipeline || null
                        ),
                        owner: ownerName || deal.properties.hubspot_owner_id,
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
    pipelineId?: string,
    triggerSource: 'cron' | 'manual' | 'test' = 'manual',
    userId?: string | null
): Promise<ScanResult> {
    const startTime = Date.now();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Risk scan started at ${new Date().toISOString()}`);
    if (pipelineId) console.log(`Target Pipeline: ${pipelineId}`);
    console.log(`${'='.repeat(60)}\n`);

    // Initial log of scan run to database (before starting)
    let runRecordId: number | undefined;
    try {
        const run = await insertScanRun({
            started_at: new Date(startTime),
            completed_at: undefined,
            total_deals: 0, // Will be updated later
            high_risk_count: 0,
            errors: 0,
            trigger_source: triggerSource,
            user_id: userId ?? null,
        });
        runRecordId = run.id;
    } catch (dbError) {
        console.error('Failed to create scan run record:', dbError);
    }

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

    // Update total deals in the run record if we have an ID
    if (runRecordId) {
        try {
            await updateScanRun(runRecordId, { total_deals: deals.length });
        } catch (dbUpdateError) {
            console.error('Failed to update scan run with total deals:', dbUpdateError);
        }
    }

    console.log(`Found ${deals.length} deals to analyze\n`);

    // Fetch owner map (id → name) for resolving owner names
    const ownerMap = await fetchOwners();

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
                const ownerId = deal.properties.hubspot_owner_id;
                const ownerName = ownerId ? ownerMap.get(ownerId) || null : null;
                return processDeal(deal, isOpen, ownerName);
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

    // Update scan run completion to database
    if (runRecordId) {
        try {
            await updateScanRun(runRecordId, {
                completed_at: new Date(),
                total_deals: deals.length,
                high_risk_count: highRisk,
                errors,
                summary: result as unknown as Record<string, unknown>,
            });
        } catch (dbError) {
            console.error('Failed to log scan run completion:', dbError);
        }
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
