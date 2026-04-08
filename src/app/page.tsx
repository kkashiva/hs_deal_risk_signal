// ============================================================
// Dashboard Page — Risk Overview (Server Component)
// ============================================================

export const dynamic = 'force-dynamic';

import {
  getLatestEvaluations,
  getRiskCounts,
  getDistinctPipelines,
  getDistinctRiskReasons,
  getDistinctStages,
  getDistinctOwners,
} from '@/db/queries';
import { RiskEvaluation } from '@/lib/types';
import { DashboardView } from './dashboard-client';

async function getDashboardData() {
  try {
    const [evaluations, counts, pipelines, riskReasons, stages, owners] = await Promise.all([
      getLatestEvaluations({}),
      getRiskCounts(),
      getDistinctPipelines(),
      getDistinctRiskReasons(),
      getDistinctStages(),
      getDistinctOwners(),
    ]);
    return { evaluations, counts, pipelines, riskReasons, stages, owners, error: null };
  } catch {
    return {
      evaluations: [] as RiskEvaluation[],
      counts: {
        total: 0, high: 0, medium: 0, low: 0,
        pipelineBreakdown: { total: {}, high: {}, medium: {}, low: {} }
      },
      pipelines: [] as string[],
      riskReasons: [] as string[],
      stages: [] as string[],
      owners: [] as string[],
      error: 'Database not connected. Run the migration and set DATABASE_URL.',
    };
  }
}

export default async function DashboardPage() {
  const { evaluations, counts, pipelines, riskReasons, stages, owners, error } = await getDashboardData();

  return (
    <DashboardView
      evaluations={evaluations}
      counts={counts}
      pipelines={pipelines}
      riskReasons={riskReasons}
      stages={stages}
      owners={owners}
      error={error}
    />
  );
}
