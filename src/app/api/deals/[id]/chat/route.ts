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

        // Check if conversation is stale — if latest evaluation is less than
        // 24 hours old but the conversation has many steps, the scan may have
        // refreshed the analysis since the chat started. Use step count as a
        // proxy: step -1 = input checkpoint, higher = conversation turns.
        const evaluations = await getEvaluationsForDeal(dealId);
        if (evaluations.length > 0 && evaluations[0].evaluation_date && state.metadata) {
            const evalDate = new Date(evaluations[0].evaluation_date).getTime();
            const now = Date.now();
            const conversationAge = now - evalDate;
            // If evaluation happened in the last hour AND conversation has progressed,
            // the system prompt context may be outdated — start fresh
            if (conversationAge < 60 * 60 * 1000 && state.metadata.step > 0) {
                // Check if there's a system message with old data by comparing eval dates
                // For simplicity: if eval is very recent, let the user continue
                // Only reset if eval is newer than 1 hour (fresh scan just ran)
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

        console.log(`[Chat] Starting stream for deal ${dealId}, thread ${threadId}, isNew: ${isNewThread}`);

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

                    let eventCount = 0;
                    for await (const event of eventStream) {
                        eventCount++;
                        // Debug: log first few events to see what's coming through
                        if (eventCount <= 5) {
                            console.log(`[Chat Stream] Event #${eventCount}: ${event.event} | name: ${event.name} | data keys: ${Object.keys(event.data || {}).join(',')}`);
                            if (event.data?.chunk) {
                                console.log(`[Chat Stream] Chunk content type: ${typeof event.data.chunk.content}, value preview:`, JSON.stringify(event.data.chunk.content)?.substring(0, 200));
                            }
                        }
                        if (event.event === 'on_chat_model_stream') {
                            const chunk = event.data?.chunk;
                            if (chunk?.content) {
                                // Anthropic returns content as string or array of content blocks
                                let text = '';
                                if (typeof chunk.content === 'string') {
                                    text = chunk.content;
                                } else if (Array.isArray(chunk.content)) {
                                    // Extract text from content blocks: [{type: "text", text: "..."}]
                                    for (const block of chunk.content) {
                                        if (block.type === 'text' && block.text) {
                                            text += block.text;
                                        }
                                    }
                                }
                                if (text) {
                                    controller.enqueue(
                                        encoder.encode(`data: ${JSON.stringify({ token: text })}\n\n`)
                                    );
                                }
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

                    console.log(`[Chat] Stream complete. Total events: ${eventCount}`);
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();
                } catch (error) {
                    console.error('[Chat] Stream error:', error);
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
