// ============================================================
// Deal Detail Page — Risk History + Deal Metadata + Engagement Metrics
// ============================================================

import { getEvaluationsForDeal } from '@/db/queries';
import Link from 'next/link';
import { RiskEvaluation, DealActivityMetrics } from '@/lib/types';
import { fetchDeal, fetchDealEngagements, computeActivityMetrics } from '@/lib/hubspot';
import { DealDetailClient } from './deal-detail-client';

interface PageProps {
    params: Promise<{ id: string }>;
}

// Helper to format days-ago safely
function formatDaysAgo(days: number | null | undefined): string {
    if (days === null || days === undefined) return '—';
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
}

export default async function DealDetailPage({ params }: PageProps) {
    const { id } = await params;

    let evaluations: RiskEvaluation[] = [];
    let error: string | null = null;

    try {
        evaluations = await getEvaluationsForDeal(id);
    } catch {
        error = 'Failed to load deal data. Check your database connection.';
    }

    const latest = evaluations.length > 0 ? evaluations[0] : null;

    // Fetch live deal metadata + engagement metrics from HubSpot
    let dealProps: Record<string, string | null | undefined> | null = null;
    let metrics: DealActivityMetrics | null = null;
    try {
        const deal = await fetchDeal(id);
        if (deal) {
            dealProps = deal.properties;
            const engagements = await fetchDealEngagements(id);
            metrics = computeActivityMetrics(engagements);
        }
    } catch (e) {
        console.error('Failed to fetch HubSpot data for deal page:', e);
    }

    const riskEmoji = !latest ? '—' :
        latest.risk_level === 'HIGH' ? '🔴' :
            latest.risk_level === 'MEDIUM' ? '🟡' : '🟢';

    return (
        <div className="animate-in">
            {/* Header */}
            <div className="detail-header">
                <div>
                    <Link href="/" style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'none' }}>
                        ← Back to Dashboard
                    </Link>
                    <h1 className="detail-title" style={{ marginTop: '8px' }}>
                        {dealProps?.dealname || latest?.deal_name || `Deal ${id}`}
                    </h1>
                    <p className="detail-subtitle">
                        Deal ID: {id} · {evaluations.length} evaluation{evaluations.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <DealDetailClient dealId={id} />
                    <a
                        href={`https://app.hubspot.com/contacts/9154210/record/0-3/${id}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn"
                    >
                        📋 View in HubSpot
                    </a>
                </div>
            </div>

            {error ? (
                <div className="empty-state">
                    <div className="empty-state-icon">⚙️</div>
                    <h3>Error</h3>
                    <p>{error}</p>
                </div>
            ) : (
                <>
                    {/* ── Deal Metadata + Engagement Metrics ── */}
                    {dealProps && (
                        <div className="detail-grid" style={{ marginBottom: '24px' }}>
                            {/* Deal Metadata Card */}
                            <div className="detail-card">
                                <h3>Deal Metadata</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <div className="detail-label">Amount</div>
                                        <div className="detail-value">
                                            {dealProps.amount ? `$${Number(dealProps.amount).toLocaleString()}` : '—'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="detail-label">MRR</div>
                                        <div className="detail-value">
                                            {dealProps.mrr ? `$${Number(dealProps.mrr).toLocaleString()}` : '—'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="detail-label">Stage</div>
                                        <div className="detail-value" style={{ textTransform: 'capitalize' }}>
                                            {dealProps.dealstage?.replace(/_/g, ' ') || '—'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="detail-label">Pipeline</div>
                                        <div className="detail-value">{dealProps.pipeline || '—'}</div>
                                    </div>
                                    <div>
                                        <div className="detail-label">Close Date</div>
                                        <div className="detail-value">
                                            {dealProps.closedate
                                                ? new Date(dealProps.closedate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                : '—'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="detail-label">Created</div>
                                        <div className="detail-value">
                                            {dealProps.createdate
                                                ? new Date(dealProps.createdate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                : '—'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="detail-label">Forecast Category</div>
                                        <div className="detail-value" style={{ textTransform: 'capitalize' }}>
                                            {(dealProps.hs_manual_forecast_category || dealProps.hs_forecast_category)?.replace(/_/g, ' ') || '—'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="detail-label">Contacts</div>
                                        <div className="detail-value">{dealProps.num_associated_contacts || '0'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Engagement Metrics Card */}
                            {metrics && (
                                <div className="detail-card">
                                    <h3>Engagement Metrics</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div>
                                            <div className="detail-label">Total Emails</div>
                                            <div className="detail-value">{metrics.totalEmails}</div>
                                        </div>
                                        <div>
                                            <div className="detail-label">Total Meetings</div>
                                            <div className="detail-value">{metrics.totalMeetings}</div>
                                        </div>
                                        <div>
                                            <div className="detail-label">Total Calls</div>
                                            <div className="detail-value">{metrics.totalCalls}</div>
                                        </div>
                                        <div>
                                            <div className="detail-label">Total Notes</div>
                                            <div className="detail-value">{metrics.totalNotes}</div>
                                        </div>
                                        <div>
                                            <div className="detail-label">Last Activity</div>
                                            <div className="detail-value">{formatDaysAgo(metrics.daysSinceLastActivity)}</div>
                                        </div>
                                        <div>
                                            <div className="detail-label">Last Meeting</div>
                                            <div className="detail-value">{formatDaysAgo(metrics.daysSinceLastMeeting)}</div>
                                        </div>
                                        <div>
                                            <div className="detail-label">Avg Reply Time</div>
                                            <div className="detail-value" style={{
                                                color: metrics.avgEmailReplyTimeHours !== null && metrics.avgEmailReplyTimeHours > 48
                                                    ? 'var(--risk-high)' : undefined
                                            }}>
                                                {metrics.avgEmailReplyTimeHours !== null ? `${metrics.avgEmailReplyTimeHours}h` : '—'}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="detail-label">Meeting Cadence</div>
                                            <div className="detail-value" style={{
                                                color: metrics.avgDaysBetweenMeetings !== null && metrics.avgDaysBetweenMeetings > 14
                                                    ? 'var(--risk-medium)' : undefined
                                            }}>
                                                {metrics.avgDaysBetweenMeetings !== null ? `Every ${metrics.avgDaysBetweenMeetings}d` : '—'}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="detail-label">Meeting No-Shows</div>
                                            <div className="detail-value" style={{
                                                color: metrics.meetingNoShows > 0 ? 'var(--risk-medium)' : undefined
                                            }}>
                                                {metrics.meetingNoShows}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="detail-label">Avg Activity Gap</div>
                                            <div className="detail-value">
                                                {metrics.avgDaysBetweenActivities !== null ? `${metrics.avgDaysBetweenActivities}d` : '—'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── AI Risk Assessment ── */}
                    {!latest ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📊</div>
                            <h3>No evaluations yet</h3>
                            <p>This deal hasn&apos;t been scanned yet. Click &quot;Re-scan Deal&quot; to run an analysis.</p>
                        </div>
                    ) : (
                        <>
                            {/* Current Risk Summary */}
                            <div className="detail-grid">
                                <div className="detail-card">
                                    <h3>Current Risk Assessment</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div>
                                            <div className="detail-label">Risk Level</div>
                                            <div className="detail-value">
                                                <span className={`risk-badge ${latest.risk_level.toLowerCase()}`}>
                                                    {riskEmoji} {latest.risk_level}
                                                </span>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="detail-label">Confidence</div>
                                            <div className="detail-value">{latest.confidence}%</div>
                                        </div>
                                        <div>
                                            <div className="detail-label">Primary Risk</div>
                                            <div className="detail-value" style={{ textTransform: 'capitalize' }}>
                                                {latest.risk_reason?.replace(/_/g, ' ')}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="detail-label">Escalation</div>
                                            <div className="detail-value" style={{ textTransform: 'capitalize' }}>
                                                {latest.escalation_target === 'exec' ? '🚨 Exec/Cofounder' :
                                                    latest.escalation_target === 'manager' ? '👔 Sales Manager' :
                                                        '👤 AE'}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="detail-label">Amount</div>
                                            <div className="detail-value">
                                                {latest.deal_amount
                                                    ? `$${Number(latest.deal_amount).toLocaleString()}`
                                                    : '—'}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="detail-label">Model Used</div>
                                            <div className="detail-value">{latest.model_used} ({latest.prompt_version})</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="detail-card">
                                    <h3>AI Analysis</h3>
                                    <div className="detail-label">Explanation</div>
                                    <p style={{ marginBottom: '16px' }}>{latest.explanation}</p>
                                    <div className="detail-label">Recommended Action</div>
                                    <p style={{ color: 'var(--accent-hover)', fontWeight: 500 }}>
                                        {latest.recommended_action}
                                    </p>
                                </div>
                            </div>

                            {/* Evaluation History */}
                            <div className="table-container">
                                <div className="table-header">
                                    <h2>Evaluation History</h2>
                                </div>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Risk Level</th>
                                            <th>Risk Reason</th>
                                            <th>Confidence</th>
                                            <th>Model</th>
                                            <th>Explanation</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {evaluations.map((evaluation) => (
                                            <tr key={evaluation.id}>
                                                <td>
                                                    {evaluation.evaluation_date
                                                        ? new Date(evaluation.evaluation_date).toLocaleDateString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })
                                                        : '—'}
                                                </td>
                                                <td>
                                                    <span className={`risk-badge ${evaluation.risk_level.toLowerCase()}`}>
                                                        {evaluation.risk_level === 'HIGH' ? '🔴' :
                                                            evaluation.risk_level === 'MEDIUM' ? '🟡' : '🟢'}{' '}
                                                        {evaluation.risk_level}
                                                    </span>
                                                </td>
                                                <td style={{ textTransform: 'capitalize' }}>
                                                    {evaluation.risk_reason?.replace(/_/g, ' ')}
                                                </td>
                                                <td>{evaluation.confidence}%</td>
                                                <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                    {evaluation.model_used}
                                                </td>
                                                <td style={{ maxWidth: '300px', fontSize: '12px' }}>
                                                    {evaluation.explanation.substring(0, 150)}
                                                    {evaluation.explanation.length > 150 ? '...' : ''}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
