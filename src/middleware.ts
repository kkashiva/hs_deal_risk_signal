// ============================================================
// Auth Middleware — Neon Auth route protection
// ============================================================

import { auth } from '@/lib/auth/server';
import { NextRequest, NextResponse } from 'next/server';

const CRON_PATHS = ['/api/cron'];
const STATIC_PREFIXES = ['/_next', '/favicon.ico'];

const authMiddleware = auth.middleware({ loginUrl: '/login' });

export default function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow cron API and static assets through without auth
    if (
        CRON_PATHS.some(p => pathname.startsWith(p)) ||
        STATIC_PREFIXES.some(p => pathname.startsWith(p)) ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    // Skip middleware for Server Actions
    if (request.headers.has('Next-Action')) return;

    return authMiddleware(request);
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
