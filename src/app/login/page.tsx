'use client';

// ============================================================
// Login Page — Shared Password Gate
// ============================================================

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });

            if (res.ok) {
                router.push('/');
                router.refresh();
            } else {
                const data = await res.json();
                setError(data.error || 'Authentication failed');
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="login-page">
            <form className="login-card" onSubmit={handleSubmit}>
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
                    <p>Enter password to continue</p>
                </div>

                <div className="login-field">
                    <input
                        id="login-password"
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoFocus
                        autoComplete="current-password"
                    />
                </div>

                {error && <div className="login-error">{error}</div>}

                <button
                    id="login-submit"
                    type="submit"
                    className="btn btn-primary login-btn"
                    disabled={loading || !password}
                >
                    {loading ? 'Verifying…' : 'Enter'}
                </button>
            </form>
        </div>
    );
}
