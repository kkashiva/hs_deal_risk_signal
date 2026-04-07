// ============================================================
// AI Risk Graph — LangGraph Multi-Step Pipeline
// ============================================================
//
// 4-node StateGraph:
//   analyzeDeal ──┐
//   analyzeEmails ─┼──▶ synthesize ──▶ RiskAnalysisResult
//   analyzeTranscripts ┘
//
// Each analysis node produces a focused summary (~200 words).
// The synthesis node combines them into the final structured output.
// ============================================================

import { Annotation, StateGraph } from '@langchain/langgraph';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatAnthropic } from '@langchain/anthropic';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import {
    RiskInput,
    RiskAnalysisResult,
    LLMProvider,
} from './types';
import { getConfig } from './config';
import { PIPELINE_MAP } from './mappings';

// --- Zod Schema for Structured Output ---

const RiskAnalysisResultSchema = z.object({
    risk_level: z.enum(['LOW', 'MEDIUM', 'HIGH']).describe('Overall risk level'),
    primary_risk_reason: z.enum([
        'budget', 'timing', 'no_champion', 'competition',
        'feature_gap', 'low_engagement', 'multithreading_gap', 'timeline_stalling',
    ]).describe('Primary reason for the risk assessment'),
    explanation: z.string().describe('Max 4 sentences with specific evidence from the data'),
    recommended_action: z.string().describe('A specific, actionable next step'),
    confidence_score: z.number().min(0).max(100).describe('Confidence in the assessment (0-100)'),
    escalation_target: z.enum(['ae', 'manager', 'exec']).describe('Who should handle this'),
});

// --- LangGraph State Annotation ---

const GraphState = Annotation.Root({
    // Inputs
    dealMetadata: Annotation<RiskInput['deal_metadata']>,
    engagementMetrics: Annotation<RiskInput['engagement_metrics']>,
    recentEngagements: Annotation<RiskInput['recent_engagements']>,
    transcriptSummary: Annotation<string | null>,
    provider: Annotation<LLMProvider>,

    // Intermediate outputs (persisted to DB)
    dealAnalysis: Annotation<string>,
    emailAnalysis: Annotation<string>,
    transcriptAnalysis: Annotation<string>,

    // Final output
    result: Annotation<RiskAnalysisResult>,
});

type GraphStateType = typeof GraphState.State;

// --- Model Factory ---

function getModel(provider: LLMProvider): BaseChatModel {
    const config = getConfig();

    if (provider === 'gemini') {
        return new ChatGoogleGenerativeAI({
            model: 'gemini-2.5-flash',
            apiKey: config.gemini.apiKey,
            temperature: 0.3,
        });
    } else {
        return new ChatAnthropic({
            model: 'claude-opus-4-6',
            apiKey: config.anthropic.apiKey,
            maxTokens: 1024,
            temperature: 0.3,
        });
    }
}

function getAlternateProvider(provider: LLMProvider): LLMProvider {
    return provider === 'claude' ? 'gemini' : 'claude';
}

function isFallbackAvailable(fallbackProvider: LLMProvider): boolean {
    const config = getConfig();
    if (fallbackProvider === 'claude') {
        return !!config.anthropic.apiKey;
    }
    return !!config.gemini.apiKey;
}

// Invoke with automatic fallback to alternate provider on error
async function invokeWithFallback(
    provider: LLMProvider,
    messages: (SystemMessage | HumanMessage)[],
    nodeName: string
): Promise<string> {
    try {
        const model = getModel(provider);
        const response = await model.invoke(messages);
        return typeof response.content === 'string'
            ? response.content
            : JSON.stringify(response.content);
    } catch (error) {
        const fallback = getAlternateProvider(provider);
        if (!isFallbackAvailable(fallback)) {
            throw error;
        }
        console.warn(`  ⚠️ ${nodeName} failed with ${provider}, retrying with ${fallback}:`, error);
        const model = getModel(fallback);
        const response = await model.invoke(messages);
        return typeof response.content === 'string'
            ? response.content
            : JSON.stringify(response.content);
    }
}

// Structured output invoke with automatic fallback
async function invokeStructuredWithFallback(
    provider: LLMProvider,
    messages: (SystemMessage | HumanMessage)[],
    schema: z.ZodType,
    nodeName: string
): Promise<RiskAnalysisResult> {
    try {
        const model = getModel(provider);
        const structuredModel = model.withStructuredOutput(schema);
        return await structuredModel.invoke(messages) as RiskAnalysisResult;
    } catch (error) {
        const fallback = getAlternateProvider(provider);
        if (!isFallbackAvailable(fallback)) {
            throw error;
        }
        console.warn(`  ⚠️ ${nodeName} failed with ${provider}, retrying with ${fallback}:`, error);
        const model = getModel(fallback);
        const structuredModel = model.withStructuredOutput(schema);
        return await structuredModel.invoke(messages) as RiskAnalysisResult;
    }
}

// --- Node: Analyze Deal Metadata & Engagement Metrics ---

const DEAL_ANALYSIS_PROMPT = `You are a sales deal risk analyst specializing in B2B SaaS deal velocity and engagement patterns.

Analyze the deal metadata, engagement metrics, and enriched CRM context below. Focus on:
- Stage progression context (NOTE: deal stage is owner-reported and often outdated — use it as
  a loose reference but weight engagement data, MEDPICC signals, and notes more heavily)
- Engagement frequency and recency (healthy vs concerning patterns)
- Champion & decision maker identification (who is driving the deal? is there a clear DM?)
- Multi-threading depth (number and seniority of contacts, decision maker involvement)
- Budget and procurement readiness (is budget confirmed? procurement process clear?)
- Competitive landscape (are competitors being evaluated? how serious?)
- Use case clarity (is the prospect's use case well-defined?)
- Pain point articulation (is the pain specific and urgent, or vague?)
- Next steps specificity (concrete actions with dates vs vague "follow up")
- Close date drift (has it been pushed?)

Write a concise analysis (max 300 words) summarizing the key risk signals and health indicators from this data. Be specific — cite numbers and CRM field values.

CALIBRATION RULES:
- IMPORTANT: Deal stage in HubSpot is a LAGGING INDICATOR. Deal owners frequently do NOT
  update it on time. Do NOT treat stage alone as a strong signal for risk assessment.
  Cross-reference stage with engagement recency, notes, and MEDPICC fields to determine
  actual deal momentum. If behavioral signals contradict the reported stage, trust the
  behavioral signals.
- Deals in legal/contract/negotiation stages naturally have fewer meetings and longer
  reply gaps. Do NOT flag this as risk unless the champion is also unresponsive.
- Close date pushed once with a specific new date is NORMAL in enterprise. Only flag
  when pushed 2+ times without a confirmed replacement date.
- Stage duration must be evaluated relative to the stage: late-stage deals (legal,
  procurement) routinely take 2-6 weeks. Early stages stalling 2+ weeks is more concerning.
- Amount reductions due to scope refinement (fewer licenses, dropped add-ons) with
  confirmed intent to proceed are POSITIVE signals, not risk.
- Do NOT flag deal amounts/pricing as a risk.
- Do NOT treat the absence of transcripts as a risk.
- Explicitly note positive signals alongside risk signals in your analysis.`;

async function analyzeDealNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
    const dm = state.dealMetadata;
    const em = state.engagementMetrics;
    const pipelineName = dm.pipeline ? (PIPELINE_MAP[dm.pipeline] || dm.pipeline) : 'Unknown';
    const isEnterprise = dm.pipeline === '9308023';

    // Build enriched context sections (only include non-null data)
    const sections: string[] = [];

    const companyParts = [
        dm.company_size && `- Company size: ${dm.company_size}`,
        dm.industry && `- Industry: ${dm.industry}`,
        dm.clay_industry && `- Clay industry: ${dm.clay_industry}`,
    ].filter(Boolean);
    if (companyParts.length) sections.push(`COMPANY CONTEXT:\n${companyParts.join('\n')}`);

    const champParts = [
        dm.champion_email ? `- Champion identified: Yes (${dm.champion_email})` : '- Champion identified: No',
        dm.decision_maker_email ? `- Decision maker identified: Yes (${dm.decision_maker_email})` : '- Decision maker identified: No',
        dm.contacts_job_titles && `- Contact titles: ${dm.contacts_job_titles}`,
    ].filter(Boolean);
    if (champParts.length) sections.push(`CHAMPION & DECISION MAKER:\n${champParts.join('\n')}`);

    if (dm.contacts && dm.contacts.length > 0) {
        const contactLines = dm.contacts.map(c => {
            const parts = [c.job_title, c.persona_group, c.persona_seniority].filter(Boolean);
            return `- ${parts.join(' | ') || 'Unknown role'}`;
        });
        sections.push(`ASSOCIATED CONTACTS (${dm.contacts.length}):\n${contactLines.join('\n')}`);
    }

    const useCaseParts = [
        dm.primary_use_case && `- Primary: ${dm.primary_use_case}`,
        dm.secondary_use_cases && `- Secondary: ${dm.secondary_use_cases}`,
        dm.riverside_use_case && `- Riverside: ${dm.riverside_use_case}`,
    ].filter(Boolean);
    if (useCaseParts.length) sections.push(`USE CASES:\n${useCaseParts.join('\n')}`);

    const compParts = [
        dm.competition_stage && `- Competition (MEDPICC): ${dm.competition_stage}`,
        dm.competitive && `- Competitive: ${dm.competitive}`,
        dm.competitors_considered && `- Competitors considered: ${dm.competitors_considered}`,
    ].filter(Boolean);
    if (compParts.length) sections.push(`COMPETITION:\n${compParts.join('\n')}`);

    const budgetParts = [
        dm.budget_scoring && `- Budget scoring: ${dm.budget_scoring}`,
        dm.economic_buyer_stage && `- Economic buyer (MEDPICC): ${dm.economic_buyer_stage}`,
        dm.metrics_stage && `- Metrics (MEDPICC): ${dm.metrics_stage}`,
    ].filter(Boolean);
    if (budgetParts.length) sections.push(`BUDGET SIGNALS (Pipeline: ${pipelineName}):\n${budgetParts.join('\n')}`);

    const pricingParts = [
        dm.customer_plan && `- Plan: ${dm.customer_plan}`,
        dm.pricing_package && `- Package: ${dm.pricing_package}`,
        dm.add_on_licenses && `- Add-on licenses: ${dm.add_on_licenses}`,
        dm.add_on_productions && `- Add-on productions: ${dm.add_on_productions}`,
        dm.webinar_add_on_mrr && `- Webinar add-on MRR: ${dm.webinar_add_on_mrr}`,
        dm.num_accounts_given && `- Accounts given: ${dm.num_accounts_given}`,
        dm.num_productions_given && `- Productions given: ${dm.num_productions_given}`,
    ].filter(Boolean);
    if (pricingParts.length) sections.push(`PRICING & PACKAGING:\n${pricingParts.join('\n')}`);

    if (isEnterprise) {
        const medpiccParts = [
            dm.metrics_stage && `- Metrics: ${dm.metrics_stage}`,
            dm.economic_buyer_stage && `- Economic Buyer: ${dm.economic_buyer_stage}`,
            dm.decision_process_stage && `- Decision Process: ${dm.decision_process_stage}`,
            dm.paper_process_stage && `- Paper Process: ${dm.paper_process_stage}`,
            dm.champion_stage && `- Champion: ${dm.champion_stage}`,
            dm.competition_stage && `- Competition: ${dm.competition_stage}`,
            dm.pain_net_new && `- Pain (Net New): ${dm.pain_net_new}`,
            dm.pain_vs_pro && `- Pain (vs Pro): ${dm.pain_vs_pro}`,
        ].filter(Boolean);
        if (medpiccParts.length) sections.push(`MEDPICC SCORECARD (Enterprise):\n${medpiccParts.join('\n')}`);
    }

    const notesParts = [
        dm.notes && `- Deal notes: ${dm.notes.substring(0, 1000)}`,
        dm.manager_notes && `- Manager notes: ${dm.manager_notes.substring(0, 1000)}`,
    ].filter(Boolean);
    if (notesParts.length) sections.push(`INTERNAL NOTES:\n${notesParts.join('\n')}`);

    const enrichedContext = sections.length > 0
        ? `\n\nENRICHED DEAL CONTEXT:\n${sections.join('\n\n')}`
        : '';

    const userPrompt = `DEAL METADATA:
- Name: ${dm.deal_name}
- Amount: $${dm.amount || 'Unknown'}
- MRR: $${dm.mrr || 'Unknown'}
- Stage: ${dm.stage || 'Unknown'} (NOTE: may be outdated — cross-reference with engagement data)
- Pipeline: ${pipelineName}
- Days in current stage: ${dm.days_in_stage ?? 'Unknown'}
- Days since deal created: ${dm.days_since_creation ?? 'Unknown'}
- Close date: ${dm.close_date || 'Not set'}
- Close date drift: ${dm.close_date_drift_days !== null ? dm.close_date_drift_days + ' days' : 'N/A'}
- Forecast category: ${dm.forecast_category || 'Not set'}
- Number of contacts: ${dm.num_contacts}

ENGAGEMENT METRICS:
- Total emails: ${em.totalEmails}
- Total meetings: ${em.totalMeetings}
- Total calls: ${em.totalCalls}
- Total notes: ${em.totalNotes}
- Days since last activity: ${em.daysSinceLastActivity}
- Days since last meeting: ${em.daysSinceLastMeeting ?? 'No meetings'}
- Meeting no-shows: ${em.meetingNoShows}
- Avg email reply time: ${em.avgEmailReplyTimeHours !== null ? em.avgEmailReplyTimeHours + 'h' : 'N/A'}
- Avg days between meetings: ${em.avgDaysBetweenMeetings ?? 'N/A'}
- Avg days between activities: ${em.avgDaysBetweenActivities ?? 'N/A'}${enrichedContext}`;

    const messages: (SystemMessage | HumanMessage)[] = [
        new SystemMessage(DEAL_ANALYSIS_PROMPT),
        new HumanMessage(userPrompt),
    ];

    const content = await invokeWithFallback(state.provider, messages, 'Deal analysis');

    console.log(`  ✅ Deal analysis node complete (${content.length} chars)`);
    return { dealAnalysis: content };
}

// --- Node: Analyze Emails ---

const EMAIL_ANALYSIS_PROMPT = `You are a sales deal risk analyst specializing in email communication patterns and prospect sentiment.

Analyze the email engagements below. Focus on:
- Reply velocity patterns (fast replies = engaged, slow/no replies = risk)
- Sentiment and tone shifts (becoming colder, shorter, more formal?)
- Timeline stalling language ("we'll circle back", "let me check internally", "maybe next quarter")
- Decision maker involvement vs delegation to lower-level contacts
- Objections or concerns raised in email threads
- Any competitive mentions

Write a concise analysis (max 200 words) summarizing the key email risk signals. Be specific — quote relevant phrases if notable.
If no emails are provided, state "No email data available for analysis."

CALIBRATION RULES:
- Distinguish between STALLING language and PROCESS language:
  STALLING (risk): "We'll circle back", "Maybe next quarter", "Things are busy", 
  "We need to pause" — with NO specific follow-up date.
  PROCESS (healthy): "Legal needs another week for redlines", "PO is in approval queue",
  "Security review typically takes 5-7 days", "Meeting scheduled with [person] on [date]".
- Legal redlining, procurement setup, and security questionnaire exchanges are POSITIVE 
  signals. Do not flag these as objections or concerns.
- Champion delegating to legal/procurement contacts is a healthy handoff, not disengagement.
- Shorter, transactional emails in late stages are expected — do not interpret as 
  sentiment deterioration.`;

async function analyzeEmailsNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
    const emailEngagements = state.recentEngagements.filter(e =>
        e.type === 'EMAIL' || e.type === 'email'
    );

    if (emailEngagements.length === 0) {
        console.log(`  ⏭️  Email analysis node skipped (no emails)`);
        return { emailAnalysis: 'No email data available for analysis.' };
    }

    const emailList = emailEngagements
        .map(e => `- [${e.date}] ${e.summary}`)
        .join('\n');

    const userPrompt = `RECENT EMAIL ENGAGEMENTS (${emailEngagements.length} emails):
${emailList}`;

    const messages: (SystemMessage | HumanMessage)[] = [
        new SystemMessage(EMAIL_ANALYSIS_PROMPT),
        new HumanMessage(userPrompt),
    ];

    const content = await invokeWithFallback(state.provider, messages, 'Email analysis');

    console.log(`  ✅ Email analysis node complete (${content.length} chars)`);
    return { emailAnalysis: content };
}

// --- Node: Analyze Gong Transcripts ---

const TRANSCRIPT_ANALYSIS_PROMPT = `You are a sales deal risk analyst specializing in analyzing sales call transcripts for risk signals.

Analyze the call transcripts below using MEDDPICC methodology. Focus on:
- Champion strength (do they have an internal advocate? How strong?)
- Economic buyer involvement (has the EB been identified and engaged?)
- Competition mentions (are competitors being evaluated?)
- Decision process clarity (is there a clear buying process?)
- Pain identification (is the prospect's pain well-articulated?)
- Objections and concerns raised during calls
- Timeline stalling patterns (postponing, vague timing, shifting deadlines)
- Prospect engagement level during calls (asking questions, passive, disengaged?)

Write a concise analysis (max 200 words) summarizing the key transcript risk signals. Be specific — reference what was said.
If no transcripts are provided, state "No transcript data available for analysis."

CALIBRATION RULES:
- Champion strength is not binary. A champion who says "I need to check with legal" 
  or "Let me loop in procurement" is ACTIVELY DRIVING the deal internally — this is 
  a POSITIVE signal, not weakness. Only flag champion weakness when they deflect 
  without action: "I'll try to find out" with no follow-through across multiple calls.
- Economic Buyer not being on a call is not automatically a risk. In enterprise deals, 
  the EB often delegates evaluation to a champion or committee. Flag EB absence as risk 
  only when: the deal is in late stages (negotiation/contract) AND the champion cannot 
  articulate the EB's position or approval path.
- Legal/procurement discussion on calls is a STRONG POSITIVE signal. Conversations about 
  redlines, security questionnaires, vendor setup, PO timelines, or contract terms mean 
  the deal has crossed into active buying. Do not flag these discussions as objections.
- Scope refinement on calls (reducing licenses, adjusting package) where the prospect 
  confirms intent to proceed is POSITIVE — they are right-sizing to close, not backing away.
- Competition mentions require context: "We looked at X but prefer your approach" is 
  positive. "We're still evaluating X in parallel" is medium risk. "X offered us a 
  better deal" is high risk.
- Objections paired with resolution attempts are healthier than silence. A prospect 
  raising concerns on a call and engaging in problem-solving is more engaged than one 
  who says nothing and goes dark afterward.
- Timeline discussions: distinguish between "We want to go live by [date]" (positive) 
  vs "We'll figure out timing later" (risk). Specificity = commitment.`;

async function analyzeTranscriptsNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
    if (!state.transcriptSummary) {
        console.log(`  ⏭️  Transcript analysis node skipped (no transcripts)`);
        return { transcriptAnalysis: 'No transcript data available for analysis.' };
    }

    const messages: (SystemMessage | HumanMessage)[] = [
        new SystemMessage(TRANSCRIPT_ANALYSIS_PROMPT),
        new HumanMessage(`CALL TRANSCRIPTS:\n${state.transcriptSummary}`),
    ];

    const content = await invokeWithFallback(state.provider, messages, 'Transcript analysis');

    console.log(`  ✅ Transcript analysis node complete (${content.length} chars)`);
    return { transcriptAnalysis: content };
}

// --- Node: Synthesize Final Risk Assessment ---

const SYNTHESIS_PROMPT = `You are a senior sales deal risk analyst. You have received three focused analyses of a B2B SaaS deal from specialist analysts. Your job is to synthesize them into a single risk assessment.

IMPORTANT GUIDELINES:
- Do NOT flag deal amounts or pricing as a risk factor.
- Do NOT treat the absence of Gong transcripts as a risk signal.
- When a forecast category IS provided, use it as context but do not flag its presence/absence as the primary risk factor.
- Deal stage is frequently NOT updated by deal owners. Treat it as a loose reference only.
  Weight Gong call transcripts and email communication patterns as the PRIMARY evidence
  for deal health. MEDPICC fields, engagement recency, notes, and champion/DM identification
  are SECONDARY. Deal stage is TERTIARY — use only when primary and secondary signals are
  insufficient.

Risk Level Assignment Rules:
- HIGH: Requires 2+ strong negative signals with NO offsetting positive signals.
  Valid HIGH combinations: champion silent 14+ days AND no legal/procurement activity; 
  single-threaded AND late-stage AND stalling language; budget frozen with no alternative path.
  INVALID HIGH: deal in legal review with slower email cadence (this is normal).
- MEDIUM: 1-2 negative signals present, OR negatives partially offset by positives.
  Example: stage stagnating 2 weeks BUT legal redlines actively exchanged = MEDIUM not HIGH.
- LOW: Healthy progression, minor or no negatives, normal patterns for the current stage.

Critical override: If legal redlining, security review, or procurement processes are actively 
underway, the maximum risk level is MEDIUM unless the champion has gone completely silent 
(3+ unanswered follow-ups) AND procurement has also stalled.

Escalation Guidelines:
- "ae": AE can handle with coaching
- "manager": Sales manager should review and guide strategy
- "exec": Cofounder/exec involvement recommended (high-value, competitive, strategic)

Based on all three analyses, produce your final risk assessment. The explanation should be max 4 sentences with specific evidence drawn from the analyses.`;

async function synthesizeNode(state: GraphStateType): Promise<Partial<GraphStateType>> {
    const dm = state.dealMetadata;

    const userPrompt = `DEAL: "${dm.deal_name}" | MRR: $${dm.mrr || 'Unknown'} | Stage (may be stale): ${dm.stage || 'Unknown'}

--- DEAL & ENGAGEMENT ANALYSIS ---
${state.dealAnalysis}

--- EMAIL COMMUNICATION ANALYSIS ---
${state.emailAnalysis}

--- CALL TRANSCRIPT ANALYSIS ---
${state.transcriptAnalysis}

Synthesize the above into a single risk assessment. Respond with ONLY valid JSON matching the required schema.`;

    const messages: (SystemMessage | HumanMessage)[] = [
        new SystemMessage(SYNTHESIS_PROMPT),
        new HumanMessage(userPrompt),
    ];

    const result = await invokeStructuredWithFallback(
        state.provider, messages, RiskAnalysisResultSchema, 'Synthesis'
    );

    console.log(`  ✅ Synthesis node complete: ${result.risk_level} risk (${result.confidence_score}% confidence)`);
    return { result: result as RiskAnalysisResult };
}

// --- Build & Export the Graph ---

function buildRiskGraph() {
    const graph = new StateGraph(GraphState)
        .addNode('analyzeDeal', analyzeDealNode)
        .addNode('analyzeEmails', analyzeEmailsNode)
        .addNode('analyzeTranscripts', analyzeTranscriptsNode)
        .addNode('synthesize', synthesizeNode)
        // Fan-out: START → 3 analysis nodes in parallel
        .addEdge('__start__', 'analyzeDeal')
        .addEdge('__start__', 'analyzeEmails')
        .addEdge('__start__', 'analyzeTranscripts')
        // Fan-in: all 3 → synthesize
        .addEdge('analyzeDeal', 'synthesize')
        .addEdge('analyzeEmails', 'synthesize')
        .addEdge('analyzeTranscripts', 'synthesize')
        .addEdge('synthesize', '__end__');

    return graph.compile();
}

// Singleton compiled graph
let compiledGraph: ReturnType<typeof buildRiskGraph> | null = null;

function getGraph() {
    if (!compiledGraph) {
        compiledGraph = buildRiskGraph();
    }
    return compiledGraph;
}

// --- Public API ---

export interface GraphResult {
    result: RiskAnalysisResult;
    dealAnalysis: string;
    emailAnalysis: string;
    transcriptAnalysis: string;
}

export async function runRiskGraph(
    input: RiskInput,
    provider: LLMProvider
): Promise<GraphResult> {
    const graph = getGraph();

    const finalState = await graph.invoke({
        dealMetadata: input.deal_metadata,
        engagementMetrics: input.engagement_metrics,
        recentEngagements: input.recent_engagements,
        transcriptSummary: input.transcript_summary,
        provider,
    });

    return {
        result: finalState.result,
        dealAnalysis: finalState.dealAnalysis,
        emailAnalysis: finalState.emailAnalysis,
        transcriptAnalysis: finalState.transcriptAnalysis,
    };
}
