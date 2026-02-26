// ============================================================
// App Configuration — reads from environment variables
// ============================================================

import { AppConfig } from './types';

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

function optionalEnv(name: string, defaultValue: string): string {
    return process.env[name] || defaultValue;
}

export function getConfig(): AppConfig {
    return {
        hubspot: {
            accessToken: requireEnv('HUBSPOT_ACCESS_TOKEN'),
            pipelineIds: requireEnv('HUBSPOT_PIPELINE_IDS').split(',').map(id => id.trim()),
        },
        gong: {
            accessKey: optionalEnv('GONG_ACCESS_KEY', ''),
            accessSecret: optionalEnv('GONG_ACCESS_SECRET', ''),
        },
        gemini: {
            apiKey: requireEnv('GEMINI_API_KEY'),
        },
        anthropic: {
            apiKey: optionalEnv('ANTHROPIC_API_KEY', ''),
        },
        database: {
            url: requireEnv('DATABASE_URL'),
        },
        slack: {
            webhookUrl: optionalEnv('SLACK_WEBHOOK_URL', ''),
        },
        cronSecret: requireEnv('CRON_SECRET'),
        mrrRoutingThreshold: parseInt(optionalEnv('MRR_ROUTING_THRESHOLD', '1200'), 10),
        highRiskDealValueThreshold: parseInt(optionalEnv('HIGH_RISK_DEAL_VALUE_THRESHOLD', '10000'), 10),
    };
}

// Late-stage deal stages that always route to Claude
export const LATE_STAGE_IDS = [
    'contractsent',
    'closedwon',
    'decisionmakerboughtin',
    'negotiation',
];

// Stages to exclude from scanning (already closed)
export const EXCLUDED_STAGES = [
    'closedwon',
    'closedlost',
];

export const PROMPT_VERSION = 'v1.0';
