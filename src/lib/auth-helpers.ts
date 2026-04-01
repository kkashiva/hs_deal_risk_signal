import { auth } from '@/lib/auth/server';
import { upsertUserActivity } from '@/db/queries';

const ACTIVITY_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes
const lastActivityUpdate = new Map<string, number>();

export async function getCurrentUser(): Promise<{ userId: string; email: string } | null> {
    const { data: session } = await auth.getSession();
    if (!session?.user) return null;

    const userId = session.user.id;
    const now = Date.now();
    const lastUpdate = lastActivityUpdate.get(userId) ?? 0;

    // Throttled last_active_at update (>5 min between writes)
    if (now - lastUpdate > ACTIVITY_THROTTLE_MS) {
        lastActivityUpdate.set(userId, now);
        upsertUserActivity(userId, { last_active_at: new Date() }).catch(() => {});
    }

    return { userId, email: session.user.email };
}

export async function recordLogin(userId: string): Promise<void> {
    await upsertUserActivity(userId, { last_login_at: new Date() });
}
