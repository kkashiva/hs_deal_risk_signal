// ============================================================
// Gong Service — Fetch Call Transcripts
// ============================================================

import axios, { AxiosInstance } from 'axios';
import { GongCall } from './types';
import { getConfig } from './config';

const GONG_BASE_URL = 'https://us-11546.api.gong.io/v2';
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

// --- Search Calls by Deal/Company Name ---

export async function fetchCallsForDeal(
    dealName: string,
    companyName?: string
): Promise<GongCall[]> {
    const client = getClient();

    const searchTerm = companyName || dealName;

    try {
        const response = await client.post('/calls', {
            filter: {
                fromDateTime: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // last 90 days
                toDateTime: new Date().toISOString(),
            },
            contentSelector: {
                exposedFields: {
                    parties: true,
                },
            },
        });

        const calls: GongCall[] = (response.data.calls || [])
            .filter((call: { title?: string; parties?: { name: string }[] }) => {
                const title = (call.title || '').toLowerCase();
                const partyNames = (call.parties || []).map((p: { name: string }) => p.name.toLowerCase());
                const term = searchTerm.toLowerCase();

                return (
                    title.includes(term) ||
                    partyNames.some((name: string) => name.includes(term))
                );
            })
            .map((call: { metaData?: { id: string; title?: string; started?: string; duration?: number }; parties?: { name: string; emailAddress: string }[] }) => ({
                id: call.metaData?.id || '',
                title: call.metaData?.title || '',
                started: call.metaData?.started || '',
                duration: call.metaData?.duration || 0,
                parties: (call.parties || []).map((p: { name: string; emailAddress: string }) => ({
                    name: p.name,
                    email: p.emailAddress,
                })),
            }))
            .sort((a: GongCall, b: GongCall) =>
                new Date(b.started).getTime() - new Date(a.started).getTime()
            );

        return calls.slice(0, 2); // Return last 2 calls
    } catch (error) {
        console.error('Error fetching Gong calls:', error);
        return [];
    }
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

// --- Get Combined Transcripts for a Deal ---

export async function getTranscriptsForDeal(
    dealName: string,
    companyName?: string
): Promise<string | null> {
    if (!isGongConfigured()) return null;

    try {
        const calls = await fetchCallsForDeal(dealName, companyName);
        if (calls.length === 0) return null;

        const transcripts: string[] = [];

        for (const call of calls) {
            const transcript = await fetchTranscript(call.id);
            if (transcript) {
                transcripts.push(
                    `--- Call: ${call.title} (${new Date(call.started).toLocaleDateString()}) ---\n${transcript}`
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
        console.error('Error getting transcripts for deal:', error);
        return null;
    }
}
