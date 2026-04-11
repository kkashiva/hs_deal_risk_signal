'use client';

// ============================================================
// Deal Chat — Messages, SSE streaming, starter chips, citations
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

interface DealChatProps {
    dealId: string;
    riskReason: string;
    riskLevel: string;
}

// --- Starter Chip Suggestions ---

function getStarterChips(riskReason: string): string[] {
    const defaults = [
        'What are the key next steps to close this deal?',
        'Summarize the risks and how to address them',
    ];

    const reasonChips: Record<string, string> = {
        budget: 'What pricing strategy can mitigate this risk?',
        no_champion: 'Who should we be speaking to internally?',
        competition: 'How should we position against the competitor?',
        timing: 'What can we do to accelerate the timeline?',
        timeline_stalling: 'What can we do to accelerate the timeline?',
        low_engagement: 'How can we re-engage this prospect?',
        multithreading_gap: 'Who else should we be engaging at this account?',
        feature_gap: 'How can we address the feature gap concerns?',
    };

    const reasonChip = reasonChips[riskReason];
    return reasonChip ? [reasonChip, ...defaults] : defaults;
}

// --- Citation Renderer ---

function CitationText({ text }: { text: string }) {
    // Match [Email, ...] and [Gong call, ...] patterns
    const parts = text.split(/(\[(?:Email|Gong call),\s*[^\]]+\])/g);

    return (
        <>
            {parts.map((part, i) => {
                if (/^\[(?:Email|Gong call),\s*[^\]]+\]$/.test(part)) {
                    return (
                        <span key={i} className="chat-citation">
                            {part}
                        </span>
                    );
                }
                return part;
            })}
        </>
    );
}

// Custom markdown renderer that applies citation styling to text nodes
function ChatMarkdown({ content }: { content: string }) {
    return (
        <div className="markdown-content">
            <ReactMarkdown
                components={{
                    p: ({ children }) => (
                        <p>
                            {typeof children === 'string' ? (
                                <CitationText text={children} />
                            ) : (
                                children
                            )}
                        </p>
                    ),
                    li: ({ children }) => (
                        <li>
                            {typeof children === 'string' ? (
                                <CitationText text={children} />
                            ) : (
                                children
                            )}
                        </li>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

// --- Main Chat Component ---

export function DealChat({ dealId, riskReason }: DealChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [activeToolCall, setActiveToolCall] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isRestoring, setIsRestoring] = useState(true);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Auto-scroll to bottom on new messages
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Restore persisted conversation on mount
    useEffect(() => {
        async function restore() {
            try {
                const res = await fetch(`/api/deals/${dealId}/chat`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.messages && data.messages.length > 0) {
                        setMessages(data.messages);
                    }
                }
            } catch {
                // Silently fail — start fresh
            } finally {
                setIsRestoring(false);
            }
        }
        restore();
    }, [dealId]);

    // Send message with SSE streaming
    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: text.trim(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setError(null);
        setActiveToolCall(null);

        // Placeholder for streaming assistant message
        const assistantId = crypto.randomUUID();
        setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

        abortControllerRef.current = new AbortController();

        try {
            const res = await fetch(`/api/deals/${dealId}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text.trim() }),
                signal: abortControllerRef.current.signal,
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || `HTTP ${res.status}`);
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error('No response stream');

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6);

                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);

                        if (parsed.token) {
                            setMessages(prev =>
                                prev.map(m =>
                                    m.id === assistantId
                                        ? { ...m, content: m.content + parsed.token }
                                        : m
                                )
                            );
                        } else if (parsed.tool_call) {
                            const toolName = parsed.tool_call === 'fetch_recent_emails'
                                ? 'Fetching email data...'
                                : parsed.tool_call === 'fetch_gong_transcripts'
                                    ? 'Fetching call transcripts...'
                                    : `Using ${parsed.tool_call}...`;
                            setActiveToolCall(toolName);
                        } else if (parsed.tool_done) {
                            setActiveToolCall(null);
                        } else if (parsed.error) {
                            throw new Error(parsed.error);
                        }
                    } catch (e) {
                        if (e instanceof SyntaxError) continue; // Skip malformed JSON
                        throw e;
                    }
                }
            }
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') return;

            const message = err instanceof Error ? err.message : 'Failed to send message';
            setError(message);

            // Remove empty assistant message on error
            setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.id === assistantId && !last.content) {
                    return prev.slice(0, -1);
                }
                return prev;
            });
        } finally {
            setIsLoading(false);
            setActiveToolCall(null);
            abortControllerRef.current = null;
        }
    }, [dealId, isLoading]);

    // Handle form submit
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };

    // Handle starter chip click
    const handleChipClick = (text: string) => {
        sendMessage(text);
    };

    const starterChips = getStarterChips(riskReason);

    return (
        <div className="chat-body">
            {/* Messages area */}
            <div className="chat-messages">
                {isRestoring ? (
                    <div className="chat-loading-state">Loading conversation...</div>
                ) : messages.length === 0 ? (
                    <div className="chat-empty-state">
                        <div className="chat-empty-icon">💬</div>
                        <p className="chat-empty-title">Ask about this deal</p>
                        <p className="chat-empty-subtitle">
                            Get strategic advice, dig into emails and call transcripts, or explore risk mitigation options.
                        </p>
                        <div className="chat-starter-chips">
                            {starterChips.map((chip, i) => (
                                <button
                                    key={i}
                                    className="chat-chip"
                                    onClick={() => handleChipClick(chip)}
                                    disabled={isLoading}
                                >
                                    {chip}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        {messages.map(msg => (
                            <div key={msg.id} className={`chat-message ${msg.role}`}>
                                {msg.role === 'assistant' ? (
                                    <ChatMarkdown content={msg.content || '...'} />
                                ) : (
                                    <p>{msg.content}</p>
                                )}
                            </div>
                        ))}

                        {activeToolCall && (
                            <div className="chat-tool-indicator">
                                <span className="chat-tool-spinner" />
                                {activeToolCall}
                            </div>
                        )}
                    </>
                )}

                {error && (
                    <div className="chat-error">
                        {error}
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <form className="chat-input-area" onSubmit={handleSubmit}>
                <input
                    type="text"
                    className="chat-input"
                    placeholder="Ask about this deal..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    disabled={isLoading || isRestoring}
                    autoFocus
                />
                <button
                    type="submit"
                    className="chat-send-btn"
                    disabled={!input.trim() || isLoading || isRestoring}
                    title="Send message"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                </button>
            </form>
        </div>
    );
}
