'use client';

// ============================================================
// Scan History Page — Cron Execution History (Client Component)
// ============================================================

import { useState, useEffect } from 'react';
import { ScanRun } from '@/lib/types';
import Link from 'next/link';

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

export default function ScanHistoryPage() {
    const [runs, setRuns] = useState<ScanRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [scanning, setScanning] = useState(false);
    const [scanResult, setScanResult] = useState<string | null>(null);

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

    async function triggerScan() {
        setScanning(true);
        setScanResult(null);

        try {
            const secret = prompt('Enter CRON_SECRET:');
            if (!secret) {
                setScanning(false);
                return;
            }
            const res = await fetch('/api/cron/risk-scan', {
                headers: { Authorization: `Bearer ${secret}` },
            });
            const data = await res.json();

            if (data.success) {
                setScanResult(
                    `✅ Scan complete: ${data.analyzed} deals, ` +
                    `${data.highRisk} HIGH, ${data.mediumRisk} MEDIUM, ${data.lowRisk} LOW ` +
                    `(${(data.duration_ms / 1000).toFixed(1)}s)`
                );
                fetchRuns();
            } else {
                setScanResult(`❌ Scan failed: ${data.error}`);
            }
        } catch (err) {
            setScanResult(`❌ Error: ${err instanceof Error ? err.message : 'Unknown'}`);
        } finally {
            setScanning(false);
        }
    }

    return (
        <div className="animate-in">
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
                <Link href="/" style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'none' }}>
                    ← Back to Dashboard
                </Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '8px' }}>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px' }}>Scan History</h1>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            Audit log of automated and manual risk detection scans.
                        </p>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={triggerScan}
                        disabled={scanning}
                    >
                        {scanning ? '⏳ Scanning...' : '🔍 Run Risk Scan Now'}
                    </button>
                </div>
            </div>

            {scanResult && (
                <div style={{ 
                    marginBottom: '24px', 
                    background: 'var(--bg-card)', 
                    border: '1px solid var(--accent)', 
                    color: 'var(--text-primary)', 
                    padding: '12px 16px', 
                    borderRadius: 'var(--radius-md)',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    {scanResult}
                </div>
            )}

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
