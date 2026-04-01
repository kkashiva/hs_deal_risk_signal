import { auth } from '@/lib/auth/server';
import { isEmailDomainAllowed } from '@/lib/allowed-domains';
import { upsertUserActivity } from '@/db/queries';

const ACTIVITY_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes
const LOGIN_THROTTLE_MS = 60 * 60 * 1000; // 1 hour

const lastActivityUpdate = new Map<string, number>();
const lastLoginUpdate = new Map<string, number>();

export async function getCurrentUser(): Promise<{ userId: string; email: string } | null> {
    const { data: session } = await auth.getSession();
    if (!session?.user) return null;
    if (!isEmailDomainAllowed(session.user.email)) return null;

    const userId = session.user.id;
    const now = Date.now();

    const fields: { last_active_at?: Date; last_login_at?: Date } = {};

    // Throttled last_active_at update (>5 min between writes)
    const lastActivity = lastActivityUpdate.get(userId) ?? 0;
    if (now - lastActivity > ACTIVITY_THROTTLE_MS) {
        lastActivityUpdate.set(userId, now);
        fields.last_active_at = new Date();
    }

    // Throttled last_login_at update (>1 hour between writes)
    const lastLogin = lastLoginUpdate.get(userId) ?? 0;
    if (now - lastLogin > LOGIN_THROTTLE_MS) {
        lastLoginUpdate.set(userId, now);
        fields.last_login_at = new Date();
    }

    if (fields.last_active_at || fields.last_login_at) {
        upsertUserActivity(userId, fields).catch(() => {});
    }

    return { userId, email: session.user.email };
}
