'use client';

// ============================================================
// Dashboard Client — Filters, Table, Scan Trigger
// ============================================================

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { RiskEvaluation } from '@/lib/types';

interface DashboardViewProps {
    evaluations: RiskEvaluation[];
    counts: { total: number; high: number; medium: number; low: number };
    pipelines: string[];
    riskReasons: string[];
    error: string | null;
}

function RiskBadge({ level }: { level: string }) {
    const cls = level.toLowerCase();
    const emoji = level === 'HIGH' ? '🔴' : level === 'MEDIUM' ? '🟡' : '🟢';
    return <span className={`risk-badge ${cls}`}>{emoji} {level}</span>;
}

function ConfidenceBar({ score }: { score: number }) {
    const color =
        score >= 80 ? 'var(--risk-high)' :
            score >= 50 ? 'var(--risk-medium)' :
                'var(--risk-low)';

    return (
        <div className="confidence-bar">
            <span>{score}%</span>
            <div className="confidence-track">
                <div
                    className="confidence-fill"
                    style={{ width: `${score}%`, background: color }}
                />
            </div>
        </div>
    );
}

function formatAmount(amount: number | null): string {
    if (!amount) return '—';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

function formatDate(date: Date | string | undefined): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

const AMOUNT_RANGES = [
    { label: 'All Amounts', value: '' },
    { label: 'Under $1,000', value: '0-1000' },
    { label: '$1,000 - $5,000', value: '1000-5000' },
    { label: '$5,000 - $25,000', value: '5000-25000' },
    { label: '$25,000 - $100,000', value: '25000-100000' },
    { label: 'Over $100,000', value: '100000-999999999' },
];

export function DashboardView({
    evaluations,
    counts,
    pipelines,
    riskReasons,
    error,
}: DashboardViewProps) {
    const [scanning, setScanning] = useState(false);
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [filterPipeline, setFilterPipeline] = useState('');
    const [filterRisk, setFilterRisk] = useState('');
    const [filterReason, setFilterReason] = useState('');
    const [filterAmount, setFilterAmount] = useState('');

    // Filter evaluations client-side
    const filteredEvaluations = useMemo(() => {
        return evaluations.filter((e: RiskEvaluation) => {
            if (filterPipeline && e.pipeline !== filterPipeline) return false;
            if (filterRisk && e.risk_level !== filterRisk) return false;
            if (filterReason && e.risk_reason !== filterReason) return false;
            if (filterAmount) {
                const [min, max] = filterAmount.split('-').map(Number);
                const amount = e.deal_amount || 0;
                if (amount < min || amount > max) return false;
            }
            return true;
        });
    }, [evaluations, filterPipeline, filterRisk, filterReason, filterAmount]);

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
                setTimeout(() => window.location.reload(), 2000);
            } else {
                setScanResult(`❌ Scan failed: ${data.error}`);
            }
        } catch (err) {
            setScanResult(`❌ Error: ${err instanceof Error ? err.message : 'Unknown'}`);
        } finally {
            setScanning(false);
        }
    }

    const hasActiveFilters = filterPipeline || filterRisk || filterReason || filterAmount;

    return (
        <div className="animate-in">
            {/* Summary Cards */}
            <div className="summary-grid">
                <div className="summary-card total">
                    <div className="summary-card-label">Total Deals Scanned</div>
                    <div className="summary-card-value">{counts.total}</div>
                </div>
                <div className="summary-card high">
                    <div className="summary-card-label">High Risk</div>
                    <div className="summary-card-value">{counts.high}</div>
                </div>
                <div className="summary-card medium">
                    <div className="summary-card-label">Medium Risk</div>
                    <div className="summary-card-value">{counts.medium}</div>
                </div>
                <div className="summary-card low">
                    <div className="summary-card-label">Low Risk</div>
                    <div className="summary-card-value">{counts.low}</div>
                </div>
            </div>

            {/* Scan Trigger */}
            <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button
                    className="btn btn-primary"
                    onClick={triggerScan}
                    disabled={scanning}
                >
                    {scanning ? '⏳ Scanning...' : '🔍 Run Risk Scan Now'}
                </button>
                {scanResult && (
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {scanResult}
                    </span>
                )}
            </div>

            {/* Deals Table */}
            <div className="table-container">
                <div className="table-header">
                    <h2>Deal Risk Evaluations</h2>
                    {hasActiveFilters && (
                        <button
                            className="btn btn-sm"
                            onClick={() => {
                                setFilterPipeline('');
                                setFilterRisk('');
                                setFilterReason('');
                                setFilterAmount('');
                            }}
                        >
                            ✕ Clear Filters
                        </button>
                    )}
                </div>

                {/* Filter Dropdowns */}
                <div className="filter-row">
                    <select
                        className="filter-select"
                        value={filterPipeline}
                        onChange={(e) => setFilterPipeline(e.target.value)}
                    >
                        <option value="">All Pipelines</option>
                        {pipelines.map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>

                    <select
                        className="filter-select"
                        value={filterRisk}
                        onChange={(e) => setFilterRisk(e.target.value)}
                    >
                        <option value="">All Risk Levels</option>
                        <option value="HIGH">🔴 High</option>
                        <option value="MEDIUM">🟡 Medium</option>
                        <option value="LOW">🟢 Low</option>
                    </select>

                    <select
                        className="filter-select"
                        value={filterReason}
                        onChange={(e) => setFilterReason(e.target.value)}
                    >
                        <option value="">All Risk Types</option>
                        {riskReasons.map(r => (
                            <option key={r} value={r}>
                                {r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </option>
                        ))}
                    </select>

                    <select
                        className="filter-select"
                        value={filterAmount}
                        onChange={(e) => setFilterAmount(e.target.value)}
                    >
                        {AMOUNT_RANGES.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>

                    {hasActiveFilters && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {filteredEvaluations.length} of {evaluations.length} deals
                        </span>
                    )}
                </div>

                {error ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">⚙️</div>
                        <h3>Setup Required</h3>
                        <p>{error}</p>
                    </div>
                ) : filteredEvaluations.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📊</div>
                        <h3>{hasActiveFilters ? 'No matching deals' : 'No evaluations yet'}</h3>
                        <p>{hasActiveFilters ? 'Try adjusting the filters.' : 'Run your first risk scan to see results here.'}</p>
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Deal Name</th>
                                <th>Amount</th>
                                <th>Risk Level</th>
                                <th>Primary Risk</th>
                                <th>Confidence</th>
                                <th>Escalation</th>
                                <th>Model</th>
                                <th>Last Scanned</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEvaluations.map((evaluation: RiskEvaluation) => (
                                <tr key={`${evaluation.deal_id}-${evaluation.id}`}>
                                    <td className="deal-name">
                                        <Link href={`/deals/${evaluation.deal_id}`}>
                                            {evaluation.deal_name || evaluation.deal_id}
                                        </Link>
                                    </td>
                                    <td>{formatAmount(evaluation.deal_amount)}</td>
                                    <td><RiskBadge level={evaluation.risk_level} /></td>
                                    <td style={{ textTransform: 'capitalize' }}>
                                        {evaluation.risk_reason?.replace(/_/g, ' ') || '—'}
                                    </td>
                                    <td><ConfidenceBar score={evaluation.confidence} /></td>
                                    <td style={{ textTransform: 'capitalize' }}>
                                        {evaluation.escalation_target === 'exec' ? '🚨 Exec' :
                                            evaluation.escalation_target === 'manager' ? '👔 Manager' :
                                                '👤 AE'}
                                    </td>
                                    <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                        {evaluation.model_used}
                                    </td>
                                    <td style={{ fontSize: '12px' }}>
                                        {formatDate(evaluation.evaluation_date)}
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
