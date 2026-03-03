// ============================================================
// Auth Middleware — Redirect unauthenticated users to /login
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

// Paths that don't require authentication
const PUBLIC_PATHS = ['/login', '/api/auth'];
const STATIC_PREFIXES = ['/_next', '/favicon.ico'];

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Allow public paths & static assets through
    if (
        PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
        STATIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
        pathname.includes('.')  // static files (images, svgs, etc.)
    ) {
        return NextResponse.next();
    }

    // Check for auth cookie
    const token = req.cookies.get('auth_token')?.value;

    if (!token) {
        const loginUrl = req.nextUrl.clone();
        loginUrl.pathname = '/login';
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
