// ============================================================
// HubSpot Deal Risk Signal — Shared Types
// ============================================================

// --- HubSpot Types ---

export interface HubSpotDeal {
  id: string;
  properties: {
    dealname: string;
    amount: string | null;
    mrr?: string | null;
    dealstage: string;
    pipeline: string;
    closedate: string | null;
    createdate: string;
    hs_lastmodifieddate: string;
    hubspot_owner_id: string | null;
    hs_forecast_category: string | null;
    notes_last_updated: string | null;
    num_associated_contacts: string | null;
    hs_date_entered_closedwon?: string | null;
    hs_date_entered_closedlost?: string | null;
    [key: string]: string | null | undefined;
  };
}

export interface HubSpotEngagement {
  id: string;
  type: 'EMAIL' | 'NOTE' | 'MEETING' | 'CALL' | 'TASK';
  timestamp: number;
  subject?: string;
  body?: string;
  direction?: 'INCOMING_EMAIL' | 'FORWARDED_EMAIL' | string; // populated for emails
  metadata?: Record<string, unknown>;
}

export interface DealActivityMetrics {
  totalEmails: number;
  totalMeetings: number;
  totalCalls: number;
  totalNotes: number;
  daysSinceLastActivity: number;
  daysSinceLastMeeting: number | null;
  meetingNoShows: number;
  avgDaysBetweenActivities: number | null;
  avgEmailReplyTimeHours: number | null;
  avgDaysBetweenMeetings: number | null;
}

// --- Gong Types ---

export interface GongCall {
  id: string;
  title: string;
  started: string;
  duration: number;
  parties: { name: string; email: string }[];
}

export interface GongTranscript {
  callId: string;
  transcript: string;
}

// --- AI Analysis Types ---

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type RiskReason =
  | 'budget'
  | 'timing'
  | 'no_champion'
  | 'competition'
  | 'feature_gap'
  | 'low_engagement'
  | 'multithreading_gap'
  | 'timeline_stalling';

export type EscalationTarget = 'ae' | 'manager' | 'exec';

export type LLMProvider = 'gemini' | 'claude';

export interface RiskAnalysisResult {
  risk_level: RiskLevel;
  primary_risk_reason: RiskReason;
  explanation: string;
  recommended_action: string;
  confidence_score: number;
  escalation_target: EscalationTarget;
}

export interface RiskInput {
  deal_metadata: {
    deal_id: string;
    deal_name: string;
    amount: number | null;
    mrr: number | null;
    stage: string;
    pipeline: string;
    days_in_stage: number;
    days_since_creation: number;
    close_date: string | null;
    close_date_drift_days: number | null;
    forecast_category: string | null;
    owner_id: string | null;
    num_contacts: number;
  };
  engagement_metrics: DealActivityMetrics;
  recent_engagements: {
    type: string;
    date: string;
    summary: string;
  }[];
  transcript_summary: string | null;
}

// --- Database Types ---

export interface RiskEvaluation {
  id?: number;
  deal_id: string;
  deal_name: string;
  deal_amount: number | null;
  pipeline: string | null;
  evaluation_date?: Date;
  risk_level: RiskLevel;
  risk_reason: RiskReason;
  explanation: string;
  recommended_action: string;
  confidence: number;
  escalation_target: EscalationTarget;
  model_used: string;
  prompt_version: string;
  was_lost_later: boolean;
  created_at?: Date;
}

export interface ScanRun {
  id?: number;
  started_at: Date;
  completed_at?: Date;
  total_deals: number;
  high_risk_count: number;
  errors: number;
  summary?: Record<string, unknown>;
}

// --- API Response Types ---

export interface ScanResult {
  total: number;
  analyzed: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  errors: number;
  duration_ms: number;
}

// --- Configuration ---

export interface AppConfig {
  hubspot: {
    accessToken: string;
    pipelineIds: string[];
  };
  gong: {
    accessKey: string;
    accessSecret: string;
  };
  gemini: {
    apiKey: string;
  };
  anthropic: {
    apiKey: string;
  };
  database: {
    url: string;
  };
  slack: {
    webhookUrl: string;
  };
  cronSecret: string;
  mrrRoutingThreshold: number;
  highRiskDealValueThreshold: number;
}
