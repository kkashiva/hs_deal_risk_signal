'use client';

// ============================================================
// Dashboard Client — Filters, Table, Scan Trigger
// ============================================================

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { RiskEvaluation, RiskCounts } from '@/lib/types';
import { PIPELINE_MAP, STAGE_MAP, getNormalizedStage } from '@/lib/mappings';

interface DashboardViewProps {
    evaluations: RiskEvaluation[];
    counts: RiskCounts;
    pipelines: string[];
    riskReasons: string[];
    stages: string[];
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


function CustomDatePicker({ value, onChange, placeholder, align = 'left' }: { value: string, onChange: (val: string) => void, placeholder: string, align?: 'left' | 'right' }) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const daysOfWeek = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Days from previous month to fill the first row
    const prevMonthDays = [];
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
        prevMonthDays.push(daysInPrevMonth - i);
    }

    const currentMonthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const changeMonth = (offset: number) => {
        setViewDate(new Date(year, month + offset, 1));
    };

    const handleSelect = (day: number) => {
        // Create date string manually to avoid timezone/UTC shift issues
        const yyyy = year;
        const mm = String(month + 1).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        const formatted = `${yyyy}-${mm}-${dd}`;
        onChange(formatted);
        setIsOpen(false);
    };

    const isToday = (day: number) => {
        const today = new Date();
        return today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
    };

    const isSelected = (day: number) => {
        if (!value) return false;
        const sel = new Date(value);
        return sel.getDate() === day && sel.getMonth() === month && sel.getFullYear() === year;
    };

    const displayDate = value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : placeholder;

    return (
        <div className="date-picker-container" ref={containerRef}>
            <div
                className={`date-picker-input-fallback ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span>{displayDate}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
            </div>

            {isOpen && (
                <>
                    <div className={`calendar-modal ${align === 'right' ? 'align-right' : ''}`}>
                        <div className="calendar-header">
                            <button className="calendar-nav-btn" onClick={() => changeMonth(-1)}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="15 18 9 12 15 6"></polyline>
                                </svg>
                            </button>
                            <div className="calendar-title">{months[month]} {year}</div>
                            <button className="calendar-nav-btn" onClick={() => changeMonth(1)}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                            </button>
                        </div>
                        <div className="calendar-grid">
                            {daysOfWeek.map(d => (
                                <div key={d} className="calendar-weekday">{d}</div>
                            ))}
                            {prevMonthDays.map(d => (
                                <div key={`prev-${d}`} className="calendar-day other-month">{d}</div>
                            ))}
                            {currentMonthDays.map(d => (
                                <div
                                    key={d}
                                    className={`calendar-day ${isToday(d) ? 'today' : ''} ${isSelected(d) ? 'selected' : ''}`}
                                    onClick={() => handleSelect(d)}
                                >
                                    {d}
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function PipelineBreakdown({ breakdown }: { breakdown: Record<string, number> }) {
    if (!breakdown || Object.keys(breakdown).length === 0) return null;

    return (
        <div className="summary-card-breakdown">
            {Object.entries(breakdown).map(([id, count]) => {
                if (count === 0) return null;
                const label = PIPELINE_MAP[id] || id;
                // Shorten labels for breakdown items
                const shortLabel = label.replace(' New Sales', '');
                return (
                    <div key={id} className="breakdown-item">
                        <span className="breakdown-label">{shortLabel}</span>
                        <span className="breakdown-count">{count}</span>
                    </div>
                );
            })}
        </div>
    );
}


export function DashboardView({
    evaluations,
    counts,
    pipelines,
    riskReasons,
    stages,
    error,
}: DashboardViewProps) {
    const [scanning, setScanning] = useState(false);
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [filterPipeline, setFilterPipeline] = useState('');
    const [filterRisk, setFilterRisk] = useState('');
    const [filterReason, setFilterReason] = useState('');
    const [filterStage, setFilterStage] = useState('');
    const [filterAmountMin, setFilterAmountMin] = useState<string>('');
    const [filterAmountMax, setFilterAmountMax] = useState<string>('');
    const [filterCloseMin, setFilterCloseMin] = useState('');
    const [filterCloseMax, setFilterCloseMax] = useState('');

    // Load filters from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('hs_deal_risk_filters');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.pipeline) setFilterPipeline(parsed.pipeline);
                if (parsed.risk) setFilterRisk(parsed.risk);
                if (parsed.reason) setFilterReason(parsed.reason);
                if (parsed.stage) setFilterStage(parsed.stage);
                if (parsed.amountMin) setFilterAmountMin(parsed.amountMin);
                if (parsed.amountMax) setFilterAmountMax(parsed.amountMax);
                if (parsed.closeMin) setFilterCloseMin(parsed.closeMin);
                if (parsed.closeMax) setFilterCloseMax(parsed.closeMax);
            } catch (e) {
                console.error('Failed to parse saved filters', e);
            }
        }
    }, []);

    // Save filters to localStorage
    useEffect(() => {
        const filters = {
            pipeline: filterPipeline,
            risk: filterRisk,
            reason: filterReason,
            stage: filterStage,
            amountMin: filterAmountMin,
            amountMax: filterAmountMax,
            closeMin: filterCloseMin,
            closeMax: filterCloseMax,
        };
        localStorage.setItem('hs_deal_risk_filters', JSON.stringify(filters));
    }, [filterPipeline, filterRisk, filterReason, filterStage, filterAmountMin, filterAmountMax, filterCloseMin, filterCloseMax]);

    // Filter evaluations client-side and normalize stages
    const filteredEvaluations = useMemo(() => {
        return evaluations.filter((e: RiskEvaluation) => {
            if (filterPipeline && e.pipeline !== filterPipeline) return false;
            if (filterRisk && e.risk_level !== filterRisk) return false;
            if (filterReason && e.risk_reason !== filterReason) return false;

            const rawStage = (e.deal_metadata as Record<string, unknown>)?.stage as string | undefined;
            const normalizedStage = getNormalizedStage(rawStage, e.pipeline);
            if (filterStage && normalizedStage !== filterStage) return false;

            const amount = e.deal_amount || 0;
            if (filterAmountMin && amount < Number(filterAmountMin)) return false;
            if (filterAmountMax && amount > Number(filterAmountMax)) return false;

            const closeDate = (e.deal_metadata as Record<string, unknown>)?.close_date as string | undefined;
            if (closeDate) {
                const closeTs = new Date(closeDate).getTime();
                if (filterCloseMin && closeTs < new Date(filterCloseMin).getTime()) return false;
                if (filterCloseMax && closeTs > new Date(filterCloseMax).getTime() + 86400000) return false;
            } else if (filterCloseMin || filterCloseMax) {
                return false;
            }

            return true;
        });
    }, [evaluations, filterPipeline, filterRisk, filterReason, filterStage, filterAmountMin, filterAmountMax, filterCloseMin, filterCloseMax]);

    // Unique normalized stages for the filter dropdown
    const uniqueNormalizedStages = useMemo(() => {
        const set = new Set<string>();
        // Only add stages from the actual evaluations (which are already filtered to be open)
        evaluations.forEach(e => {
            const rawStage = (e.deal_metadata as Record<string, unknown>)?.stage as string | undefined;
            const normalized = getNormalizedStage(rawStage, e.pipeline);
            if (normalized) {
                // Explicitly exclude closed stages just in case
                const lower = normalized.toLowerCase();
                if (!lower.includes('closed won') && !lower.includes('closed lost')) {
                    set.add(normalized);
                }
            }
        });
        return Array.from(set).sort();
    }, [evaluations]);

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

    async function triggerDealScan(dealId: string) {
        setActionLoading(dealId);
        try {
            const res = await fetch(`/api/deals/${dealId}`, { method: 'POST' });
            if (res.ok) {
                setTimeout(() => window.location.reload(), 500);
            } else {
                alert('Scan failed');
            }
        } catch {
            alert('Error running scan');
        } finally {
            setActionLoading(null);
        }
    }

    const hasActiveFilters = filterPipeline || filterRisk || filterReason || filterStage || filterAmountMin || filterAmountMax || filterCloseMin || filterCloseMax;

    function toggleRiskFilter(level: string) {
        if (filterRisk === level) {
            setFilterRisk('');
        } else {
            setFilterRisk(level);
        }
    }

    return (
        <div className="animate-in">
            {/* Summary Cards */}
            <div className="summary-grid">
                <div
                    className={`summary-card total ${!filterRisk ? 'active' : ''}`}
                    onClick={() => setFilterRisk('')}
                >
                    <div className="summary-card-label">Total Deals Scanned</div>
                    <div className="summary-card-value">{counts.total}</div>
                    <PipelineBreakdown breakdown={counts.pipelineBreakdown.total} />
                </div>
                <div
                    className={`summary-card high ${filterRisk === 'HIGH' ? 'active' : ''}`}
                    onClick={() => toggleRiskFilter('HIGH')}
                >
                    <div className="summary-card-label">High Risk</div>
                    <div className="summary-card-value">{counts.high}</div>
                    <PipelineBreakdown breakdown={counts.pipelineBreakdown.high} />
                </div>
                <div
                    className={`summary-card medium ${filterRisk === 'MEDIUM' ? 'active' : ''}`}
                    onClick={() => toggleRiskFilter('MEDIUM')}
                >
                    <div className="summary-card-label">Medium Risk</div>
                    <div className="summary-card-value">{counts.medium}</div>
                    <PipelineBreakdown breakdown={counts.pipelineBreakdown.medium} />
                </div>
                <div
                    className={`summary-card low ${filterRisk === 'LOW' ? 'active' : ''}`}
                    onClick={() => toggleRiskFilter('LOW')}
                >
                    <div className="summary-card-label">Low Risk</div>
                    <div className="summary-card-value">{counts.low}</div>
                    <PipelineBreakdown breakdown={counts.pipelineBreakdown.low} />
                </div>
            </div>

            {/* Scan Trigger */}
            <div style={{ display: 'none', marginBottom: '24px', alignItems: 'center', gap: '16px' }}>
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
                                setFilterStage('');
                                setFilterAmountMin('');
                                setFilterAmountMax('');
                                setFilterCloseMin('');
                                setFilterCloseMax('');
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
                        value={filterStage}
                        onChange={(e) => setFilterStage(e.target.value)}
                    >
                        <option value="">All Stages</option>
                        {uniqueNormalizedStages.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>

                    <div className="filter-amount-group">
                        <span className="filter-label">Amount:</span>
                        <input
                            type="number"
                            className="filter-input"
                            placeholder="Min $"
                            value={filterAmountMin}
                            onChange={(e) => setFilterAmountMin(e.target.value)}
                        />
                        <span className="filter-separator">-</span>
                        <input
                            type="number"
                            className="filter-input"
                            placeholder="Max $"
                            value={filterAmountMax}
                            onChange={(e) => setFilterAmountMax(e.target.value)}
                        />
                    </div>

                    <div className="filter-amount-group">
                        <span className="filter-label">Close:</span>
                        <CustomDatePicker
                            value={filterCloseMin}
                            onChange={setFilterCloseMin}
                            placeholder="From"
                        />
                        <span className="filter-separator">-</span>
                        <CustomDatePicker
                            value={filterCloseMax}
                            onChange={setFilterCloseMax}
                            placeholder="To"
                            align="right"
                        />
                    </div>

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
                                <th>Stage</th>
                                <th>Risk Level</th>
                                <th>Primary Risk</th>
                                <th>Confidence</th>
                                <th>Escalation</th>
                                <th>Last Scanned</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEvaluations.map((evaluation: RiskEvaluation) => (
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
                                    <td style={{ fontSize: '12px' }}>{getNormalizedStage((evaluation.deal_metadata as Record<string, unknown>)?.stage as string, evaluation.pipeline) || '—'}</td>
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
                                    <td style={{ fontSize: '12px' }}>
                                        {formatDate(evaluation.evaluation_date)}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                className="btn btn-sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    triggerDealScan(evaluation.deal_id);
                                                }}
                                                title="Re-run Scan"
                                                disabled={actionLoading === evaluation.deal_id}
                                            >
                                                {actionLoading === evaluation.deal_id ? '⏳' : '🔄'}
                                            </button>
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
