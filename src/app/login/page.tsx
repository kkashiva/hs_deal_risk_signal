'use client';

// ============================================================
// Login Page — Google OAuth via Neon Auth
// ============================================================

import { useState } from 'react';
import Image from 'next/image';
import { authClient } from '@/lib/auth/client';

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleGoogleSignIn() {
        setError('');
        setLoading(true);

        try {
            await authClient.signIn.social({
                provider: 'google',
                callbackURL: '/',
            });
        } catch {
            setError('Sign-in failed. Please try again.');
            setLoading(false);
        }
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-brand">
                    <Image
                        src="/riverside.svg"
                        alt="Riverside.fm"
                        width={149}
                        height={24}
                        style={{ height: '24px', width: 'auto' }}
                        priority
                    />
                    <h1>Deal Risk Engine</h1>
                    <p>Sign in to continue</p>
                </div>

                {error && <div className="login-error">{error}</div>}

                <button
                    type="button"
                    className="btn btn-primary login-btn"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
                        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
                        <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
                        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 3.58Z" fill="#EA4335"/>
                    </svg>
                    {loading ? 'Redirecting...' : 'Sign in with Google'}
                </button>
            </div>
        </div>
    );
}
