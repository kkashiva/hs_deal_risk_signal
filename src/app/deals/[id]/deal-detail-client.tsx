'use client';

// ============================================================
// Deal Detail Client Component — Rescan Button
// ============================================================

import { useState } from 'react';

export function DealDetailClient({ dealId }: { dealId: string }) {
    const [scanning, setScanning] = useState(false);

    async function rescanDeal() {
        setScanning(true);

        try {
            const res = await fetch(`/api/deals/${dealId}`, {
                method: 'POST',
            });
            const data = await res.json();

            if (data.success) {
                window.location.reload();
            } else {
                alert(`Rescan failed: ${data.error}`);
            }
        } catch (error) {
            alert(`Error: ${error instanceof Error ? error.message : 'Unknown'}`);
        } finally {
            setScanning(false);
        }
    }

    return (
        <button
            className="btn btn-primary"
            onClick={rescanDeal}
            disabled={scanning}
        >
            {scanning ? '⏳ Scanning...' : '🔄 Re-scan Deal'}
        </button>
    );
}
