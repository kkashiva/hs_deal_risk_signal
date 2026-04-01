// ============================================================
// Deal Detail API Route — History + Rescan
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getEvaluationsForDeal } from '@/db/queries';
import { runRiskScan } from '@/lib/risk-engine';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const evaluations = await getEvaluationsForDeal(id);

        return NextResponse.json({
            deal_id: id,
            evaluations,
            total: evaluations.length,
        });
    } catch (error) {
        console.error('Error fetching deal:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

// Manual rescan for a single deal
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const user = await getCurrentUser().catch(() => null);
        const userId = user?.userId ?? request.nextUrl.searchParams.get('user_id') ?? null;
        const result = await runRiskScan(id, undefined, 'manual', userId);

        return NextResponse.json({
            success: true,
            deal_id: id,
            ...result,
        });
    } catch (error) {
        console.error('Error rescanning deal:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
