'use client';

import { usePathname } from 'next/navigation';
import { authClient } from '@/lib/auth/client';

export function LogoutButton() {
    const pathname = usePathname();
    const { data: session } = authClient.useSession();

    // Don't show logout button on the login page
    if (pathname === '/login') return null;

    async function handleLogout() {
        await authClient.signOut();
        window.location.href = '/login';
    }

    const email = session?.user?.email;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {email && (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {email}
                </span>
            )}
            <button className="btn btn-sm btn-danger" onClick={handleLogout}>
                Logout
            </button>
        </div>
    );
}
