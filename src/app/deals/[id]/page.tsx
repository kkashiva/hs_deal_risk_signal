// ============================================================
// Deal Detail Page — Risk History
// ============================================================

import { getEvaluationsForDeal } from '@/db/queries';
import Link from 'next/link';
import { RiskEvaluation } from '@/lib/types';
import { DealDetailClient } from './deal-detail-client';

interface PageProps {
    params: Promise<{ id: string }>;
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
                        {latest?.deal_name || `Deal ${id}`}
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
            ) : !latest ? (
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
        </div>
    );
}
