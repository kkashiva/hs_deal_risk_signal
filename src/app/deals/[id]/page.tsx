// ============================================================
// Deal Detail Page — Risk History + Deal Metadata + Engagement Metrics
// ============================================================

export const dynamic = 'force-dynamic';

import { getEvaluationsForDeal } from '@/db/queries';
import Link from 'next/link';
import { RiskEvaluation, DealActivityMetrics } from '@/lib/types';
import { PIPELINE_MAP, getNormalizedStage } from '@/lib/mappings';
import { DealDetailClient } from './deal-detail-client';
import { ChatPanel } from './chat-panel';
import ReactMarkdown from 'react-markdown';

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

    // Read deal metadata + engagement metrics from the latest evaluation (persisted during scan)
    const dealMeta = latest?.deal_metadata as Record<string, unknown> | null | undefined;
    const metrics = (latest?.engagement_metrics as DealActivityMetrics | null | undefined) ?? null;

    const riskEmoji = !latest ? '—' :
        latest.risk_level === 'HIGH' ? '🔴' :
            latest.risk_level === 'MEDIUM' ? '🟡' : '🟢';

    return (
        <div className="animate-in">
            {/* Minimal Header */}
            <div style={{ marginBottom: '24px' }}>
                <Link href="/" style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'none' }}>
                    ← Back to Dashboard
                </Link>
                <h1 className="detail-title" style={{ marginTop: '8px' }}>
                    {(dealMeta?.deal_name as string) || latest?.deal_name || `Deal ${id}`}
                </h1>
                <p className="detail-subtitle">Deal ID: {id}</p>
            </div>

            {error ? (
                <div className="empty-state">
                    <div className="empty-state-icon">⚙️</div>
                    <h3>Error</h3>
                    <p>{error}</p>
                </div>
            ) : (
                <>
                    {/* Sticky Summary Bar */}
                    {latest && (
                        <div className="summary-bar-container">
                            <div className="summary-bar">
                                <div className="summary-bar-stats">
                                    <div className="summary-item">
                                        <div className="summary-label">Risk Level</div>
                                        <div className="summary-value">
                                            <span className={`risk-badge ${latest.risk_level.toLowerCase()}`}>
                                                {riskEmoji} {latest.risk_level}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="summary-item">
                                        <div className="summary-label">Confidence</div>
                                        <div className="summary-value">{latest.confidence}%</div>
                                    </div>
                                    <div className="summary-item">
                                        <div className="summary-label">Primary Driver</div>
                                        <div className="summary-value" style={{ textTransform: 'capitalize' }}>
                                            {latest.risk_reason?.replace(/_/g, ' ')}
                                        </div>
                                    </div>
                                    <div className="summary-item">
                                        <div className="summary-label">Escalation</div>
                                        <div className="summary-value" style={{ textTransform: 'capitalize' }}>
                                            {latest.escalation_target === 'exec' ? '🚨 Exec' :
                                                latest.escalation_target === 'manager' ? '👔 Manager' :
                                                    '👤 AE'}
                                        </div>
                                    </div>
                                    <div className="summary-item">
                                        <div className="summary-label">Last Scan</div>
                                        <div className="summary-value">
                                            {latest.evaluation_date
                                                ? new Date(latest.evaluation_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                                : '—'}
                                        </div>
                                    </div>
                                </div>
                                <div className="summary-actions">
                                    <DealDetailClient dealId={id} />
                                    <a
                                        href={`https://app.hubspot.com/contacts/9154210/record/0-3/${id}/`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn"
                                    >
                                        📋 HubSpot
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}

                    {!latest ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📊</div>
                            <h3>No evaluations yet</h3>
                            <p>This deal hasn&apos;t been scanned yet. Click &quot;Re-scan Deal&quot; to run an analysis.</p>
                            <div style={{ marginTop: '24px' }}>
                                <DealDetailClient dealId={id} />
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Full-Width AI Analysis Section */}
                            <div className="ai-analysis-card">
                                <div className="ai-analysis-title">
                                    <span>🧠</span> AI Risk Analysis
                                </div>
                                <div className="ai-analysis-grid">
                                    <div className="ai-explanation">
                                        <div className="detail-label" style={{ marginBottom: '8px' }}>Detailed Explanation</div>
                                        <div className="markdown-content">
                                            <ReactMarkdown>{latest.explanation}</ReactMarkdown>
                                        </div>
                                    </div>
                                    <div className="recommended-action-box">
                                        <h4>Recommended Action</h4>
                                        <div className="recommended-action-text markdown-content">
                                            <ReactMarkdown>{latest.recommended_action}</ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '24px' }}>
                                    <div>
                                        <span className="detail-label">Amount: </span>
                                        <span className="detail-value">{latest.deal_amount ? `$${Number(latest.deal_amount).toLocaleString()}` : '—'}</span>
                                    </div>
                                    <div>
                                        <span className="detail-label">Model: </span>
                                        <span className="detail-value" style={{ fontSize: '12px' }}>{latest.model_used} ({latest.prompt_version})</span>
                                    </div>
                                </div>

                                {/* Shared Source Breakdown */}
                                {(latest.deal_analysis || latest.email_analysis || latest.transcript_analysis) && (
                                    <div className="analysis-sources-container">
                                        <div className="analysis-sources-title">
                                            🔍 Analysis Source Breakdown
                                        </div>
                                        <div className="analysis-sources-grid">
                                            {latest.deal_analysis && (
                                                <div className="analysis-source-card">
                                                    <div className="analysis-source-header">
                                                        <span>📂</span> Deal Metadata Analysis
                                                    </div>
                                                    <div className="analysis-source-content markdown-content">
                                                        <ReactMarkdown>{latest.deal_analysis}</ReactMarkdown>
                                                    </div>
                                                </div>
                                            )}
                                            {latest.email_analysis && (
                                                <div className="analysis-source-card">
                                                    <div className="analysis-source-header">
                                                        <span>📧</span> Email Communication Analysis
                                                    </div>
                                                    <div className="analysis-source-content markdown-content">
                                                        <ReactMarkdown>{latest.email_analysis}</ReactMarkdown>
                                                    </div>
                                                </div>
                                            )}
                                            {latest.transcript_analysis && (
                                                <div className="analysis-source-card">
                                                    <div className="analysis-source-header">
                                                        <span>🎙️</span> Call Transcript Analysis
                                                    </div>
                                                    <div className="analysis-source-content markdown-content">
                                                        <ReactMarkdown>{latest.transcript_analysis}</ReactMarkdown>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Data Grid: Metadata + Metrics */}
                            <div className="detail-grid">
                                {/* Deal Metadata Card */}
                                {dealMeta && (
                                    <div className="detail-card">
                                        <h3>Deal Metadata</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                            <div>
                                                <div className="detail-label">MRR</div>
                                                <div className="detail-value">
                                                    {dealMeta.mrr ? `$${Number(dealMeta.mrr).toLocaleString()}` : '—'}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="detail-label">Stage</div>
                                                <div className="detail-value">
                                                    {getNormalizedStage(dealMeta.stage as string, latest.pipeline)}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="detail-label">Pipeline</div>
                                                <div className="detail-value">{PIPELINE_MAP[latest.pipeline as string] || String(dealMeta.pipeline || '—')}</div>
                                            </div>
                                            <div>
                                                <div className="detail-label">Close Date</div>
                                                <div className="detail-value">
                                                    {dealMeta.close_date
                                                        ? new Date(String(dealMeta.close_date)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                        : '—'}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="detail-label">Days in Stage</div>
                                                <div className="detail-value">{String(dealMeta.days_in_stage ?? '—')}</div>
                                            </div>
                                            <div>
                                                <div className="detail-label">Forecast Category</div>
                                                <div className="detail-value" style={{ textTransform: 'capitalize' }}>
                                                    {String(dealMeta.forecast_category || '—').replace(/_/g, ' ')}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="detail-label">Contacts</div>
                                                <div className="detail-value">{String(dealMeta.num_contacts ?? '0')}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Engagement Metrics Card */}
                                {metrics && (
                                    <div className="detail-card">
                                        <h3>Engagement Metrics</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                            <div>
                                                <div className="detail-label">Last Activity</div>
                                                <div className="detail-value">{formatDaysAgo(metrics.daysSinceLastActivity)}</div>
                                            </div>
                                            <div>
                                                <div className="detail-label">Last Meeting</div>
                                                <div className="detail-value">{formatDaysAgo(metrics.daysSinceLastMeeting)}</div>
                                            </div>
                                            <div>
                                                <div className="detail-label">Emails / Calls</div>
                                                <div className="detail-value">{metrics.totalEmails} / {metrics.totalCalls}</div>
                                            </div>
                                            <div>
                                                <div className="detail-label">Meetings / Notes</div>
                                                <div className="detail-value">{metrics.totalMeetings} / {metrics.totalNotes}</div>
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
                                        </div>
                                    </div>
                                )}
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
                                                <td style={{ maxWidth: '400px', fontSize: '12px' }}>
                                                    {evaluation.explanation.substring(0, 120)}
                                                    {evaluation.explanation.length > 120 ? '...' : ''}
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

            {/* AI Chat Panel — only when evaluation exists */}
            {latest && (
                <ChatPanel
                    dealId={id}
                    riskReason={latest.risk_reason}
                    riskLevel={latest.risk_level}
                />
            )}
        </div>
    );
}
