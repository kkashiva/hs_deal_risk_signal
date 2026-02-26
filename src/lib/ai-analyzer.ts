// ============================================================
// AI Risk Analyzer — Multi-LLM Routing (Gemini / Claude)
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import { RiskInput, RiskAnalysisResult, LLMProvider } from './types';
import { getConfig, LATE_STAGE_IDS, PROMPT_VERSION } from './config';

// --- LLM Provider Routing ---

export function routeToProvider(
    mrr: number | null,
    stage: string,
    mrrThreshold: number
): LLMProvider {
    // Late-stage deals always use Claude
    if (LATE_STAGE_IDS.includes(stage.toLowerCase())) {
        return 'claude';
    }
    // High-value deals use Claude
    if (mrr !== null && mrr >= mrrThreshold) {
        return 'claude';
    }
    // Default to Gemini for cost efficiency
    return 'gemini';
}

// --- System Prompt ---

const SYSTEM_PROMPT = `You are a sales deal risk analyst. You analyze B2B SaaS deals to identify risk signals that could lead to the deal being lost.

You have deep knowledge of:
- MEDDPICC sales methodology (Metrics, Economic Buyer, Decision Criteria, Decision Process, Paper Process, Identify Pain, Champion, Competition)
- Deal velocity patterns and what healthy vs unhealthy progression looks like
- Champion signals and multi-threading indicators
- Engagement frequency patterns that correlate with deal outcomes
- Reply velocity and meeting cadence benchmarks

Analyze the provided deal data and return a JSON risk assessment. Be specific and cite evidence from the data provided. Focus on actionable insights that a sales manager or executive could use to intervene.

IMPORTANT GUIDELINES:
- Do NOT flag deal amounts or pricing as a risk factor. The deal amount reflects the customer's chosen plan or pricing tier and is set correctly by the sales team. Focus instead on engagement patterns, deal velocity, champion strength, and multi-threading.
- Do NOT treat the absence of Gong transcripts as a risk signal. Transcripts may not be available for all deals.
- When a forecast category IS provided (e.g., "Pipeline", "Best Case", "Commit"), use it as context but do not flag its presence or absence as the primary risk factor.

REPLY VELOCITY & MEETING CADENCE:
- Healthy deals typically show <48h average email reply time and weekly meeting touchpoints (avg ~7 days between meetings).
- Reply times >48h or meeting gaps >14 days are warning signs. Both together are a strong risk indicator.
- Use the provided Avg Email Reply Time and Avg Days Between Meetings metrics to assess this.

TIMELINE STALLING:
- Watch for prospects who are postponing meetings, giving vague or non-committal answers to timing questions ("we'll circle back", "let me check internally", "maybe next quarter"), or revising internal deadlines.
- Look at email content and Gong transcripts for these patterns. Examples: repeatedly rescheduling, dodging close-date discussions, "we need more time", shifting decision timelines.
- If you see clear timeline stalling behavior, use "timeline_stalling" as the primary_risk_reason.

IMPORTANT: Your response must be ONLY valid JSON matching this exact schema:
{
  "risk_level": "LOW" | "MEDIUM" | "HIGH",
  "primary_risk_reason": one of: "budget", "timing", "no_champion", "competition", "feature_gap", "low_engagement", "multithreading_gap", "timeline_stalling",
  "explanation": "Max 4 sentences with specific evidence from the data",
  "recommended_action": "A specific, actionable next step",
  "confidence_score": 0-100,
  "escalation_target": "ae" | "manager" | "exec"
}

Risk Level Guidelines:
- HIGH: Strong indicators of deal loss (e.g., no activity in 14+ days, close date pushed 2+ times, no champion identified, late stage with low engagement, reply time >72h with infrequent meetings, clear timeline stalling patterns)
- MEDIUM: Warning signs present but deal is still salvageable (e.g., slowing engagement, single-threaded, competing priorities mentioned, reply times 48-72h, meeting gaps 10-14 days)
- LOW: Deal appears healthy with normal progression

Escalation Guidelines:
- "ae": AE can handle with coaching
- "manager": Sales manager should review and guide strategy
- "exec": Cofounder/exec involvement recommended (high-value deals, competitive situations, strategic accounts)`;

// --- Build User Prompt ---

function buildUserPrompt(input: RiskInput): string {
    return `Analyze this deal for risk signals:

DEAL METADATA:
- Name: ${input.deal_metadata.deal_name}
- Amount: $${input.deal_metadata.amount || 'Unknown'}
- MRR: $${input.deal_metadata.mrr || 'Unknown'}
- Stage: ${input.deal_metadata.stage}
- Pipeline: ${input.deal_metadata.pipeline}
- Days in current stage: ${input.deal_metadata.days_in_stage}
- Days since deal created: ${input.deal_metadata.days_since_creation}
- Close date: ${input.deal_metadata.close_date || 'Not set'}
- Close date drift: ${input.deal_metadata.close_date_drift_days !== null ? input.deal_metadata.close_date_drift_days + ' days' : 'N/A'}
- Forecast category: ${input.deal_metadata.forecast_category || 'Not set'}
- Number of contacts: ${input.deal_metadata.num_contacts}

ENGAGEMENT METRICS:
- Total emails: ${input.engagement_metrics.totalEmails}
- Total meetings: ${input.engagement_metrics.totalMeetings}
- Total calls: ${input.engagement_metrics.totalCalls}
- Total notes: ${input.engagement_metrics.totalNotes}
- Days since last activity: ${input.engagement_metrics.daysSinceLastActivity}
- Days since last meeting: ${input.engagement_metrics.daysSinceLastMeeting ?? 'No meetings'}
- Meeting no-shows: ${input.engagement_metrics.meetingNoShows}
- Avg email reply time: ${input.engagement_metrics.avgEmailReplyTimeHours !== null ? input.engagement_metrics.avgEmailReplyTimeHours + 'h' : 'N/A'}
- Avg days between meetings: ${input.engagement_metrics.avgDaysBetweenMeetings ?? 'N/A'}
- Avg days between activities: ${input.engagement_metrics.avgDaysBetweenActivities ?? 'N/A'}

RECENT ENGAGEMENTS (last 10):
${input.recent_engagements.length > 0
            ? input.recent_engagements
                .slice(0, 10)
                .map(e => `- [${e.type}] ${e.date}: ${e.summary}`)
                .join('\n')
            : 'No recent engagements found'}

${input.transcript_summary
            ? `CALL TRANSCRIPTS:\n${input.transcript_summary}`
            : 'CALL TRANSCRIPTS: No Gong transcripts available'}

Respond with ONLY valid JSON matching the required schema.`;
}

// --- Analyze with Gemini ---

async function analyzeWithGemini(input: RiskInput): Promise<RiskAnalysisResult> {
    const config = getConfig();
    const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.3,
        },
    });

    const result = await model.generateContent([
        { text: SYSTEM_PROMPT },
        { text: buildUserPrompt(input) },
    ]);

    const text = result.response.text();
    return JSON.parse(text) as RiskAnalysisResult;
}

// --- Analyze with Claude ---

async function analyzeWithClaude(input: RiskInput): Promise<RiskAnalysisResult> {
    const config = getConfig();
    const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

    const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
            {
                role: 'user',
                content: buildUserPrompt(input),
            },
        ],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';

    // Extract JSON from response (Claude may wrap in markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('Claude did not return valid JSON');
    }

    return JSON.parse(jsonMatch[0]) as RiskAnalysisResult;
}

// --- Main Entry Point ---

export async function analyzeDealRisk(
    input: RiskInput
): Promise<{ result: RiskAnalysisResult; provider: LLMProvider; promptVersion: string }> {
    const config = getConfig();
    const provider = routeToProvider(
        input.deal_metadata.mrr,
        input.deal_metadata.stage,
        config.mrrRoutingThreshold
    );

    console.log(
        `Analyzing deal "${input.deal_metadata.deal_name}" with ${provider} ` +
        `(MRR: $${input.deal_metadata.mrr}, Stage: ${input.deal_metadata.stage})`
    );

    let result: RiskAnalysisResult;

    if (provider === 'gemini') {
        result = await analyzeWithGemini(input);
    } else {
        result = await analyzeWithClaude(input);
    }

    // Validate the result has required fields
    if (!result.risk_level || !result.primary_risk_reason || !result.explanation) {
        throw new Error(`Invalid LLM response: missing required fields`);
    }

    // Clamp confidence score
    result.confidence_score = Math.max(0, Math.min(100, result.confidence_score));

    return { result, provider, promptVersion: PROMPT_VERSION };
}
