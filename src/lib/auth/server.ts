import { createNeonAuth } from '@neondatabase/auth/next/server';

// Placeholder values allow `next build` to succeed without env vars.
// Auth routes will fail at runtime if real values aren't provided.
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL ?? 'https://placeholder.neonauth.example.com',
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET ?? 'build-placeholder-secret-must-be-32-chars!',
  },
});
