'use client';

// ============================================================
// Deal Detail Client Component — Rescan Button
// ============================================================

import { useState } from 'react';
import { authClient } from '@/lib/auth/client';

export function DealDetailClient({ dealId }: { dealId: string }) {
    const [scanning, setScanning] = useState(false);

    async function rescanDeal() {
        setScanning(true);

        try {
            let url = `/api/deals/${dealId}`;
            try {
                const { data: session } = await authClient.getSession();
                if (session?.user?.id) url += `?user_id=${session.user.id}`;
            } catch { /* proceed without user attribution */ }

            const res = await fetch(url, {
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
