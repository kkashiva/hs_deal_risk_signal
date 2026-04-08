'use client';

// ============================================================
// Dashboard Client — Filters, Table, Scan Trigger
// ============================================================

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { RiskEvaluation, RiskCounts } from '@/lib/types';
import { PIPELINE_MAP, STAGE_MAP, getNormalizedStage } from '@/lib/mappings';
import { authClient } from '@/lib/auth/client';
import type {
    DashboardView,
    DashboardViewsState,
} from '@/lib/views';
import {
    MAX_VIEWS,
    loadViews,
    saveViews,
    createBlankView,
} from '@/lib/views';

const OPTIONAL_COLUMNS = [
    { id: 'days_in_stage', label: 'Days in Stage', source: 'metadata' },
    { id: 'days_since_creation', label: 'Days Created', source: 'metadata' },
    { id: 'close_date', label: 'Close Date', source: 'metadata' },
    { id: 'forecast_category', label: 'Forecast', source: 'metadata' },
    { id: 'owner_name', label: 'Owner', source: 'direct' },
    { id: 'risk_type_change_date', label: 'Risk Level Changed', source: 'direct' },
    { id: 'num_contacts', label: 'Contacts', source: 'metadata' },
    { id: 'totalEmails', label: 'Emails', source: 'metrics' },
    { id: 'totalMeetings', label: 'Meetings', source: 'metrics' },
    { id: 'totalCalls', label: 'Calls', source: 'metrics' },
    { id: 'totalNotes', label: 'Notes', source: 'metrics' },
    { id: 'daysSinceLastActivity', label: 'Days Since Activity', source: 'metrics' },
    { id: 'daysSinceLastMeeting', label: 'Days Since Meeting', source: 'metrics' },
    { id: 'meetingNoShows', label: 'Meeting No Shows', source: 'metrics' },
    { id: 'avgDaysBetweenActivities', label: 'Average Activity Gap', source: 'metrics' },
    { id: 'avgEmailReplyTimeHours', label: 'Average Reply Time (Hours)', source: 'metrics' },
    { id: 'avgDaysBetweenMeetings', label: 'Average Meeting Gap', source: 'metrics' },
] as const;

type SortConfig = {
    key: string;
    direction: 'asc' | 'desc';
};

function SortIcon({ active, direction }: { active: boolean, direction: 'asc' | 'desc' }) {
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

function SortableHeader({ label, sortKey, currentSort, onSort }: { label: string, sortKey: string, currentSort: SortConfig, onSort: (key: string) => void }) {
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

interface DashboardViewProps {
    evaluations: RiskEvaluation[];
    counts: RiskCounts;
    pipelines: string[];
    riskReasons: string[];
    stages: string[];
    owners: string[];
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

function MultiSelect({ options, selected, onChange, placeholder, renderLabel }: {
    options: string[];
    selected: string[];
    onChange: (val: string[]) => void;
    placeholder: string;
    renderLabel?: (val: string) => string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => { document.removeEventListener('mousedown', handleClickOutside); };
    }, [isOpen]);

    const toggle = (val: string) => {
        if (selected.includes(val)) {
            onChange(selected.filter(v => v !== val));
        } else {
            onChange([...selected, val]);
        }
    };

    const label = renderLabel || ((v: string) => v);

    return (
        <div className="multi-select-container" ref={containerRef}>
            <button
                className={`filter-select multi-select-trigger ${selected.length > 0 ? 'has-selection' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                type="button"
            >
                <span className="multi-select-label">
                    {selected.length === 0
                        ? placeholder
                        : selected.length === 1
                            ? label(selected[0])
                            : `${selected.length} selected`}
                </span>
                {selected.length > 0 && (
                    <span
                        className="multi-select-clear"
                        onClick={(e) => { e.stopPropagation(); onChange([]); }}
                        title="Clear"
                    >
                        ×
                    </span>
                )}
            </button>
            {isOpen && (
                <div className="multi-select-dropdown">
                    {options.map(opt => (
                        <label key={opt} className="multi-select-option">
                            <input
                                type="checkbox"
                                checked={selected.includes(opt)}
                                onChange={() => toggle(opt)}
                            />
                            <span>{label(opt)}</span>
                        </label>
                    ))}
                </div>
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
    owners,
    error,
}: DashboardViewProps) {
    const [scanning, setScanning] = useState(false);
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [isColumnEditorOpen, setIsColumnEditorOpen] = useState(false);
    const columnEditorRef = useRef<HTMLDivElement>(null);

    // ---- Views state ----
    const [viewsState, setViewsState] = useState<DashboardViewsState | null>(null);
    const [editingViewId, setEditingViewId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const renameInputRef = useRef<HTMLInputElement>(null);

    // Load views from localStorage (with legacy migration)
    useEffect(() => {
        setViewsState(loadViews());
    }, []);

    // Persist views to localStorage on every change
    useEffect(() => {
        if (viewsState) saveViews(viewsState);
    }, [viewsState]);

    // Focus rename input when editing
    useEffect(() => {
        if (editingViewId && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [editingViewId]);

    // ---- Derived active view ----
    const activeView = useMemo(() => {
        if (!viewsState) return null;
        return viewsState.views.find(v => v.id === viewsState.activeViewId) || viewsState.views[0];
    }, [viewsState]);

    // Convenience accessors
    const filterPipeline = activeView?.filters.pipeline ?? [];
    const filterRisk = activeView?.filters.risk ?? '';
    const filterReason = activeView?.filters.reason ?? '';
    const filterStage = activeView?.filters.stage ?? [];
    const filterOwner = activeView?.filters.owner ?? [];
    const filterAmountMin = activeView?.filters.amountMin ?? '';
    const filterAmountMax = activeView?.filters.amountMax ?? '';
    const filterCloseMin = activeView?.filters.closeMin ?? '';
    const filterCloseMax = activeView?.filters.closeMax ?? '';
    const filterRiskChangeMin = activeView?.filters.riskChangeMin ?? '';
    const filterRiskChangeMax = activeView?.filters.riskChangeMax ?? '';
    const filterSearch = activeView?.filters.search ?? '';
    const visibleColumns = activeView?.columns ?? [];
    const sortConfig: SortConfig = activeView?.sort ?? { key: 'evaluation_date', direction: 'desc' };

    // ---- View mutation helpers ----
    const updateActiveView = useCallback((updater: (view: DashboardView) => DashboardView) => {
        setViewsState(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                views: prev.views.map(v =>
                    v.id === prev.activeViewId ? updater(v) : v
                ),
            };
        });
    }, []);

    const setFilterPipeline = (val: string[]) => updateActiveView(v => ({ ...v, filters: { ...v.filters, pipeline: val } }));
    const setFilterRisk = (val: string) => updateActiveView(v => ({ ...v, filters: { ...v.filters, risk: val } }));
    const setFilterReason = (val: string) => updateActiveView(v => ({ ...v, filters: { ...v.filters, reason: val } }));
    const setFilterStage = (val: string[]) => updateActiveView(v => ({ ...v, filters: { ...v.filters, stage: val } }));
    const setFilterOwner = (val: string[]) => updateActiveView(v => ({ ...v, filters: { ...v.filters, owner: val } }));
    const setFilterAmountMin = (val: string) => updateActiveView(v => ({ ...v, filters: { ...v.filters, amountMin: val } }));
    const setFilterAmountMax = (val: string) => updateActiveView(v => ({ ...v, filters: { ...v.filters, amountMax: val } }));
    const setFilterCloseMin = (val: string) => updateActiveView(v => ({ ...v, filters: { ...v.filters, closeMin: val } }));
    const setFilterCloseMax = (val: string) => updateActiveView(v => ({ ...v, filters: { ...v.filters, closeMax: val } }));
    const setFilterRiskChangeMin = (val: string) => updateActiveView(v => ({ ...v, filters: { ...v.filters, riskChangeMin: val } }));
    const setFilterRiskChangeMax = (val: string) => updateActiveView(v => ({ ...v, filters: { ...v.filters, riskChangeMax: val } }));
    const setFilterSearch = (val: string) => updateActiveView(v => ({ ...v, filters: { ...v.filters, search: val } }));
    const setVisibleColumns = (cols: string[]) => updateActiveView(v => ({ ...v, columns: cols }));
    const setSortConfig = (s: SortConfig) => updateActiveView(v => ({ ...v, sort: s }));

    // ---- View CRUD ----
    // ---- Pagination state ----
    const [currentPage, setCurrentPage] = useState(0);
    const PAGE_SIZE = 50;

    const switchView = (id: string) => {
        setViewsState(prev => prev ? { ...prev, activeViewId: id } : prev);
        setCurrentPage(0);
    };

    const addView = () => {
        setViewsState(prev => {
            if (!prev || prev.views.length >= MAX_VIEWS) return prev;
            const newView = createBlankView(`View ${prev.views.length + 1}`);
            return { views: [...prev.views, newView], activeViewId: newView.id };
        });
    };

    const deleteView = (id: string) => {
        setViewsState(prev => {
            if (!prev || prev.views.length <= 1) return prev;
            const remaining = prev.views.filter(v => v.id !== id);
            const newActive = prev.activeViewId === id ? remaining[0].id : prev.activeViewId;
            return { views: remaining, activeViewId: newActive };
        });
    };

    const startRenaming = (id: string, currentName: string) => {
        setEditingViewId(id);
        setEditingName(currentName);
    };

    const commitRename = () => {
        if (!editingViewId) return;
        const trimmed = editingName.trim();
        if (trimmed) {
            setViewsState(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    views: prev.views.map(v =>
                        v.id === editingViewId ? { ...v, name: trimmed } : v
                    ),
                };
            });
        }
        setEditingViewId(null);
    };

    // Close column editor on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (columnEditorRef.current && !columnEditorRef.current.contains(event.target as Node)) {
                setIsColumnEditorOpen(false);
            }
        }
        if (isColumnEditorOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isColumnEditorOpen]);

    // Filter and Sort evaluations client-side and normalize stages
    const filteredAndSortedEvaluations = useMemo(() => {
        const filtered = evaluations.filter((e: RiskEvaluation) => {
            if (filterSearch && !e.deal_name?.toLowerCase().includes(filterSearch.toLowerCase())) return false;
            if (filterPipeline.length > 0 && (!e.pipeline || !filterPipeline.includes(e.pipeline))) return false;
            if (filterRisk && e.risk_level !== filterRisk) return false;
            if (filterReason && e.risk_reason !== filterReason) return false;

            const rawStage = (e.deal_metadata as Record<string, unknown>)?.stage as string | undefined;
            const normalizedStage = getNormalizedStage(rawStage, e.pipeline);
            if (filterStage.length > 0 && (!normalizedStage || !filterStage.includes(normalizedStage))) return false;

            if (filterOwner.length > 0 && (!e.owner_name || !filterOwner.includes(e.owner_name))) return false;

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

            const riskChangeDate = e.risk_type_change_date;
            if (riskChangeDate) {
                const riskChangeTs = new Date(riskChangeDate).getTime();
                if (filterRiskChangeMin && riskChangeTs < new Date(filterRiskChangeMin).getTime()) return false;
                if (filterRiskChangeMax && riskChangeTs > new Date(filterRiskChangeMax).getTime() + 86400000) return false;
            } else if (filterRiskChangeMin || filterRiskChangeMax) {
                return false;
            }

            return true;
        });

        // Sort
        return [...filtered].sort((a, b) => {
            const key = sortConfig.key;
            let valA: any;
            let valB: any;

            // Handle specific keys or source lookups
            const optionalCol = OPTIONAL_COLUMNS.find(c => c.id === key);
            if (optionalCol) {
                if (optionalCol.source === 'direct') {
                    valA = (a as any)?.[key];
                    valB = (b as any)?.[key];
                } else if (optionalCol.source === 'metadata') {
                    valA = (a.deal_metadata as any)?.[key];
                    valB = (b.deal_metadata as any)?.[key];
                } else {
                    valA = (a.engagement_metrics as any)?.[key];
                    valB = (b.engagement_metrics as any)?.[key];
                }
            } else {
                // Default columns
                if (key === 'deal_name') {
                    valA = a.deal_name;
                    valB = b.deal_name;
                } else if (key === 'deal_amount') {
                    valA = a.deal_amount;
                    valB = b.deal_amount;
                } else if (key === 'stage') {
                    valA = getNormalizedStage((a.deal_metadata as any)?.stage, a.pipeline);
                    valB = getNormalizedStage((b.deal_metadata as any)?.stage, b.pipeline);
                } else if (key === 'risk_level') {
                    const levels = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
                    valA = levels[a.risk_level] || 0;
                    valB = levels[b.risk_level] || 0;
                } else if (key === 'evaluation_date') {
                    valA = new Date(a.evaluation_date || 0).getTime();
                    valB = new Date(b.evaluation_date || 0).getTime();
                } else {
                    valA = (a as any)[key];
                    valB = (b as any)[key];
                }
            }

            // Always push nulls/undefined to the bottom regardless of direction
            const isNullA = valA === null || valA === undefined || valA === '—';
            const isNullB = valB === null || valB === undefined || valB === '—';
            if (isNullA && isNullB) return 0;
            if (isNullA) return 1;
            if (isNullB) return -1;

            // Force date comparison for date columns
            if (key === 'risk_type_change_date' || key === 'close_date') {
                valA = new Date(valA).getTime();
                valB = new Date(valB).getTime();
            }

            // Force numeric comparison for specific keys
            const isNumeric = key === 'deal_amount' || key === 'confidence' || optionalCol?.source === 'metrics' || key === 'days_in_stage' || key === 'days_since_creation' || key === 'num_contacts';
            if (isNumeric) {
                valA = Number(valA);
                valB = Number(valB);
            }

            if (valA === valB) return 0;
            const comparison = valA < valB ? -1 : 1;
            return sortConfig.direction === 'asc' ? comparison : -comparison;
        });
    }, [evaluations, filterSearch, filterPipeline, filterRisk, filterReason, filterStage, filterOwner, filterAmountMin, filterAmountMax, filterCloseMin, filterCloseMax, filterRiskChangeMin, filterRiskChangeMax, sortConfig]);

    // Derive counts from the currently filtered evaluations so summary cards reflect active filters/view
    const filteredCounts = useMemo((): RiskCounts => {
        const breakdown: RiskCounts['pipelineBreakdown'] = { total: {}, high: {}, medium: {}, low: {} };
        let high = 0, medium = 0, low = 0;
        for (const e of filteredAndSortedEvaluations) {
            const level = e.risk_level?.toLowerCase() as 'high' | 'medium' | 'low';
            const pipeline = e.pipeline ?? 'unknown';
            if (level === 'high') high++;
            else if (level === 'medium') medium++;
            else if (level === 'low') low++;
            breakdown.total[pipeline] = (breakdown.total[pipeline] || 0) + 1;
            if (level === 'high' || level === 'medium' || level === 'low') {
                breakdown[level][pipeline] = (breakdown[level][pipeline] || 0) + 1;
            }
        }
        return { total: filteredAndSortedEvaluations.length, high, medium, low, pipelineBreakdown: breakdown };
    }, [filteredAndSortedEvaluations]);

    // ---- Pagination: reset page when filters/sort change ----
    const filterFingerprint = useMemo(() =>
        JSON.stringify([filterSearch, filterPipeline, filterRisk, filterReason, filterStage, filterOwner, filterAmountMin, filterAmountMax, filterCloseMin, filterCloseMax, filterRiskChangeMin, filterRiskChangeMax, sortConfig]),
        [filterSearch, filterPipeline, filterRisk, filterReason, filterStage, filterOwner, filterAmountMin, filterAmountMax, filterCloseMin, filterCloseMax, filterRiskChangeMin, filterRiskChangeMax, sortConfig]
    );
    useEffect(() => { setCurrentPage(0); }, [filterFingerprint]);

    const totalPages = Math.max(1, Math.ceil(filteredAndSortedEvaluations.length / PAGE_SIZE));
    const safeCurrentPage = Math.min(currentPage, totalPages - 1);
    const paginatedEvaluations = filteredAndSortedEvaluations.slice(
        safeCurrentPage * PAGE_SIZE,
        (safeCurrentPage + 1) * PAGE_SIZE
    );

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
            const params = new URLSearchParams({ source: 'manual' });
            try {
                const { data: session } = await authClient.getSession();
                if (session?.user?.id) params.set('user_id', session.user.id);
            } catch { /* proceed without user attribution */ }

            const res = await fetch(`/api/cron/risk-scan?${params}`, {
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

    const hasActiveFilters = filterSearch || filterPipeline.length > 0 || filterRisk || filterReason || filterStage.length > 0 || filterOwner.length > 0 || filterAmountMin || filterAmountMax || filterCloseMin || filterCloseMax || filterRiskChangeMin || filterRiskChangeMax;

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
                    <div className="summary-card-value">{filteredCounts.total}</div>
                    <PipelineBreakdown breakdown={filteredCounts.pipelineBreakdown.total} />
                </div>
                <div
                    className={`summary-card high ${filterRisk === 'HIGH' ? 'active' : ''}`}
                    onClick={() => toggleRiskFilter('HIGH')}
                >
                    <div className="summary-card-label">High Risk</div>
                    <div className="summary-card-value">{filteredCounts.high}</div>
                    <PipelineBreakdown breakdown={filteredCounts.pipelineBreakdown.high} />
                </div>
                <div
                    className={`summary-card medium ${filterRisk === 'MEDIUM' ? 'active' : ''}`}
                    onClick={() => toggleRiskFilter('MEDIUM')}
                >
                    <div className="summary-card-label">Medium Risk</div>
                    <div className="summary-card-value">{filteredCounts.medium}</div>
                    <PipelineBreakdown breakdown={filteredCounts.pipelineBreakdown.medium} />
                </div>
                <div
                    className={`summary-card low ${filterRisk === 'LOW' ? 'active' : ''}`}
                    onClick={() => toggleRiskFilter('LOW')}
                >
                    <div className="summary-card-label">Low Risk</div>
                    <div className="summary-card-value">{filteredCounts.low}</div>
                    <PipelineBreakdown breakdown={filteredCounts.pipelineBreakdown.low} />
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

            {/* Deals Table — with View Tabs */}
            <div className="table-container">
                {/* View Tabs */}
                {viewsState && (
                    <div className="view-tabs-bar">
                        {viewsState.views.map(view => (
                            <div
                                key={view.id}
                                className={`view-tab ${view.id === viewsState.activeViewId ? 'active' : ''}`}
                                onClick={() => switchView(view.id)}
                                onDoubleClick={() => startRenaming(view.id, view.name)}
                                title="Double-click to rename"
                            >
                                {editingViewId === view.id ? (
                                    <input
                                        ref={renameInputRef}
                                        className="view-tab-name-input"
                                        value={editingName}
                                        onChange={e => setEditingName(e.target.value)}
                                        onBlur={commitRename}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') commitRename();
                                            if (e.key === 'Escape') setEditingViewId(null);
                                        }}
                                        onClick={e => e.stopPropagation()}
                                        maxLength={24}
                                    />
                                ) : (
                                    <span className="view-tab-name">{view.name}</span>
                                )}
                                {viewsState.views.length > 1 && (
                                    <button
                                        className="view-tab-close"
                                        onClick={e => {
                                            e.stopPropagation();
                                            deleteView(view.id);
                                        }}
                                        title="Delete view"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        ))}
                        <button
                            className="view-tab-add"
                            onClick={addView}
                            disabled={viewsState.views.length >= MAX_VIEWS}
                            title={viewsState.views.length >= MAX_VIEWS ? `Max ${MAX_VIEWS} views` : 'Add new view'}
                        >
                            +
                        </button>
                    </div>
                )}

                <div className="table-header">
                    <h2>Deal Risk Evaluations</h2>
                    {hasActiveFilters && (
                        <button
                            className="btn btn-sm"
                            onClick={() => {
                                setFilterPipeline([]);
                                setFilterRisk('');
                                setFilterReason('');
                                setFilterStage([]);
                                setFilterOwner([]);
                                setFilterAmountMin('');
                                setFilterAmountMax('');
                                setFilterCloseMin('');
                                setFilterCloseMax('');
                                setFilterRiskChangeMin('');
                                setFilterRiskChangeMax('');
                                setFilterSearch('');
                            }}
                        >
                            ✕ Clear Filters
                        </button>
                    )}
                    <div className="column-editor-container" ref={columnEditorRef}>
                        <button
                            className="btn btn-sm"
                            onClick={() => setIsColumnEditorOpen(!isColumnEditorOpen)}
                        >
                            ⚙️ Edit Columns
                        </button>
                        {isColumnEditorOpen && (
                            <div className="column-dropdown">
                                <h4>Visible Columns</h4>
                                <div className="column-section-title">Metadata</div>
                                <div className="column-list">
                                    {OPTIONAL_COLUMNS.filter(c => c.source === 'metadata' || c.source === 'direct').map(col => (
                                        <label key={col.id} className="column-item">
                                            <input
                                                type="checkbox"
                                                checked={visibleColumns.includes(col.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setVisibleColumns([...visibleColumns, col.id]);
                                                    else setVisibleColumns(visibleColumns.filter(id => id !== col.id));
                                                }}
                                            />
                                            {col.label}
                                        </label>
                                    ))}
                                </div>
                                <div className="column-section-title">Metrics</div>
                                <div className="column-list">
                                    {OPTIONAL_COLUMNS.filter(c => c.source === 'metrics').map(col => (
                                        <label key={col.id} className="column-item">
                                            <input
                                                type="checkbox"
                                                checked={visibleColumns.includes(col.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setVisibleColumns([...visibleColumns, col.id]);
                                                    else setVisibleColumns(visibleColumns.filter(id => id !== col.id));
                                                }}
                                            />
                                            {col.label}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Search Bar */}
                <div className="search-bar-row">
                    <svg className="search-bar-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                    <input
                        type="text"
                        className="search-bar-input"
                        placeholder="Search by deal name..."
                        value={filterSearch}
                        onChange={e => setFilterSearch(e.target.value)}
                    />
                    {filterSearch && (
                        <button className="search-bar-clear" onClick={() => setFilterSearch('')}>✕</button>
                    )}
                </div>

                {/* Filter Dropdowns */}
                <div className="filter-row">
                    <MultiSelect
                        options={pipelines}
                        selected={filterPipeline}
                        onChange={setFilterPipeline}
                        placeholder="All Pipelines"
                        renderLabel={(p) => PIPELINE_MAP[p] || p}
                    />

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

                    <MultiSelect
                        options={uniqueNormalizedStages}
                        selected={filterStage}
                        onChange={setFilterStage}
                        placeholder="All Stages"
                    />

                    <MultiSelect
                        options={owners}
                        selected={filterOwner}
                        onChange={setFilterOwner}
                        placeholder="All Owners"
                    />

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

                    <div className="filter-amount-group">
                        <span className="filter-label">Risk Changed:</span>
                        <CustomDatePicker
                            value={filterRiskChangeMin}
                            onChange={setFilterRiskChangeMin}
                            placeholder="From"
                        />
                        <span className="filter-separator">-</span>
                        <CustomDatePicker
                            value={filterRiskChangeMax}
                            onChange={setFilterRiskChangeMax}
                            placeholder="To"
                            align="right"
                        />
                    </div>

                    {hasActiveFilters && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {filteredAndSortedEvaluations.length} of {evaluations.length} deals
                        </span>
                    )}
                </div>

                {error ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">⚙️</div>
                        <h3>Setup Required</h3>
                        <p>{error}</p>
                    </div>
                ) : filteredAndSortedEvaluations.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">📊</div>
                        <h3>{hasActiveFilters ? 'No matching deals' : 'No evaluations yet'}</h3>
                        <p>{hasActiveFilters ? 'Try adjusting the filters.' : 'Run your first risk scan to see results here.'}</p>
                    </div>
                ) : (
                    <>
                    <table>
                        <thead>
                            <tr>
                                <SortableHeader
                                    label="Deal Name"
                                    sortKey="deal_name"
                                    currentSort={sortConfig}
                                    onSort={(key) => setSortConfig(nextSort(sortConfig, key))}
                                />
                                <SortableHeader
                                    label="Amount"
                                    sortKey="deal_amount"
                                    currentSort={sortConfig}
                                    onSort={(key) => setSortConfig(nextSort(sortConfig, key))}
                                />
                                <SortableHeader
                                    label="Stage"
                                    sortKey="stage"
                                    currentSort={sortConfig}
                                    onSort={(key) => setSortConfig(nextSort(sortConfig, key))}
                                />
                                {visibleColumns.map(colId => {
                                    const col = OPTIONAL_COLUMNS.find(c => c.id === colId);
                                    return (
                                        <SortableHeader
                                            key={colId}
                                            label={col?.label || colId}
                                            sortKey={colId}
                                            currentSort={sortConfig}
                                            onSort={(key) => setSortConfig(nextSort(sortConfig, key))}
                                        />
                                    );
                                })}
                                <SortableHeader
                                    label="Risk Level"
                                    sortKey="risk_level"
                                    currentSort={sortConfig}
                                    onSort={(key) => setSortConfig(nextSort(sortConfig, key))}
                                />
                                <SortableHeader
                                    label="Primary Risk"
                                    sortKey="risk_reason"
                                    currentSort={sortConfig}
                                    onSort={(key) => setSortConfig(nextSort(sortConfig, key))}
                                />
                                <th>Explanation</th>
                                <SortableHeader
                                    label="Confidence"
                                    sortKey="confidence"
                                    currentSort={sortConfig}
                                    onSort={(key) => setSortConfig(nextSort(sortConfig, key))}
                                />
                                <SortableHeader
                                    label="Escalation"
                                    sortKey="escalation_target"
                                    currentSort={sortConfig}
                                    onSort={(key) => setSortConfig(nextSort(sortConfig, key))}
                                />
                                <SortableHeader
                                    label="Last Scanned"
                                    sortKey="evaluation_date"
                                    currentSort={sortConfig}
                                    onSort={(key) => setSortConfig(nextSort(sortConfig, key))}
                                />
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedEvaluations.map((evaluation: RiskEvaluation) => (
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
                                    
                                    {visibleColumns.map(colId => {
                                        const col = OPTIONAL_COLUMNS.find(c => c.id === colId);
                                        let val: any = '—';
                                        if (col?.source === 'direct') {
                                            val = (evaluation as any)?.[col.id];
                                        } else if (col?.source === 'metadata') {
                                            val = (evaluation.deal_metadata as any)?.[col.id];
                                        } else if (col?.source === 'metrics') {
                                            val = (evaluation.engagement_metrics as any)?.[col.id];
                                        }

                                        if (val === null || val === undefined) val = '—';
                                        else if (colId === 'close_date' || colId === 'risk_type_change_date') val = new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                        else if (typeof val === 'number') val = val.toLocaleString();

                                        return <td key={colId} style={{ fontSize: '12px' }}>{val}</td>;
                                    })}

                                    <td><RiskBadge level={evaluation.risk_level} /></td>
                                    <td style={{ textTransform: 'capitalize' }}>
                                        {evaluation.risk_reason?.replace(/_/g, ' ') || '—'}
                                    </td>
                                    <td>
                                        <div 
                                            className="explanation-cell" 
                                            title={evaluation.explanation}
                                        >
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
                    {filteredAndSortedEvaluations.length > PAGE_SIZE && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            borderTop: '1px solid var(--border)',
                            fontSize: '13px',
                            color: 'var(--text-secondary)',
                        }}>
                            <span>
                                Showing {safeCurrentPage * PAGE_SIZE + 1}&ndash;{Math.min((safeCurrentPage + 1) * PAGE_SIZE, filteredAndSortedEvaluations.length)} of {filteredAndSortedEvaluations.length} deals
                            </span>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button className="btn btn-sm" onClick={() => setCurrentPage(0)} disabled={safeCurrentPage === 0}>First</button>
                                <button className="btn btn-sm" onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={safeCurrentPage === 0}>Previous</button>
                                <span>Page {safeCurrentPage + 1} of {totalPages}</span>
                                <button className="btn btn-sm" onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={safeCurrentPage >= totalPages - 1}>Next</button>
                                <button className="btn btn-sm" onClick={() => setCurrentPage(totalPages - 1)} disabled={safeCurrentPage >= totalPages - 1}>Last</button>
                            </div>
                        </div>
                    )}
                </>
                )}
            </div>
        </div>
    );
}
