// ============================================================
// Slack Notification Service
// ============================================================

import { IncomingWebhook } from '@slack/webhook';
import { RiskAnalysisResult } from './types';
import { getConfig } from './config';

let webhook: IncomingWebhook | null = null;

function getWebhook(): IncomingWebhook | null {
    if (webhook) return webhook;
    const config = getConfig();
    if (!config.slack.webhookUrl) return null;
    webhook = new IncomingWebhook(config.slack.webhookUrl);
    return webhook;
}

export function isSlackConfigured(): boolean {
    try {
        const config = getConfig();
        return !!config.slack.webhookUrl;
    } catch {
        return false;
    }
}

interface DealInfo {
    id: string;
    name: string;
    amount: number | null;
    stage: string;
    owner: string | null;
}

export async function sendHighRiskAlert(
    deal: DealInfo,
    result: RiskAnalysisResult
): Promise<void> {
    const hook = getWebhook();
    if (!hook) {
        console.log('Slack not configured, skipping alert');
        return;
    }

    const riskEmoji =
        result.risk_level === 'HIGH' ? '🔴' :
            result.risk_level === 'MEDIUM' ? '🟡' : '🟢';

    const escalationLabel =
        result.escalation_target === 'exec' ? '🚨 Exec/Cofounder' :
            result.escalation_target === 'manager' ? '👔 Sales Manager' : '👤 AE';

    const hubspotLink = `https://app.hubspot.com/contacts/deals/${deal.id}`;

    await hook.send({
        blocks: [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: `${riskEmoji} Deal Risk Alert: ${deal.name}`,
                    emoji: true,
                },
            },
            {
                type: 'section',
                fields: [
                    {
                        type: 'mrkdwn',
                        text: `*Risk Level:*\n${riskEmoji} ${result.risk_level}`,
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Confidence:*\n${result.confidence_score}%`,
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Deal Amount:*\n$${deal.amount?.toLocaleString() || 'Unknown'}`,
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Stage:*\n${deal.stage}`,
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Primary Risk:*\n${result.primary_risk_reason.replace(/_/g, ' ')}`,
                    },
                    {
                        type: 'mrkdwn',
                        text: `*Escalate To:*\n${escalationLabel}`,
                    },
                ],
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*Analysis:*\n${result.explanation}`,
                },
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*Recommended Action:*\n${result.recommended_action}`,
                },
            },
            {
                type: 'actions',
                elements: [
                    {
                        type: 'button',
                        text: {
                            type: 'plain_text',
                            text: '📋 View in HubSpot',
                        },
                        url: hubspotLink,
                    },
                ],
            },
        ],
    });

    console.log(`Sent Slack alert for deal "${deal.name}"`);
}

// --- Send Scan Summary ---

export async function sendScanSummary(
    total: number,
    highRisk: number,
    mediumRisk: number,
    errors: number,
    durationMs: number
): Promise<void> {
    const hook = getWebhook();
    if (!hook) return;

    await hook.send({
        blocks: [
            {
                type: 'header',
                text: {
                    type: 'plain_text',
                    text: '📊 Daily Risk Scan Complete',
                    emoji: true,
                },
            },
            {
                type: 'section',
                fields: [
                    { type: 'mrkdwn', text: `*Total Deals Scanned:*\n${total}` },
                    { type: 'mrkdwn', text: `*🔴 High Risk:*\n${highRisk}` },
                    { type: 'mrkdwn', text: `*🟡 Medium Risk:*\n${mediumRisk}` },
                    { type: 'mrkdwn', text: `*Errors:*\n${errors}` },
                    { type: 'mrkdwn', text: `*Duration:*\n${(durationMs / 1000).toFixed(1)}s` },
                ],
            },
        ],
    });
}
