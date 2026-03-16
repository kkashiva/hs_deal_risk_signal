// ============================================================
// AI Risk Analyzer — Multi-LLM Routing + LangGraph Pipeline
// ============================================================

import { RiskInput, RiskAnalysisResult, LLMProvider } from './types';
import { getConfig, LATE_STAGE_IDS, PROMPT_VERSION } from './config';
import { runRiskGraph, GraphResult } from './ai-graph';

// --- LLM Provider Routing ---

export function routeToProvider(
    mrr: number | null,
    stage: string | null,
    mrrThreshold: number
): LLMProvider {
    // Late-stage deals always use Claude
    if (stage && LATE_STAGE_IDS.includes(stage.toLowerCase())) {
        return 'claude';
    }
    // High-value deals use Claude
    if (mrr !== null && mrr >= mrrThreshold) {
        return 'claude';
    }
    // Default to Gemini for cost efficiency
    return 'gemini';
}

// --- Main Entry Point ---

export interface AnalyzeDealRiskResult {
    result: RiskAnalysisResult;
    provider: LLMProvider;
    promptVersion: string;
    dealAnalysis: string;
    emailAnalysis: string;
    transcriptAnalysis: string;
}

export async function analyzeDealRisk(
    input: RiskInput
): Promise<AnalyzeDealRiskResult> {
    const config = getConfig();
    const provider = routeToProvider(
        input.deal_metadata.mrr,
        input.deal_metadata.stage,
        config.mrrRoutingThreshold
    );

    console.log(
        `Analyzing deal "${input.deal_metadata.deal_name}" with ${provider} ` +
        `(MRR: $${input.deal_metadata.mrr ?? 'Unknown'}, Stage: ${input.deal_metadata.stage ?? 'Unknown'})`
    );

    // Run the LangGraph multi-step pipeline
    const graphResult: GraphResult = await runRiskGraph(input, provider);
    const { result } = graphResult;

    // Validate the result has required fields
    if (!result.risk_level || !result.primary_risk_reason || !result.explanation) {
        throw new Error(`Invalid LLM response: missing required fields`);
    }

    // Clamp confidence score
    result.confidence_score = Math.max(0, Math.min(100, result.confidence_score));

    return {
        result,
        provider,
        promptVersion: PROMPT_VERSION,
        dealAnalysis: graphResult.dealAnalysis,
        emailAnalysis: graphResult.emailAnalysis,
        transcriptAnalysis: graphResult.transcriptAnalysis,
    };
}

