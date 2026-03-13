export const PIPELINE_MAP: Record<string, string> = {
    '9308023': 'Enterprise New Sales',
    '9297003': 'Agency New Sales',
    '89892425': 'Europe New Sales',
};

export const STAGE_MAP: Record<string, Record<string, string>> = {
    // Agency New Sales
    '9297003': {
        '26497054': 'S1 - Needs Discovered (Agency New Sales)',
        'S1 - Needs Discovered': 'S1 - Needs Discovered (Agency New Sales)',
        'Needs discovered': 'S1 - Needs Discovered (Agency New Sales)',
        '26497055': 'S2 - Buy-in from wider team (Agency New Sales)',
        'S2 - Buy-in from wider team': 'S2 - Buy-in from wider team (Agency New Sales)',
        'Buy-in from wider team': 'S2 - Buy-in from wider team (Agency New Sales)',
        '26497056': 'S3 - Trial (Agency New Sales)',
        'S3 - Trial': 'S3 - Trial (Agency New Sales)',
        'Trial': 'S3 - Trial (Agency New Sales)',
        '26497057': 'S4 - Decision Maker Buy-in (Agency New Sales)',
        'S4 - Decision Maker Buy-in': 'S4 - Decision Maker Buy-in (Agency New Sales)',
        'Decision Maker Buy-in': 'S4 - Decision Maker Buy-in (Agency New Sales)',
        '49153958': 'S5 - Commercials (Agency New Sales)',
        'S5 - Commercials': 'S5 - Commercials (Agency New Sales)',
        '26497058': 'S6 - Legal & IT & Security (Agency New Sales)',
        'S6 - Legal & IT & Security': 'S6 - Legal & IT & Security (Agency New Sales)',
        'Legal': 'S6 - Legal & IT & Security (Agency New Sales)',
        'Security': 'S6 - Legal & IT & Security (Agency New Sales)',
        '26497059': 'Closed won (Agency New Sales)',
        '26497060': 'Closed lost (Agency New Sales)',
        '199756209': 'S7- Draft Contract (Agency New Sales)',
        'S7- Draft Contract': 'S7- Draft Contract (Agency New Sales)',
        '48484985': 'S8 - Pending Payment (Agency New Sales)',
        'S8 - Pending Payment': 'S8 - Pending Payment (Agency New Sales)',
        'Pending Payment': 'S8 - Pending Payment (Agency New Sales)',
    },
    // Enterprise New Sales
    '9308023': {
        '26589195': 'S1 - Needs discovered (Enterprise New Sales)',
        'S1 - Needs discovered': 'S1 - Needs discovered (Enterprise New Sales)',
        '26589196': 'S2 - Buy-in from wider team (Enterprise New Sales)',
        'S2 - Buy-in from wider team': 'S2 - Buy-in from wider team (Enterprise New Sales)',
        '26589197': 'S3 - Trial (Enterprise New Sales)',
        'S3 - Trial': 'S3 - Trial (Enterprise New Sales)',
        '26589198': 'S4 - Commercial Negotiations (Enterprise New Sales)',
        'S4 - Commercial Negotiations': 'S4 - Commercial Negotiations (Enterprise New Sales)',
        '26589199': 'S5 - Decision Maker Buy-in (Enterprise New Sales)',
        'S5 - Decision Maker Buy-in': 'S5 - Decision Maker Buy-in (Enterprise New Sales)',
        '26588039': 'S6 - Security (Enterprise New Sales)',
        'S6 - Security': 'S6 - Security (Enterprise New Sales)',
        '26588040': 'S7 - Legal (Enterprise New Sales)',
        'S7 - Legal': 'S7 - Legal (Enterprise New Sales)',
        '26589200': 'Closed won (Enterprise New Sales)',
        'Closed won': 'Closed won (Enterprise New Sales)',
        '26589201': 'Closed lost (Enterprise New Sales)',
        'Closed lost': 'Closed lost (Enterprise New Sales)',
    },
    // Europe New Sales
    '89892425': {
        '166590829': 'S1 - Needs Discovered (Europe New Sales)',
        'S1 - Needs Discovered': 'S1 - Needs Discovered (Europe New Sales)',
        '166590830': 'S2 - Buy-in from wider team (Europe New Sales)',
        'S2 - Buy-in from wider team': 'S2 - Buy-in from wider team (Europe New Sales)',
        '166590831': 'S3 - Trial (Europe New Sales)',
        'S3 - Trial': 'S3 - Trial (Europe New Sales)',
        '166590832': 'S4 - Decision Maker Buy-in (Europe New Sales)',
        'S4 - Decision Maker Buy-in': 'S4 - Decision Maker Buy-in (Europe New Sales)',
        '166590833': 'S5 - Commercials (Europe New Sales)',
        'S5 - Commercials': 'S5 - Commercials (Europe New Sales)',
        '166636099': 'S6 - Legal & IT & Security (Europe New Sales)',
        'S6 - Legal & IT & Security': 'S6 - Legal & IT & Security (Europe New Sales)',
        '199765128': 'S7- Draft Contract (Europe New Sales)',
        'S7- Draft Contract': 'S7- Draft Contract (Europe New Sales)',
        '166636100': 'S8 - Pending Payment (Europe New Sales)',
        'S8 - Pending Payment': 'S8 - Pending Payment (Europe New Sales)',
        '166590834': 'Closed won (Europe New Sales)',
        'Closed won': 'Closed won (Europe New Sales)',
        '166590835': 'Closed lost (Europe New Sales)',
        'Closed lost': 'Closed lost (Europe New Sales)',
    }
};

export function getNormalizedStage(stage: string | undefined, pipelineId: string | null): string {
    if (!stage) return '—';
    if (!pipelineId) return stage;
    return STAGE_MAP[pipelineId]?.[stage] || stage;
}
