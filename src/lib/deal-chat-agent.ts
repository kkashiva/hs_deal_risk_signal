// ============================================================
// Deal Chat Agent — LangGraph + PostgresSaver
// ============================================================
//
// Conversational AI chat for deal pages. Uses createReactAgent
// with tool-calling for on-demand email/transcript fetching.
// Conversations persist via PostgresSaver checkpointing.
// ============================================================

import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { ChatAnthropic } from '@langchain/anthropic';
import { tool } from '@langchain/core/tools';
import { SystemMessage, HumanMessage, BaseMessage, AIMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { RiskEvaluation, DealActivityMetrics } from './types';
import { fetchDealEngagements } from './hubspot';
import { extractGongCallIds, getTranscriptsFromCallIds, isGongConfigured } from './gong';
import { PIPELINE_MAP, getNormalizedStage } from './mappings';

// --- Checkpointer Singleton ---

let checkpointer: PostgresSaver | null = null;

async function getCheckpointer(): Promise<PostgresSaver> {
    if (!checkpointer) {
        const connString = process.env.DATABASE_URL;
        if (!connString) throw new Error('DATABASE_URL not configured');
        checkpointer = PostgresSaver.fromConnString(connString);
        await checkpointer.setup();
    }
    return checkpointer;
}

// --- Tool Factory ---

function createDealTools(dealId: string) {
    const fetchRecentEmails = tool(
        async ({ limit }: { limit?: number }) => {
            try {
                const engagements = await fetchDealEngagements(dealId);
                const emails = engagements
                    .filter(e => e.type === 'EMAIL')
                    .slice(0, Math.min(limit || 10, 20));

                if (emails.length === 0) {
                    return 'No email communications found for this deal.';
                }

                return emails.map(e => ({
                    date: new Date(e.timestamp).toISOString().split('T')[0],
                    subject: e.subject || 'No subject',
                    from: e.emailFrom || 'Unknown',
                    to: e.emailTo || 'Unknown',
                    cc: e.emailCc || null,
                    direction: e.direction || 'Unknown',
                    body: (e.body || '').substring(0, 3000),
                }));
            } catch (error) {
                return `Error fetching emails: ${error instanceof Error ? error.message : 'Unknown error'}. I can still answer based on the stored email analysis.`;
            }
        },
        {
            name: 'fetch_recent_emails',
            description: 'Fetch recent email communications for this deal from HubSpot. Use when the user asks about specific email content, who said what in emails, email threads, or communication details not covered in the email analysis summary.',
            schema: z.object({
                limit: z.number().optional().describe('Number of recent emails to fetch (default 10, max 20)'),
            }),
        }
    );

    const fetchGongTranscripts = tool(
        async () => {
            if (!isGongConfigured()) {
                return 'Gong integration is not configured for this workspace. I can still answer based on the stored transcript analysis.';
            }

            try {
                // Fetch notes to extract Gong call IDs (same pattern as risk-engine.ts)
                const engagements = await fetchDealEngagements(dealId);
                const gongCallIds: string[] = [];

                for (const eng of engagements) {
                    if (eng.type === 'NOTE' && eng.body) {
                        const ids = extractGongCallIds(eng.body);
                        gongCallIds.push(...ids);
                    }
                }

                if (gongCallIds.length === 0) {
                    return 'No Gong call recordings found linked to this deal.';
                }

                const uniqueIds = [...new Set(gongCallIds)];
                const transcript = await getTranscriptsFromCallIds(uniqueIds);

                if (!transcript) {
                    return 'Gong call IDs were found but transcripts could not be retrieved.';
                }

                return transcript;
            } catch (error) {
                return `Error fetching transcripts: ${error instanceof Error ? error.message : 'Unknown error'}. I can still answer based on the stored transcript analysis.`;
            }
        },
        {
            name: 'fetch_gong_transcripts',
            description: 'Fetch raw Gong call transcripts for this deal. Use when the user asks about what was said on calls, specific conversation details, or needs verbatim quotes not covered in the transcript analysis summary.',
            schema: z.object({}),
        }
    );

    return [fetchRecentEmails, fetchGongTranscripts];
}

// --- Agent Factory ---

export async function createDealChatAgent(dealId: string) {
    const apiKey = process.env.ANTHROPIC_CHAT_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error('Chat feature requires ANTHROPIC_CHAT_API_KEY or ANTHROPIC_API_KEY');
    }

    const saver = await getCheckpointer();

    const model = new ChatAnthropic({
        model: 'claude-sonnet-4-6',
        apiKey,
        temperature: 0.3,
    });

    return createReactAgent({
        llm: model,
        tools: createDealTools(dealId),
        checkpointSaver: saver,
    });
}

// --- System Prompt Builder ---

export function buildChatSystemPrompt(evaluation: RiskEvaluation): string {
    const dealMeta = evaluation.deal_metadata as Record<string, unknown> | null;
    const metrics = evaluation.engagement_metrics as DealActivityMetrics | null;

    const pipelineName = evaluation.pipeline
        ? (PIPELINE_MAP[evaluation.pipeline] || evaluation.pipeline)
        : 'Unknown';

    const stageName = dealMeta?.stage
        ? getNormalizedStage(dealMeta.stage as string, evaluation.pipeline ?? null)
        : 'Unknown';

    return `You are a senior sales strategy advisor embedded in a deal risk management system. You are having a conversation with a sales manager about a specific deal.

Your job is to:
- Answer questions about deal strategy, risk mitigation, and next steps
- Reference specific data points from the deal context provided below
- Be direct, actionable, and concise — sales managers are time-constrained
- When you cite data from emails, use the format [Email, <date>] (e.g., [Email, 2026-03-15])
- When you cite data from call transcripts, use the format [Gong call, <date>]
- When you cite CRM data, mention the field name (e.g., "the MEDPICC champion stage shows...")
- If the user asks about something not covered in your context, use the available tools to fetch raw email or transcript data
- If even after using tools the data is not available, say so clearly rather than speculating

Communication style:
- Use bullet points for action items
- Bold key recommendations using **text**
- Keep responses under 300 words unless the user asks for more detail
- When recommending who to talk to, reference specific contacts from the deal data
- When suggesting strategies, be specific to this deal's context — avoid generic advice

## Current Deal Status

- **Deal**: ${evaluation.deal_name}
- **Amount**: ${evaluation.deal_amount ? `$${evaluation.deal_amount.toLocaleString()}` : 'Not set'}${dealMeta?.mrr ? ` | MRR: $${Number(dealMeta.mrr).toLocaleString()}` : ''}
- **Stage**: ${stageName}
- **Pipeline**: ${pipelineName}
- **Risk Level**: ${evaluation.risk_level} (${evaluation.confidence}% confidence)
- **Primary Risk**: ${evaluation.risk_reason.replace(/_/g, ' ')}
- **Escalation**: ${evaluation.escalation_target}
- **Last Scan**: ${evaluation.evaluation_date ? new Date(evaluation.evaluation_date).toISOString().split('T')[0] : 'Unknown'}

## AI Risk Explanation
${evaluation.explanation}

## Recommended Action
${evaluation.recommended_action}

${evaluation.deal_analysis ? `## Deal Metadata Analysis\n${evaluation.deal_analysis}` : ''}

${evaluation.email_analysis ? `## Email Communication Analysis\n${evaluation.email_analysis}` : ''}

${evaluation.transcript_analysis ? `## Call Transcript Analysis\n${evaluation.transcript_analysis}` : ''}

## Raw Deal Metadata
${dealMeta ? JSON.stringify(dealMeta, null, 2) : 'Not available'}

${metrics ? `## Engagement Metrics\n${JSON.stringify(metrics, null, 2)}` : ''}`;
}

// --- Message Helpers ---

export function buildInitialMessages(evaluation: RiskEvaluation, userMessage: string): BaseMessage[] {
    return [
        new SystemMessage(buildChatSystemPrompt(evaluation)),
        new HumanMessage(userMessage),
    ];
}

export function buildFollowUpMessage(userMessage: string): BaseMessage[] {
    return [new HumanMessage(userMessage)];
}

// Filter checkpoint messages to only human + AI (no tool calls/results/system)
export function filterDisplayMessages(messages: BaseMessage[]): { id: string; role: 'user' | 'assistant'; content: string }[] {
    const display: { id: string; role: 'user' | 'assistant'; content: string }[] = [];

    for (const msg of messages) {
        if (msg instanceof HumanMessage) {
            const content = typeof msg.content === 'string' ? msg.content : '';
            if (content) {
                display.push({ id: msg.id || crypto.randomUUID(), role: 'user', content });
            }
        } else if (msg instanceof AIMessage) {
            const content = typeof msg.content === 'string' ? msg.content : '';
            // Only include AI messages with text content (not pure tool-call messages)
            if (content) {
                display.push({ id: msg.id || crypto.randomUUID(), role: 'assistant', content });
            }
        }
    }

    return display;
}
