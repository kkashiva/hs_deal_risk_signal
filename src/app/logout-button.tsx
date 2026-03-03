'use client';

import { useRouter, usePathname } from 'next/navigation';

export function LogoutButton() {
    const router = useRouter();
    const pathname = usePathname();

    // Don't show logout button on the login page
    if (pathname === '/login') return null;

    async function handleLogout() {
        await fetch('/api/auth', { method: 'DELETE' });
        router.push('/login');
        router.refresh();
    }

    return (
        <button className="btn btn-sm btn-danger" onClick={handleLogout}>
            🔒 Logout
        </button>
    );
}
