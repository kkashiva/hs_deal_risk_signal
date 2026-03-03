// ============================================================
// Cron API Route — Daily Risk Scan
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { runRiskScan } from '@/lib/risk-engine';
import { ensureCustomProperties } from '@/lib/hubspot';

export const maxDuration = 300; // 5 minutes (up to 900 on Vercel Pro)

export async function GET(request: NextRequest) {
    // Validate cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Ensure custom HubSpot properties exist
        await ensureCustomProperties();

        // Check for single deal mode or pipeline filter (for testing)
        const dealId = request.nextUrl.searchParams.get('deal_id') || undefined;
        const pipelineId = request.nextUrl.searchParams.get('pipeline_id') || undefined;

        // Run the risk scan
        const result = await runRiskScan(dealId, pipelineId);

        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error('Risk scan failed:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
