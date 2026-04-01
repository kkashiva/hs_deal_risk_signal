'use client';

// ============================================================
// Scan History Page — Cron Execution History (Client Component)
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { ScanRun } from '@/lib/types';
import Link from 'next/link';
import { authClient } from '@/lib/auth/client';

function formatDate(date: Date | string | undefined): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatDuration(start: Date | string, end?: Date | string): string {
    if (!end) return 'In Progress...';
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const diffMs = e - s;
    const diffSec = Math.floor(diffMs / 1000);
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return `${mins}m ${secs}s`;
}

// ── Hidden Dev Panel ────────────────────────────────────────
function DevScanPanel({ onClose, onScanComplete }: { onClose: () => void; onScanComplete: () => void }) {
    const [dealId, setDealId] = useState('');
    const [pipelineId, setPipelineId] = useState('');
    const [scanning, setScanning] = useState(false);
    const [isCronSim, setIsCronSim] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                onClose();
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [onClose]);

    // Close on Escape
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose();
        }
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    async function handleRun() {
        setScanning(true);
        setResult(null);

        try {
            const secret = prompt('Enter CRON_SECRET:');
            if (!secret) { setScanning(false); return; }

            const params = new URLSearchParams();
            if (dealId.trim()) params.set('deal_id', dealId.trim());
            if (pipelineId.trim()) params.set('pipeline_id', pipelineId.trim());
            params.set('source', isCronSim ? 'cron' : 'manual');

            // Pass user_id for manual scan attribution
            if (!isCronSim) {
                try {
                    const { data: session } = await authClient.getSession();
                    if (session?.user?.id) params.set('user_id', session.user.id);
                } catch { /* session unavailable — scan proceeds without user attribution */ }
            }

            const qs = params.toString() ? `?${params.toString()}` : '';

            const res = await fetch(`/api/cron/risk-scan${qs}`, {
                headers: { Authorization: `Bearer ${secret}` },
            });
            const data = await res.json();

            if (data.success) {
                setResult(
                    `✅ Scan complete: ${data.analyzed} deals, ` +
                    `${data.highRisk} HIGH, ${data.mediumRisk} MEDIUM, ${data.lowRisk} LOW ` +
                    `(${(data.duration_ms / 1000).toFixed(1)}s)`
                );
                onScanComplete();
            } else {
                setResult(`❌ Scan failed: ${data.error}`);
            }
        } catch (err) {
            setResult(`❌ Error: ${err instanceof Error ? err.message : 'Unknown'}`);
        } finally {
            setScanning(false);
        }
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
        }}>
            <div ref={panelRef} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', padding: '24px',
                width: '380px', maxWidth: '90vw',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>🔧 Dev Scan</h3>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', color: 'var(--text-muted)',
                        cursor: 'pointer', fontSize: '18px', lineHeight: 1,
                    }}>×</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                            Deal ID <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={dealId}
                            onChange={(e) => setDealId(e.target.value)}
                            placeholder="e.g. 53407665212"
                            style={{
                                width: '100%', padding: '8px 10px', fontSize: '13px',
                                background: 'var(--bg-page)', border: '1px solid var(--border)',
                                borderRadius: '6px', color: 'var(--text-primary)',
                                outline: 'none', boxSizing: 'border-box',
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                            Pipeline ID <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={pipelineId}
                            onChange={(e) => setPipelineId(e.target.value)}
                            placeholder="e.g. default"
                            style={{
                                width: '100%', padding: '8px 10px', fontSize: '13px',
                                background: 'var(--bg-page)', border: '1px solid var(--border)',
                                borderRadius: '6px', color: 'var(--text-primary)',
                                outline: 'none', boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                        <input 
                            type="checkbox" 
                            id="cron-sim" 
                            checked={isCronSim} 
                            onChange={(e) => setIsCronSim(e.target.checked)}
                            style={{ cursor: 'pointer' }}
                        />
                        <label htmlFor="cron-sim" style={{ fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                            Simulate Cron Run (Log as AUTO)
                        </label>
                    </div>

                    {result && (
                        <div style={{
                            padding: '10px 12px', borderRadius: '6px', fontSize: '12px',
                            background: result.startsWith('✅') ? 'var(--risk-low-bg)' : 'var(--risk-high-bg)',
                            color: result.startsWith('✅') ? 'var(--risk-low)' : 'var(--risk-high)',
                            border: `1px solid ${result.startsWith('✅') ? 'var(--risk-low-border)' : 'var(--risk-high-border)'}`,
                            wordBreak: 'break-word',
                        }}>
                            {result}
                        </div>
                    )}

                    <button
                        className="btn btn-primary"
                        onClick={handleRun}
                        disabled={scanning}
                        style={{ width: '100%', marginTop: '4px' }}
                    >
                        {scanning ? '⏳ Scanning...' : '🔍 Run Scan'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main Page ───────────────────────────────────────────────
export default function ScanHistoryPage() {
    const [runs, setRuns] = useState<ScanRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Hidden dev panel state
    const [showDevPanel, setShowDevPanel] = useState(false);
    const clickTimestamps = useRef<number[]>([]);

    const fetchRuns = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/scan-runs');
            if (!res.ok) throw new Error('Failed to fetch scan runs');
            const data = await res.json();
            setRuns(data.runs);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRuns();
    }, []);

    // 5 rapid clicks within 2 seconds to activate
    const handleTitleClick = useCallback(() => {
        const now = Date.now();
        clickTimestamps.current = [...clickTimestamps.current.filter(t => now - t < 2000), now];
        if (clickTimestamps.current.length >= 5) {
            clickTimestamps.current = [];
            setShowDevPanel(true);
        }
    }, []);

    return (
        <div className="animate-in">
            {/* Hidden dev panel */}
            {showDevPanel && (
                <DevScanPanel
                    onClose={() => setShowDevPanel(false)}
                    onScanComplete={fetchRuns}
                />
            )}

            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
                <Link href="/" style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'none' }}>
                    ← Back to Dashboard
                </Link>
                <div style={{ marginTop: '8px' }}>
                    <h1
                        onClick={handleTitleClick}
                        style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px', cursor: 'default', userSelect: 'none' }}
                    >
                        Scan History
                    </h1>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Audit log of automated and manual risk detection scans.
                    </p>
                </div>
            </div>

            <div className="table-container">
                <div className="table-header">
                    <h2>Recent Scan Runs</h2>
                    <button 
                        className="btn btn-sm" 
                        onClick={fetchRuns} 
                        disabled={loading}
                        style={{ opacity: loading ? 0.5 : 1 }}
                    >
                        {loading ? 'loading...' : '🔄 Refresh'}
                    </button>
                </div>

                {loading && (
                    <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '24px', marginBottom: '12px' }}>⏳</div>
                        Loading scan history...
                    </div>
                )}

                {error && (
                    <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--risk-high)' }}>
                        <div style={{ fontSize: '24px', marginBottom: '12px' }}>⚠️</div>
                        Error: {error}
                    </div>
                )}

                {!loading && !error && runs.length === 0 && (
                    <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '24px', marginBottom: '12px' }}>📋</div>
                        No scan runs found.
                    </div>
                )}

                {!loading && !error && runs.length > 0 && (
                    <table>
                        <thead>
                            <tr>
                                <th>Status</th>
                                <th>Source</th>
                                <th>Started At</th>
                                <th>Duration</th>
                                <th>Deals Processed</th>
                                <th>High Risk Found</th>
                                <th>Errors</th>
                            </tr>
                        </thead>
                        <tbody>
                            {runs.map((run) => (
                                <tr key={run.id}>
                                    <td>
                                        {run.completed_at ? (
                                            <span className="risk-badge low" style={{ background: 'var(--risk-low-bg)', color: 'var(--risk-low)', border: '1px solid var(--risk-low-border)' }}>
                                                ✅ SUCCESS
                                            </span>
                                        ) : (
                                            <span className="risk-badge medium" style={{ background: 'var(--risk-medium-bg)', color: 'var(--risk-medium)', border: '1px solid var(--risk-medium-border)' }}>
                                                ⏳ IN PROGRESS
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        <span style={{ 
                                            fontSize: '11px', 
                                            fontWeight: 600, 
                                            color: run.trigger_source === 'cron' ? '#8b5cf6' : 'var(--text-muted)',
                                            background: run.trigger_source === 'cron' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(0,0,0,0.05)',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            {run.trigger_source === 'cron' ? '🤖 AUTO' : `👤 MANUAL${run.user_email ? ` (${run.user_email})` : ''}`}
                                        </span>
                                    </td>
                                    <td className="deal-name">
                                        {formatDate(run.started_at)}
                                    </td>
                                    <td>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                                            {formatDuration(run.started_at, run.completed_at)}
                                        </span>
                                    </td>
                                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {run.total_deals}
                                    </td>
                                    <td>
                                        <span style={{ 
                                            color: run.high_risk_count > 0 ? 'var(--risk-high)' : 'var(--text-secondary)', 
                                            fontWeight: run.high_risk_count > 0 ? 700 : 400,
                                            background: run.high_risk_count > 0 ? 'var(--risk-high-bg)' : 'transparent',
                                            padding: run.high_risk_count > 0 ? '2px 8px' : '0',
                                            borderRadius: '4px'
                                        }}>
                                            {run.high_risk_count}
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{ 
                                            color: run.errors > 0 ? 'var(--risk-high)' : 'var(--text-muted)',
                                            fontWeight: run.errors > 0 ? 600 : 400
                                        }}>
                                            {run.errors}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
