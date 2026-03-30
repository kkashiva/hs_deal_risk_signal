'use client';

// ============================================================
// Lost Deal Learnings — Client Component
// ============================================================

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { RiskEvaluation } from '@/lib/types';
import { PIPELINE_MAP } from '@/lib/mappings';

type SortConfig = {
    key: string;
    direction: 'asc' | 'desc';
};

function SortIcon({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) {
    if (!active) return (
        <span className="sort-icon">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 15l5 5 5-5M7 9l5-5 5 5" /></svg>
        </span>
    );
    return (
        <span className="sort-icon">
            {direction === 'asc' ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 15l-6-6-6 6" /></svg>
            ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6" /></svg>
            )}
        </span>
    );
}

function SortableHeader({ label, sortKey, currentSort, onSort }: { label: string; sortKey: string; currentSort: SortConfig; onSort: (key: string) => void }) {
    const active = currentSort.key === sortKey;
    return (
        <th
            className={`sortable ${active ? 'active-sort' : ''}`}
            onClick={() => onSort(sortKey)}
        >
            <div style={{ display: 'flex', alignItems: 'center' }}>
                {label}
                <SortIcon active={active} direction={currentSort.direction} />
            </div>
        </th>
    );
}

function nextSort(current: SortConfig, key: string): SortConfig {
    if (current.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
    }
    return { key, direction: 'desc' };
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
                <div className="confidence-fill" style={{ width: `${score}%`, background: color }} />
            </div>
        </div>
    );
}

function formatAmount(amount: number | null | undefined): string {
    if (amount === null || amount === undefined) return '—';
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

interface LostDealsViewProps {
    evaluations: RiskEvaluation[];
    pipelines: string[];
    riskReasons: string[];
    owners: string[];
    error: string | null;
}

export function LostDealsView({ evaluations, pipelines, riskReasons, owners, error }: LostDealsViewProps) {
    const [filterPipeline, setFilterPipeline] = useState('');
    const [filterRisk, setFilterRisk] = useState('');
    const [filterReason, setFilterReason] = useState('');
    const [filterOwner, setFilterOwner] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'evaluation_date', direction: 'desc' });

    // Filter and sort
    const filteredAndSorted = useMemo(() => {
        const filtered = evaluations.filter((e) => {
            if (filterPipeline && e.pipeline !== filterPipeline) return false;
            if (filterRisk && e.risk_level !== filterRisk) return false;
            if (filterReason && e.risk_reason !== filterReason) return false;
            if (filterOwner && e.owner_name !== filterOwner) return false;
            return true;
        });

        return [...filtered].sort((a, b) => {
            const key = sortConfig.key;
            let valA: unknown;
            let valB: unknown;

            if (key === 'deal_name') { valA = a.deal_name; valB = b.deal_name; }
            else if (key === 'deal_amount') { valA = a.deal_amount; valB = b.deal_amount; }
            else if (key === 'risk_level') {
                const levels: Record<string, number> = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
                valA = levels[a.risk_level] || 0;
                valB = levels[b.risk_level] || 0;
            }
            else if (key === 'risk_reason') { valA = a.risk_reason; valB = b.risk_reason; }
            else if (key === 'confidence') { valA = a.confidence; valB = b.confidence; }
            else if (key === 'evaluation_date') {
                valA = a.evaluation_date ? new Date(a.evaluation_date).getTime() : 0;
                valB = b.evaluation_date ? new Date(b.evaluation_date).getTime() : 0;
            }
            else if (key === 'escalation_target') { valA = a.escalation_target; valB = b.escalation_target; }
            else if (key === 'pipeline') {
                valA = PIPELINE_MAP[a.pipeline as string] || a.pipeline;
                valB = PIPELINE_MAP[b.pipeline as string] || b.pipeline;
            }
            else if (key === 'owner_name') { valA = a.owner_name; valB = b.owner_name; }
            else { valA = (a as unknown as Record<string, unknown>)[key]; valB = (b as unknown as Record<string, unknown>)[key]; }

            // Nulls to bottom
            if (valA == null && valB == null) return 0;
            if (valA == null) return 1;
            if (valB == null) return -1;

            let cmp = 0;
            if (typeof valA === 'number' && typeof valB === 'number') cmp = valA - valB;
            else cmp = String(valA).localeCompare(String(valB));

            return sortConfig.direction === 'asc' ? cmp : -cmp;
        });
    }, [evaluations, filterPipeline, filterRisk, filterReason, filterOwner, sortConfig]);

    // Summary counts from filtered results
    const counts = useMemo(() => {
        const c = { total: 0, high: 0, medium: 0, low: 0 };
        for (const e of filteredAndSorted) {
            c.total++;
            if (e.risk_level === 'HIGH') c.high++;
            else if (e.risk_level === 'MEDIUM') c.medium++;
            else if (e.risk_level === 'LOW') c.low++;
        }
        return c;
    }, [filteredAndSorted]);

    const hasActiveFilters = filterPipeline || filterRisk || filterReason || filterOwner;

    function toggleRiskFilter(level: string) {
        setFilterRisk(filterRisk === level ? '' : level);
    }

    return (
        <div className="animate-in">
            {/* Summary Cards */}
            <div className="summary-grid">
                <div
                    className={`summary-card total ${!filterRisk ? 'active' : ''}`}
                    onClick={() => setFilterRisk('')}
                >
                    <div className="summary-card-label">Total Lost Deals</div>
                    <div className="summary-card-value">{counts.total}</div>
                </div>
                <div
                    className={`summary-card high ${filterRisk === 'HIGH' ? 'active' : ''}`}
                    onClick={() => toggleRiskFilter('HIGH')}
                >
                    <div className="summary-card-label">High Risk at Loss</div>
                    <div className="summary-card-value">{counts.high}</div>
                </div>
                <div
                    className={`summary-card medium ${filterRisk === 'MEDIUM' ? 'active' : ''}`}
                    onClick={() => toggleRiskFilter('MEDIUM')}
                >
                    <div className="summary-card-label">Medium Risk at Loss</div>
                    <div className="summary-card-value">{counts.medium}</div>
                </div>
                <div
                    className={`summary-card low ${filterRisk === 'LOW' ? 'active' : ''}`}
                    onClick={() => toggleRiskFilter('LOW')}
                >
                    <div className="summary-card-label">Low Risk at Loss</div>
                    <div className="summary-card-value">{counts.low}</div>
                </div>
            </div>

            {/* Deals Table */}
            <div className="table-container">
                <div className="table-header">
                    <h2>Lost Deal Learnings</h2>
                    {hasActiveFilters && (
                        <button
                            className="btn btn-sm"
                            onClick={() => {
                                setFilterPipeline('');
                                setFilterRisk('');
                                setFilterReason('');
                                setFilterOwner('');
                            }}
                        >
                            ✕ Clear Filters
                        </button>
                    )}
                </div>

                {/* Filters */}
                <div className="filter-row">
                    <select
                        className="filter-select"
                        value={filterPipeline}
                        onChange={(e) => setFilterPipeline(e.target.value)}
                    >
                        <option value="">All Pipelines</option>
                        {pipelines.map(p => (
                            <option key={p} value={p}>{PIPELINE_MAP[p] || p}</option>
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
                        value={filterOwner}
                        onChange={(e) => setFilterOwner(e.target.value)}
                    >
                        <option value="">All Owners</option>
                        {owners.map(o => (
                            <option key={o} value={o}>{o}</option>
                        ))}
                    </select>

                    {hasActiveFilters && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {filteredAndSorted.length} of {evaluations.length} deals
                        </span>
                    )}
                </div>

                {error ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">⚙️</div>
                        <h3>Error</h3>
                        <p>{error}</p>
                    </div>
                ) : filteredAndSorted.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📉</div>
                        <h3>{hasActiveFilters ? 'No matching lost deals' : 'No lost deals found'}</h3>
                        <p>{hasActiveFilters ? 'Try adjusting the filters.' : 'No deals have moved to Closed Lost yet.'}</p>
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <SortableHeader label="Deal Name" sortKey="deal_name" currentSort={sortConfig} onSort={(k) => setSortConfig(nextSort(sortConfig, k))} />
                                <SortableHeader label="Amount" sortKey="deal_amount" currentSort={sortConfig} onSort={(k) => setSortConfig(nextSort(sortConfig, k))} />
                                <SortableHeader label="Pipeline" sortKey="pipeline" currentSort={sortConfig} onSort={(k) => setSortConfig(nextSort(sortConfig, k))} />
                                <SortableHeader label="Owner" sortKey="owner_name" currentSort={sortConfig} onSort={(k) => setSortConfig(nextSort(sortConfig, k))} />
                                <SortableHeader label="Risk Level" sortKey="risk_level" currentSort={sortConfig} onSort={(k) => setSortConfig(nextSort(sortConfig, k))} />
                                <SortableHeader label="Primary Risk" sortKey="risk_reason" currentSort={sortConfig} onSort={(k) => setSortConfig(nextSort(sortConfig, k))} />
                                <th>Explanation</th>
                                <SortableHeader label="Confidence" sortKey="confidence" currentSort={sortConfig} onSort={(k) => setSortConfig(nextSort(sortConfig, k))} />
                                <SortableHeader label="Escalation" sortKey="escalation_target" currentSort={sortConfig} onSort={(k) => setSortConfig(nextSort(sortConfig, k))} />
                                <SortableHeader label="Date Lost" sortKey="evaluation_date" currentSort={sortConfig} onSort={(k) => setSortConfig(nextSort(sortConfig, k))} />
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAndSorted.map((evaluation) => (
                                <tr
                                    key={`${evaluation.deal_id}-${evaluation.id}`}
                                    className="clickable-row"
                                    onClick={() => window.open(`/deals/${evaluation.deal_id}`, '_blank')}
                                >
                                    <td className="deal-name">
                                        <Link
                                            href={`/deals/${evaluation.deal_id}`}
                                            target="_blank"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {evaluation.deal_name || evaluation.deal_id}
                                        </Link>
                                    </td>
                                    <td>{formatAmount(evaluation.deal_amount)}</td>
                                    <td style={{ fontSize: '12px' }}>{PIPELINE_MAP[evaluation.pipeline as string] || evaluation.pipeline || '—'}</td>
                                    <td style={{ fontSize: '12px' }}>{evaluation.owner_name || '—'}</td>
                                    <td><RiskBadge level={evaluation.risk_level} /></td>
                                    <td style={{ textTransform: 'capitalize' }}>
                                        {evaluation.risk_reason?.replace(/_/g, ' ') || '—'}
                                    </td>
                                    <td>
                                        <div className="explanation-cell" title={evaluation.explanation}>
                                            {evaluation.explanation || '—'}
                                        </div>
                                    </td>
                                    <td><ConfidenceBar score={evaluation.confidence} /></td>
                                    <td style={{ textTransform: 'capitalize' }}>
                                        {evaluation.escalation_target === 'exec' ? '🚨 Exec' :
                                            evaluation.escalation_target === 'manager' ? '👔 Manager' :
                                                '👤 AE'}
                                    </td>
                                    <td style={{ fontSize: '12px' }}>
                                        {formatDate(evaluation.evaluation_date)}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <a
                                                href={`https://app.hubspot.com/contacts/9154210/record/0-3/${evaluation.deal_id}/`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-sm"
                                                title="Open in HubSpot"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                🔗
                                            </a>
                                        </div>
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
