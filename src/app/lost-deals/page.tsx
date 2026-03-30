// ============================================================
// Lost Deal Learnings — Server Component
// ============================================================

export const dynamic = 'force-dynamic';

import { getLostDealEvaluations } from '@/db/queries';
import { RiskEvaluation } from '@/lib/types';
import { LostDealsView } from './lost-deals-client';

async function getLostDealsData() {
  try {
    const evaluations = await getLostDealEvaluations();

    const pipelines = [...new Set(evaluations.map(e => e.pipeline).filter(Boolean))] as string[];
    const riskReasons = [...new Set(evaluations.map(e => e.risk_reason).filter(Boolean))] as string[];
    const owners = [...new Set(evaluations.map(e => e.owner_name).filter(Boolean))] as string[];

    pipelines.sort();
    riskReasons.sort();
    owners.sort();

    return { evaluations, pipelines, riskReasons, owners, error: null };
  } catch {
    return {
      evaluations: [] as RiskEvaluation[],
      pipelines: [] as string[],
      riskReasons: [] as string[],
      owners: [] as string[],
      error: 'Failed to load lost deals. Check your database connection.',
    };
  }
}

export default async function LostDealsPage() {
  const { evaluations, pipelines, riskReasons, owners, error } = await getLostDealsData();

  return (
    <LostDealsView
      evaluations={evaluations}
      pipelines={pipelines}
      riskReasons={riskReasons}
      owners={owners}
      error={error}
    />
  );
}
