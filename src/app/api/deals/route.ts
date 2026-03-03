// ============================================================
// Deals API Route — List with Filters
// ============================================================

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getLatestEvaluations, getRiskCounts } from '@/db/queries';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const riskLevel = searchParams.get('risk_level') || undefined;
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        const [evaluations, counts] = await Promise.all([
            getLatestEvaluations({ riskLevel, limit, offset }),
            getRiskCounts(),
        ]);

        return NextResponse.json({
            evaluations,
            counts,
            pagination: { limit, offset },
        });
    } catch (error) {
        console.error('Error fetching deals:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
