// ============================================================
// Auth API — Shared Password Login / Logout
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

const AUTH_PASSWORD = process.env.AUTH_PASSWORD ?? '';

function makeToken(password: string): string {
    // Simple deterministic token so middleware can verify the cookie value.
    // Not a real security measure — just prevents trivially guessing the cookie.
    const encoder = new TextEncoder();
    const data = encoder.encode(password + '__deal_risk_salt__');
    let hash = 0;
    for (const byte of data) {
        hash = ((hash << 5) - hash + byte) | 0;
    }
    return Math.abs(hash).toString(36);
}

// POST — Login
export async function POST(req: NextRequest) {
    try {
        const { password } = await req.json();

        if (!AUTH_PASSWORD) {
            return NextResponse.json(
                { error: 'AUTH_PASSWORD not configured on server' },
                { status: 500 }
            );
        }

        if (password !== AUTH_PASSWORD) {
            return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
        }

        const token = makeToken(AUTH_PASSWORD);
        const res = NextResponse.json({ ok: true });

        res.cookies.set('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 7 days
        });

        return res;
    } catch {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}

// DELETE — Logout
export async function DELETE() {
    const res = NextResponse.json({ ok: true });
    res.cookies.set('auth_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
    });
    return res;
}
