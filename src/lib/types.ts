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
  meetingOutcome?: string; // populated for meetings
  metadata?: Record<string, unknown>;
  // Email participant fields (semicolon-separated email lists)
  emailTo?: string;
  emailCc?: string;
  emailFrom?: string;
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

// --- Contact Types ---

export interface DealContact {
  id: string;
  email: string | null;
  job_title: string | null;
  persona_group: string | null;
  persona_seniority: string | null;
}

export interface EngagementDiscoveredContact {
  email: string;
  job_title: string | null;
  persona_group: string | null;
  persona_seniority: string | null;
  source: 'email' | 'meeting';
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
    stage: string | null;
    pipeline: string | null;
    days_in_stage: number | null;
    days_since_creation: number | null;
    close_date: string | null;
    close_date_drift_days: number | null;
    forecast_category: string | null;
    owner_id: string | null;
    num_contacts: number;

    // Company & Team
    company_size: string | null;
    industry: string | null;
    clay_industry: string | null;

    // Champions / Decision Makers
    champion_email: string | null;
    decision_maker_email: string | null;
    contacts_job_titles: string | null;

    // Use Cases
    primary_use_case: string | null;
    secondary_use_cases: string | null;
    riverside_use_case: string | null;

    // Budget (pipeline-conditional)
    budget_scoring: string | null;
    economic_buyer_stage: string | null;
    metrics_stage: string | null;

    // Competition
    competition_stage: string | null;
    competitive: string | null;
    competitors_considered: string | null;

    // Pricing
    customer_plan: string | null;
    pricing_package: string | null;
    add_on_licenses: string | null;
    add_on_productions: string | null;
    webinar_add_on_mrr: string | null;
    num_accounts_given: string | null;
    num_productions_given: string | null;

    // Pain (Enterprise only)
    pain_net_new: string | null;
    pain_vs_pro: string | null;

    // Notes
    notes: string | null;
    manager_notes: string | null;

    // MEDPICC (Enterprise only)
    decision_process_stage: string | null;
    paper_process_stage: string | null;
    champion_stage: string | null;

    // Associated contacts
    contacts: DealContact[];

    // Contacts discovered from email threads and meeting attendees (not formally associated)
    engagement_discovered_contacts: EngagementDiscoveredContact[];
    total_engaged_contacts: number;
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
  owner_name: string | null;
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
  is_deal_open?: boolean;
  deal_metadata?: Record<string, unknown> | null;
  engagement_metrics?: DealActivityMetrics | null;
  deal_analysis?: string | null;
  email_analysis?: string | null;
  transcript_analysis?: string | null;
  risk_type_change_date?: Date | null;
  created_at?: Date;
}

export interface ScanRun {
  id?: number;
  started_at: Date;
  completed_at?: Date;
  total_deals: number;
  high_risk_count: number;
  errors: number;
  trigger_source: 'cron' | 'manual' | 'test';
  summary?: Record<string, unknown>;
  user_id?: string | null;
  user_email?: string | null;  // from JOIN, for display
}

export interface UserActivity {
  user_id: string;
  last_login_at: Date | null;
  last_active_at: Date | null;
}

export interface RiskCounts {
  total: number;
  high: number;
  medium: number;
  low: number;
  pipelineBreakdown: {
    total: Record<string, number>;
    high: Record<string, number>;
    medium: Record<string, number>;
    low: Record<string, number>;
  };
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
  anthropicChat: {
    apiKey: string;
  };
  cronSecret: string;
  mrrRoutingThreshold: number;
  highRiskDealValueThreshold: number;
}
