// ============================================================
// Auth Middleware — Neon Auth route protection
// ============================================================

import { auth } from '@/lib/auth/server';
import { isEmailDomainAllowed } from '@/lib/allowed-domains';
import { NextRequest, NextResponse } from 'next/server';

const API_PATHS = ['/api'];
const STATIC_PREFIXES = ['/_next', '/favicon.ico'];

const authMiddleware = auth.middleware({ loginUrl: '/login' });

export default async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow API routes and static assets through without auth
    if (
        API_PATHS.some(p => pathname.startsWith(p)) ||
        STATIC_PREFIXES.some(p => pathname.startsWith(p)) ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    // Skip middleware for Server Actions
    if (request.headers.has('Next-Action')) return;

    const authResponse = await authMiddleware(request);

    // If auth middleware redirected (e.g. to login), pass through
    if (authResponse.headers.get('location')) return authResponse;

    // Check email domain restriction for authenticated users
    if (pathname !== '/login') {
        const { data: session } = await auth.getSession();
        if (session?.user?.email && !isEmailDomainAllowed(session.user.email)) {
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            url.searchParams.set('error', 'domain');
            return NextResponse.redirect(url);
        }
    }

    return authResponse;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
