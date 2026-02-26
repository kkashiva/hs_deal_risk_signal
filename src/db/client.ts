// ============================================================
// Database Client — Vanilla Postgres with pg.Pool
// ============================================================

import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
    if (!pool) {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error('DATABASE_URL environment variable is required');
        }

        pool = new Pool({
            connectionString,
            max: 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
            ssl: connectionString.includes('sslmode=require') || connectionString.includes('neon.tech')
                ? { rejectUnauthorized: false }
                : undefined,
        });
    }
    return pool;
}

export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
    const pool = getPool();
    const result = await pool.query(text, params);
    return result.rows as T[];
}

export async function queryOne<T>(text: string, params?: unknown[]): Promise<T | null> {
    const rows = await query<T>(text, params);
    return rows.length > 0 ? rows[0] : null;
}
