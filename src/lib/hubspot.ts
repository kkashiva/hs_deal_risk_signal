// ============================================================
// HubSpot Service — Deals, Engagements, Custom Properties
// ============================================================

import { Client } from '@hubspot/api-client';
import {
    HubSpotDeal,
    HubSpotEngagement,
    DealActivityMetrics,
    RiskAnalysisResult,
} from './types';
import { PIPELINE_MAP } from './mappings';
import { getConfig, EXCLUDED_STAGES } from './config';

// --- Constants ---


let hubspotClient: Client | null = null;

function getClient(): Client {
    if (!hubspotClient) {
        const config = getConfig();
        hubspotClient = new Client({ accessToken: config.hubspot.accessToken });
    }
    return hubspotClient;
}

// --- Fetch Owners ---

export async function fetchOwners(): Promise<Map<string, string>> {
    const client = getClient();
    const ownerMap = new Map<string, string>();

    try {
        let after: string | undefined;
        do {
            const response = await client.apiRequest({
                method: 'GET',
                path: `/crm/v3/owners${after ? `?after=${after}` : ''}`,
            });
            const data = await response.json() as {
                results?: { id: string; firstName?: string; lastName?: string }[];
                paging?: { next?: { after: string } };
            };

            for (const owner of data.results || []) {
                const name = [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim();
                if (name) {
                    ownerMap.set(owner.id, name);
                }
            }

            after = data.paging?.next?.after;
        } while (after);

        console.log(`Fetched ${ownerMap.size} HubSpot owners`);
    } catch (error) {
        console.error('Failed to fetch HubSpot owners:', error);
    }

    return ownerMap;
}

// --- Custom Properties ---

const RISK_PROPERTIES = [
    {
        name: 'ai_risk_level', label: 'AI Risk Level', type: 'enumeration', fieldType: 'select',
        options: [
            { label: 'LOW', value: 'LOW' },
            { label: 'MEDIUM', value: 'MEDIUM' },
            { label: 'HIGH', value: 'HIGH' },
        ]
    },
    { name: 'ai_primary_risk_reason', label: 'AI Primary Risk Reason', type: 'string', fieldType: 'text' },
    { name: 'ai_risk_explanation', label: 'AI Risk Explanation', type: 'string', fieldType: 'textarea' },
    { name: 'ai_recommended_action', label: 'AI Recommended Action', type: 'string', fieldType: 'textarea' },
    { name: 'ai_confidence_score', label: 'AI Confidence Score', type: 'number', fieldType: 'number' },
    { name: 'ai_last_evaluated_at', label: 'AI Last Evaluated At', type: 'datetime', fieldType: 'date' },
];

export async function ensureCustomProperties(): Promise<void> {
    const client = getClient();

    for (const prop of RISK_PROPERTIES) {
        try {
            await client.crm.properties.coreApi.getByName('deals', prop.name);
            // Property already exists
        } catch {
            // Property doesn't exist, create it
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const createInput: any = {
                name: prop.name,
                label: prop.label,
                type: prop.type,
                fieldType: prop.fieldType,
                groupName: 'dealinformation',
            };
            if (prop.options) {
                createInput.options = prop.options.map((o, i) => ({ ...o, displayOrder: i }));
            }
            await client.crm.properties.coreApi.create('deals', createInput);
            console.log(`Created HubSpot property: ${prop.name}`);
        }
    }
}

// --- Fetch Open Deals ---

const DEAL_PROPERTIES = [
    // --- Core ---
    'dealname', 'amount', 'mrr', 'hs_mrr', 'dealstage', 'deal_stage_name__text_', 'pipeline',
    'closedate', 'createdate', 'hs_lastmodifieddate',
    'hubspot_owner_id', 'hs_forecast_category', 'hs_manual_forecast_category',
    'notes_last_updated', 'num_associated_contacts', 'hs_v2_time_in_current_stage',
    'hs_is_open_count',
    // --- Company & Team ---
    'company_size', 'riverside_industries', 'clay_industry',
    // --- Champions / DMs ---
    'champion_email_address', 'decision_maker_email_address', 'contacts_job_titles',
    // --- Use Cases ---
    'primary_use_case', 'secondary_use_cases', 'riverside_use_case',
    // --- Budget ---
    'budget__scoring_', 'economic_buyer___third_stage', 'metrics___third_stage',
    // --- Competition ---
    'competition___third_stage', 'competitive_', 'what_competitors_are_they_looking_into_',
    // --- Pricing ---
    'customer_plan__line_item_', 'pricing_package__line_item_',
    'add_on_licenses__line_item_', 'add_on_productions__line_item_',
    'webinar_add_on_mrr', 'how_many_accounts_are_being_given___customer_',
    'how_many_productions_are_being_given_',
    // --- Pain (Enterprise) ---
    'identify_pain__net_new____third_stage', 'identify_pain__vs_pro____third_stage',
    // --- Notes ---
    'notes', 'manager_notes',
    // --- MEDPICC (Enterprise) ---
    'decision_process___third_stage', 'paper_process___third_stage', 'champion___third_stage',
];

/** Returns true if the deal is open (hs_is_open_count === '1') */
export function isDealOpen(deal: HubSpotDeal): boolean {
    return deal.properties.hs_is_open_count === '1';
}

export async function fetchOpenDeals(pipelineIds?: string[]): Promise<HubSpotDeal[]> {
    const client = getClient();
    const config = getConfig();
    const targetPipelines = pipelineIds || config.hubspot.pipelineIds;

    const allDeals: HubSpotDeal[] = [];

    for (const pipelineId of targetPipelines) {
        let after: string | undefined;

        do {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const searchRequest: any = {
                filterGroups: [
                    {
                        filters: [
                            {
                                propertyName: 'pipeline',
                                operator: 'EQ',
                                value: pipelineId,
                            },
                            {
                                propertyName: 'dealstage',
                                operator: 'NOT_IN',
                                values: EXCLUDED_STAGES,
                            },
                        ],
                    },
                ],
                properties: DEAL_PROPERTIES,
                limit: 100,
                after: after || '0',
                sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
            };

            const response = await client.crm.deals.searchApi.doSearch(searchRequest);

            const deals = (response.results || []).map((d) => ({
                id: d.id,
                properties: d.properties as HubSpotDeal['properties'],
            }));

            allDeals.push(...deals);
            after = response.paging?.next?.after;
        } while (after);

        console.log(`Fetched deals from pipeline ${pipelineId}`);
    }

    console.log(`Total: ${allDeals.length} deals across ${targetPipelines.length} pipelines`);
    return allDeals;
}

// --- Fetch Single Deal ---

export async function fetchDeal(dealId: string): Promise<HubSpotDeal | null> {
    const client = getClient();

    try {
        const response = await client.crm.deals.basicApi.getById(
            dealId,
            [...DEAL_PROPERTIES, ...RISK_PROPERTIES.map(p => p.name)]
        );
        return {
            id: response.id,
            properties: response.properties as HubSpotDeal['properties'],
        };
    } catch {
        return null;
    }
}

// --- Fetch Engagements for a Deal ---

export async function fetchDealEngagements(dealId: string): Promise<HubSpotEngagement[]> {
    const client = getClient();
    const engagements: HubSpotEngagement[] = [];

    // Fetch associated emails, notes, meetings, calls
    const types: Array<{ objectType: string; engagementType: HubSpotEngagement['type'] }> = [
        { objectType: 'emails', engagementType: 'EMAIL' },
        { objectType: 'notes', engagementType: 'NOTE' },
        { objectType: 'meetings', engagementType: 'MEETING' },
        { objectType: 'calls', engagementType: 'CALL' },
    ];

    for (const { objectType, engagementType } of types) {
        try {
            // Use the associations v4 API
            const response = await client.apiRequest({
                method: 'GET',
                path: `/crm/v4/objects/deals/${dealId}/associations/${objectType}`,
            });
            const data = await response.json() as { results?: { toObjectId: number }[] };

            for (const assoc of data.results || []) {
                try {
                    const objectId = String(assoc.toObjectId);
                    let record;
                    switch (objectType) {
                        case 'emails':
                            record = await client.crm.objects.emails.basicApi.getById(
                                objectId,
                                ['hs_timestamp', 'hs_email_subject', 'hs_email_text', 'hs_email_html', 'hs_email_direction']
                            );
                            break;
                        case 'notes':
                            record = await client.crm.objects.notes.basicApi.getById(
                                objectId,
                                ['hs_timestamp', 'hs_note_body']
                            );
                            break;
                        case 'meetings':
                            record = await client.crm.objects.meetings.basicApi.getById(
                                objectId,
                                ['hs_timestamp', 'hs_meeting_title', 'hs_meeting_body', 'hs_meeting_outcome']
                            );
                            break;
                        case 'calls':
                            record = await client.crm.objects.calls.basicApi.getById(
                                objectId,
                                ['hs_timestamp', 'hs_call_title', 'hs_call_body', 'hs_call_duration']
                            );
                            break;
                    }

                    if (record) {
                        engagements.push({
                            id: record.id,
                            type: engagementType,
                            timestamp: new Date(record.properties.hs_timestamp || record.createdAt).getTime(),
                            subject: record.properties.hs_email_subject || record.properties.hs_meeting_title || record.properties.hs_call_title || undefined,
                            body: record.properties.hs_email_text || record.properties.hs_email_html || record.properties.hs_note_body || record.properties.hs_meeting_body || record.properties.hs_call_body || undefined,
                            ...(engagementType === 'EMAIL' && record.properties.hs_email_direction
                                ? { direction: record.properties.hs_email_direction }
                                : {}),
                            ...(engagementType === 'MEETING' && record.properties.hs_meeting_outcome
                                ? { meetingOutcome: record.properties.hs_meeting_outcome }
                                : {}),
                        });
                    }
                } catch {
                    // Skip individual engagement errors
                }
            }
        } catch {
            // Skip if association type not found
        }
    }

    // Sort by timestamp descending (most recent first)
    engagements.sort((a, b) => b.timestamp - a.timestamp);
    return engagements;
}

// --- Compute Activity Metrics ---

export function computeActivityMetrics(engagements: HubSpotEngagement[]): DealActivityMetrics {
    const now = Date.now();

    // Filter for past engagements to avoid skewing metrics with future meetings/tasks
    const pastEngagements = engagements.filter(e => e.timestamp <= now);

    const emails = pastEngagements.filter(e => e.type === 'EMAIL');
    const meetings = pastEngagements.filter(e => e.type === 'MEETING');
    const calls = pastEngagements.filter(e => e.type === 'CALL');
    const notes = pastEngagements.filter(e => e.type === 'NOTE');

    const mostRecent = pastEngagements.length > 0 ? pastEngagements[0].timestamp : null;
    const lastMeeting = meetings.length > 0 ? meetings[0].timestamp : null;

    // Calculate avg days between activities
    let avgDaysBetween: number | null = null;
    if (pastEngagements.length >= 2) {
        const sorted = pastEngagements.map(e => e.timestamp).sort((a, b) => a - b);
        const gaps = [];
        for (let i = 1; i < sorted.length; i++) {
            gaps.push((sorted[i] - sorted[i - 1]) / (1000 * 60 * 60 * 24));
        }
        avgDaysBetween = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
    }

    // Count no-shows using hs_meeting_outcome
    // Outcomes: BUSY, COMPLETED, NO_SHOW, RESCHEDULED, CANCELED
    const noShows = pastEngagements.filter(e =>
        e.type === 'MEETING' &&
        (e.meetingOutcome === 'NO_SHOW' || e.meetingOutcome === 'CANCELED' || e.meetingOutcome === 'RESCHEDULED')
    ).length;

    // --- Reply Velocity (median hours between inbound → outbound emails) ---
    let avgEmailReplyTimeHours: number | null = null;
    const sortedEmails = [...emails].sort((a, b) => a.timestamp - b.timestamp);
    const replyGapsHours: number[] = [];
    for (let i = 1; i < sortedEmails.length; i++) {
        const prev = sortedEmails[i - 1];
        const curr = sortedEmails[i];
        // Inbound followed by outbound = a reply
        if (
            prev.direction === 'INCOMING_EMAIL' &&
            curr.direction !== 'INCOMING_EMAIL' &&
            curr.direction !== 'FORWARDED_EMAIL'
        ) {
            const gapHours = (curr.timestamp - prev.timestamp) / (1000 * 60 * 60);
            if (gapHours >= 0) { // Safety check
                replyGapsHours.push(gapHours);
            }
        }
    }
    if (replyGapsHours.length > 0) {
        replyGapsHours.sort((a, b) => a - b);
        const mid = Math.floor(replyGapsHours.length / 2);
        avgEmailReplyTimeHours = replyGapsHours.length % 2 === 0
            ? Math.round((replyGapsHours[mid - 1] + replyGapsHours[mid]) / 2)
            : Math.round(replyGapsHours[mid]);
    }

    // --- Meeting Cadence (avg days between meetings) ---
    let avgDaysBetweenMeetings: number | null = null;
    if (meetings.length >= 2) {
        const sortedMeetings = meetings.map(m => m.timestamp).sort((a, b) => a - b);
        const meetingGaps: number[] = [];
        for (let i = 1; i < sortedMeetings.length; i++) {
            meetingGaps.push((sortedMeetings[i] - sortedMeetings[i - 1]) / (1000 * 60 * 60 * 24));
        }
        avgDaysBetweenMeetings = Math.round(meetingGaps.reduce((a, b) => a + b, 0) / meetingGaps.length);
    }

    return {
        totalEmails: emails.length,
        totalMeetings: meetings.length,
        totalCalls: calls.length,
        totalNotes: notes.length,
        daysSinceLastActivity: mostRecent ? Math.max(0, Math.round((now - mostRecent) / (1000 * 60 * 60 * 24))) : 0,
        daysSinceLastMeeting: lastMeeting ? Math.max(0, Math.round((now - lastMeeting) / (1000 * 60 * 60 * 24))) : null,
        meetingNoShows: noShows,
        avgDaysBetweenActivities: avgDaysBetween,
        avgEmailReplyTimeHours,
        avgDaysBetweenMeetings,
    };
}

// --- Update Deal with Risk Fields ---

export async function updateDealRiskFields(
    dealId: string,
    result: RiskAnalysisResult
): Promise<void> {
    const client = getClient();

    await client.crm.deals.basicApi.update(dealId, {
        properties: {
            ai_risk_level: result.risk_level,
            ai_primary_risk_reason: result.primary_risk_reason,
            ai_risk_explanation: result.explanation,
            ai_recommended_action: result.recommended_action,
            ai_confidence_score: String(result.confidence_score),
            ai_last_evaluated_at: new Date().toISOString(),
        },
    });
}

// --- Create Task for High Risk Deals ---

export async function createTaskForHighRisk(
    dealId: string,
    ownerId: string | null,
    description: string
): Promise<void> {
    const client = getClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const taskInput: any = {
        properties: {
            hs_task_subject: '🚨 AI Risk Alert: Deal needs attention',
            hs_task_body: description,
            hs_task_status: 'NOT_STARTED',
            hs_task_priority: 'HIGH',
            hs_timestamp: new Date().toISOString(),
            ...(ownerId ? { hubspot_owner_id: ownerId } : {}),
        },
        associations: [
            {
                to: { id: dealId },
                types: [
                    {
                        associationCategory: 'HUBSPOT_DEFINED',
                        associationTypeId: 216, // task to deal
                    },
                ],
            },
        ],
    };

    const taskResponse = await client.crm.objects.tasks.basicApi.create(taskInput);
    console.log(`Created task ${taskResponse.id} for deal ${dealId}`);
}
