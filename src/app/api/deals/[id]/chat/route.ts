// ============================================================
// Deal Chat API — GET (restore) + POST (stream)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getEvaluationsForDeal } from '@/db/queries';
import { getCurrentUser } from '@/lib/auth-helpers';
import {
    createDealChatAgent,
    buildInitialMessages,
    buildFollowUpMessage,
    filterDisplayMessages,
} from '@/lib/deal-chat-agent';
import { HumanMessage } from '@langchain/core/messages';

// --- Rate Limiting ---

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20; // messages per hour per user per deal
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(userId: string, dealId: string): { allowed: boolean; remaining: number } {
    const key = `${userId}_${dealId}`;
    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return { allowed: true, remaining: RATE_LIMIT - 1 };
    }

    if (entry.count >= RATE_LIMIT) {
        return { allowed: false, remaining: 0 };
    }

    entry.count++;
    return { allowed: true, remaining: RATE_LIMIT - entry.count };
}

// --- GET: Restore conversation from checkpoint ---

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: dealId } = await params;

        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const threadId = `deal_${dealId}_user_${user.userId}`;

        const agent = await createDealChatAgent(dealId);
        const state = await agent.getState({ configurable: { thread_id: threadId } });

        if (!state.values || !state.values.messages || state.values.messages.length === 0) {
            return NextResponse.json({ messages: [], threadId });
        }

        // Check if conversation is stale (evaluation newer than conversation)
        const evaluations = await getEvaluationsForDeal(dealId);
        if (evaluations.length > 0 && evaluations[0].evaluation_date) {
            const evalDate = new Date(evaluations[0].evaluation_date).getTime();
            // Find the first message timestamp from checkpoint metadata
            const checkpointTs = state.metadata?.created_at
                ? new Date(state.metadata.created_at as string).getTime()
                : 0;

            if (checkpointTs > 0 && evalDate > checkpointTs) {
                // Evaluation is newer than conversation — start fresh
                return NextResponse.json({ messages: [], threadId, stale: true });
            }
        }

        const messages = filterDisplayMessages(state.values.messages);
        return NextResponse.json({ messages, threadId });
    } catch (error) {
        console.error('Chat GET error:', error);
        return NextResponse.json(
            { error: 'Failed to load conversation' },
            { status: 500 }
        );
    }
}

// --- POST: Stream new message via SSE ---

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: dealId } = await params;

        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Rate limit check
        const rateCheck = checkRateLimit(user.userId, dealId);
        if (!rateCheck.allowed) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Try again later.', remaining: 0 },
                { status: 429 }
            );
        }

        const body = await request.json();
        const userMessage = body.message?.trim();

        if (!userMessage) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        // Cap conversation length
        const threadId = `deal_${dealId}_user_${user.userId}`;
        const agent = await createDealChatAgent(dealId);
        const existingState = await agent.getState({ configurable: { thread_id: threadId } });

        const existingMessages = existingState.values?.messages || [];
        const userMessageCount = existingMessages.filter(
            (m: { _getType?: () => string }) => m instanceof HumanMessage || m._getType?.() === 'human'
        ).length;

        if (userMessageCount >= 20) {
            return NextResponse.json(
                { error: 'Conversation limit reached (20 messages). Please start a new conversation.' },
                { status: 400 }
            );
        }

        // Determine if this is a new thread or continuation
        const isNewThread = existingMessages.length === 0;
        let input: { messages: ReturnType<typeof buildInitialMessages> | ReturnType<typeof buildFollowUpMessage> };

        if (isNewThread) {
            const evaluations = await getEvaluationsForDeal(dealId);
            if (evaluations.length === 0) {
                return NextResponse.json(
                    { error: 'No evaluations found. Run a risk scan first.' },
                    { status: 404 }
                );
            }
            input = { messages: buildInitialMessages(evaluations[0], userMessage) };
        } else {
            input = { messages: buildFollowUpMessage(userMessage) };
        }

        // Stream response via SSE
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    const eventStream = agent.streamEvents(
                        input,
                        {
                            configurable: { thread_id: threadId },
                            version: 'v2',
                        }
                    );

                    for await (const event of eventStream) {
                        if (event.event === 'on_chat_model_stream') {
                            const chunk = event.data?.chunk;
                            if (chunk?.content && typeof chunk.content === 'string') {
                                controller.enqueue(
                                    encoder.encode(`data: ${JSON.stringify({ token: chunk.content })}\n\n`)
                                );
                            }
                        } else if (event.event === 'on_tool_start') {
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({ tool_call: event.name })}\n\n`)
                            );
                        } else if (event.event === 'on_tool_end') {
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({ tool_done: event.name })}\n\n`)
                            );
                        }
                    }

                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();
                } catch (error) {
                    console.error('Chat stream error:', error);
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ error: 'Stream error occurred' })}\n\n`)
                    );
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Rate-Limit-Remaining': String(rateCheck.remaining),
            },
        });
    } catch (error) {
        console.error('Chat POST error:', error);
        if (error instanceof Error && error.message.includes('Chat feature requires')) {
            return NextResponse.json({ error: 'Chat feature not configured' }, { status: 503 });
        }
        return NextResponse.json(
            { error: 'Failed to process message' },
            { status: 500 }
        );
    }
}
