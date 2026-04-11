'use client';

// ============================================================
// Chat Panel — Slide-out panel wrapper + floating trigger button
// ============================================================

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DealChat } from './deal-chat';

interface ChatPanelProps {
    dealId: string;
    riskReason: string;
    riskLevel: string;
}

export function ChatPanel({ dealId, riskReason, riskLevel }: ChatPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const chatContent = isOpen && (
        <>
            {/* Backdrop */}
            <div
                className={`chat-backdrop ${isOpen ? 'open' : ''}`}
                onClick={() => setIsOpen(false)}
            />

            {/* Modal Panel */}
            <div className={`chat-panel ${isOpen ? 'open' : ''}`}>
                <div className="chat-header">
                    <div className="chat-header-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        Deal AI Chat
                    </div>
                    <button
                        className="chat-close-btn"
                        onClick={() => setIsOpen(false)}
                        title="Close chat"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <DealChat
                    dealId={dealId}
                    riskReason={riskReason}
                    riskLevel={riskLevel}
                />
            </div>
        </>
    );

    return (
        <>
            {/* Trigger button (always visible in layout) */}
            <button
                className={`chat-trigger-btn ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                title={isOpen ? "Close AI Chat" : "Ask AI about this deal"}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                {isOpen ? 'Close' : 'Ask AI'}
            </button>

            {/* Portal for modal and backdrop */}
            {mounted && createPortal(chatContent, document.body)}
        </>
    );
}
