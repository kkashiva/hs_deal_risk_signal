// ============================================================
// Scan Runs API Route — Cron Execution History
// ============================================================

import { NextResponse } from 'next/server';
import { getRecentScanRuns } from '@/db/queries';

export async function GET() {
    try {
        const runs = await getRecentScanRuns(20);

        return NextResponse.json({
            runs,
            total: runs.length,
        });
    } catch (error) {
        console.error('Error fetching scan runs:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
