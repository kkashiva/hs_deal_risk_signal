// ============================================================
// Gong Service — Fetch Call Transcripts
// ============================================================

import axios, { AxiosInstance } from 'axios';
import { getConfig } from './config';

const GONG_BASE_URL = 'https://us-15203.api.gong.io/v2';
const MAX_TRANSCRIPT_TOKENS = 4000;

let gongClient: AxiosInstance | null = null;

function getClient(): AxiosInstance {
    if (!gongClient) {
        const config = getConfig();

        if (!config.gong.accessKey || !config.gong.accessSecret) {
            throw new Error('Gong API credentials not configured');
        }

        const credentials = Buffer.from(
            `${config.gong.accessKey}:${config.gong.accessSecret}`
        ).toString('base64');

        gongClient = axios.create({
            baseURL: GONG_BASE_URL,
            headers: {
                Authorization: `Basic ${credentials}`,
                'Content-Type': 'application/json',
            },
        });
    }
    return gongClient;
}

export function isGongConfigured(): boolean {
    try {
        const config = getConfig();
        return !!(config.gong.accessKey && config.gong.accessSecret);
    } catch {
        return false;
    }
}

// --- Extract Gong Call IDs from HubSpot Note Bodies ---

const GONG_URL_PATTERN = /gong\.io\/call\?id=(\d+)/g;

export function extractGongCallIds(noteBody: string): string[] {
    const ids: string[] = [];
    let match;
    while ((match = GONG_URL_PATTERN.exec(noteBody)) !== null) {
        ids.push(match[1]);
    }
    // Reset regex lastIndex for next call
    GONG_URL_PATTERN.lastIndex = 0;
    return ids;
}

// --- Fetch Transcript for a Call ---

export async function fetchTranscript(callId: string): Promise<string> {
    const client = getClient();

    try {
        const response = await client.post('/calls/transcript', {
            filter: {
                callIds: [callId],
            },
        });

        const transcripts = response.data.callTranscripts || [];
        if (transcripts.length === 0) return '';

        const segments = transcripts[0].transcript || [];
        return segments
            .map((seg: { speakerName?: string; sentences?: { text: string }[] }) =>
                `${seg.speakerName || 'Unknown'}: ${(seg.sentences || []).map((s: { text: string }) => s.text).join(' ')}`
            )
            .join('\n');
    } catch (error) {
        console.error(`Error fetching transcript for call ${callId}:`, error);
        return '';
    }
}

// --- Get Combined Transcripts from Call IDs ---

export async function getTranscriptsFromCallIds(
    callIds: string[]
): Promise<string | null> {
    if (!isGongConfigured() || callIds.length === 0) return null;

    try {
        // Take the most recent 2 call IDs
        const recentIds = callIds.slice(0, 2);
        const transcripts: string[] = [];

        for (const callId of recentIds) {
            console.log(`Fetching Gong transcript for call ID: ${callId}`);
            const transcript = await fetchTranscript(callId);
            if (transcript) {
                transcripts.push(
                    `--- Gong Call ${callId} ---\n${transcript}`
                );
            }
        }

        if (transcripts.length === 0) return null;

        let combined = transcripts.join('\n\n');

        // Truncate to approximate token limit (1 token ≈ 4 chars)
        const maxChars = MAX_TRANSCRIPT_TOKENS * 4;
        if (combined.length > maxChars) {
            combined = combined.substring(0, maxChars) + '\n\n[Transcript truncated for cost control]';
        }

        return combined;
    } catch (error) {
        console.error('Error getting transcripts from call IDs:', error);
        return null;
    }
}
