// ============================================================
// Dashboard Page — Risk Overview (Server Component)
// ============================================================

export const dynamic = 'force-dynamic';

import {
  getLatestEvaluations,
  getRiskCounts,
  getDistinctPipelines,
  getDistinctRiskReasons,
  getDistinctStages
} from '@/db/queries';
import { RiskEvaluation } from '@/lib/types';
import { DashboardView } from './dashboard-client';

async function getDashboardData() {
  try {
    const [evaluations, counts, pipelines, riskReasons, stages] = await Promise.all([
      getLatestEvaluations({ limit: 200 }),
      getRiskCounts(),
      getDistinctPipelines(),
      getDistinctRiskReasons(),
      getDistinctStages(),
    ]);
    return { evaluations, counts, pipelines, riskReasons, stages, error: null };
  } catch {
    return {
      evaluations: [] as RiskEvaluation[],
      counts: { total: 0, high: 0, medium: 0, low: 0 },
      pipelines: [] as string[],
      riskReasons: [] as string[],
      stages: [] as string[],
      error: 'Database not connected. Run the migration and set DATABASE_URL.',
    };
  }
}

export default async function DashboardPage() {
  const { evaluations, counts, pipelines, riskReasons, stages, error } = await getDashboardData();

  return (
    <DashboardView
      evaluations={evaluations}
      counts={counts}
      pipelines={pipelines}
      riskReasons={riskReasons}
      stages={stages}
      error={error}
    />
  );
}
