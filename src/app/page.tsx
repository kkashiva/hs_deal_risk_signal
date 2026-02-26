// ============================================================
// Dashboard Page — Risk Overview (Server Component)
// ============================================================

import { getLatestEvaluations, getRiskCounts, getDistinctPipelines, getDistinctRiskReasons } from '@/db/queries';
import { RiskEvaluation } from '@/lib/types';
import { DashboardView } from './dashboard-client';

async function getDashboardData() {
  try {
    const [evaluations, counts, pipelines, riskReasons] = await Promise.all([
      getLatestEvaluations({ limit: 200 }),
      getRiskCounts(),
      getDistinctPipelines(),
      getDistinctRiskReasons(),
    ]);
    return { evaluations, counts, pipelines, riskReasons, error: null };
  } catch {
    return {
      evaluations: [] as RiskEvaluation[],
      counts: { total: 0, high: 0, medium: 0, low: 0 },
      pipelines: [] as string[],
      riskReasons: [] as string[],
      error: 'Database not connected. Run the migration and set DATABASE_URL.',
    };
  }
}

export default async function DashboardPage() {
  const { evaluations, counts, pipelines, riskReasons, error } = await getDashboardData();

  return (
    <DashboardView
      evaluations={evaluations}
      counts={counts}
      pipelines={pipelines}
      riskReasons={riskReasons}
      error={error}
    />
  );
}
