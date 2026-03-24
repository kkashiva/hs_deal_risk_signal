# Sales Deal Risk Engine — AI Early Warning System

## Problem
By the time a deal is marked "Closed Lost" in a CRM, intervention is no longer possible. Risk signals exist much earlier in the sales cycle but are scattered across calls, notes, deal properties, and activity data, making them incredibly hard to detect consistently at scale.

## Solution
An AI-assisted system that continuously analyzes open deals to identify early risk signals and recommend corrective action before deals are lost.

The **Sales Deal Risk Engine** follows a multi-stage analysis pipeline built on **LangGraph**:
1. **Focused Analysis Nodes:** Each data source (Deal metadata, Emails, Gong transcripts) is processed in parallel by focused LLM prompts to extract concise summaries.
2. **Synthesis Node:** These summaries are combined with core deal context (Stage, Amount, etc.) to produce a final structured risk assessment.
3. **Multi-LLM Routing:** Dynamic routing based on deal size and stage (e.g., Gemini for smaller deals, Claude Opus for complex, high-value ones) with automatic per-node fallback to the alternate provider on errors.

![Multi Node LangGraph AI Agent](images/LangGraph_4node.png)
*Fig.1 Multi node LangGraph AI agent*

The system aggregates signals from:
* **Gong** call transcripts (processed via dedicated extraction prompt).
* **HubSpot** deal metadata (Amount, MRR, Stage, Close Date Drift, Pipeline).
* **Sales Activity** (Full email threads analyzed for engagement sentiment and gaps).

---

## Business Impact
* **Improved Win Rates** through timely, guided intervention.
* **Better Forecast Reliability** and structured deal inspection.
* **Automated Visibility**: High-risk deals are pushed directly to managers/execs via Slack and a live dashboard.

---

## Tech Stack & Architecture

Built as a serverless-native **Next.js (App Router)** application, designed for easy deployment on **Vercel**.

* **Framework:** Next.js 15+ (TypeScript, React Server Components)
* **Orchestration:** **LangGraph** (`@langchain/langgraph`) for multi-node StateGraph pipelines.
* **CRON:** Vercel Cron (Runs daily at 6 AM UTC)
* **Database:** Vanilla PostgreSQL (`pg` library) for historical `risk_evaluations` and node outputs.
* **APIs & Integrations:**
  * `@hubspot/api-client`
  * Gong REST API (`axios`)
  * Google Gemini (`@google/generative-ai`)
  * Anthropic Claude (`@anthropic-ai/sdk`)
  * Slack Webhooks (`@slack/webhook`)
* **Styling:** Vanilla CSS (`globals.css`) for a sleek, dark-mode, glassmorphic UI.
* **Auth:** Shared-password gate via Next.js middleware + HttpOnly cookie.

---

## Features

### 1. Pipeline Risk Dashboard
A beautiful, interactive Next.js dashboard that displays summary metrics, sortable deal tables, and client-side filtering by Pipeline, Risk Level, Deal Amount, Close Date, and Risk Level Change Date.

![Deal Risk Dashboard Table](images/dashboard_table.png)
*Fig.2 Deal Risk Dashboard - Users can filter and edit columns*
<br><br>


### 2. Deal Risk Analysis and Recommendations
A deep dive showing the current assessment, AI explanation, recommended action, and a full historical timeline of previous evaluations.

![Deal Detail Top](images/deal_details_top.png)
*Fig.3 Deal Detail - AI Risk Evaluation & Recommended Action*
<br><br>

![Deal Detail Top](images/deal_details_mid.png)
*Fig.4 Deal Detail - Detailed analysis of Deal properties, Emails & Meeting Transcripts*
<br><br>

![Deal Detail Top](images/deal_details_bottom.png)
*Fig. 5 Deal Detail - Historical Risk Trends*
<br><br>

The engine uses a multi-node LangGraph architecture to analyze different attributes of each deal, then outputs a final result. This reduces prompt "hallucination" and ensures high-fidelity extraction from long email threads and transcripts.

### 3. Password Authentication
All pages and API routes are protected by a shared password set via the `AUTH_PASSWORD` environment variable. Unauthenticated users are redirected to `/login`.

### 4. Daily Scheduled Risk Scan (`/api/cron/risk-scan`)
A Vercel cron job that:
* **Fetches & Enriches:** Pulls deals across pipelines, adding full activity/transcript context.
* **Evaluates:** Runs the LangGraph pipeline to generate a structured JSON risk assessment.
* **Persists:** Stores the final result AND intermediate node outputs (`deal_analysis`, `email_analysis`, `transcript_analysis`) for deep visibility.
* **Write-back:** Updates HubSpot custom properties and creates Tasks for HIGH risk deals.
* **Slack Alerts:** Pings the team with summaries and leadership alerts for high-value deals.


---
## Setup & Deployment

### 1. Database Setup
Create a PostgreSQL database (e.g., Neon or Supabase) and run the migrations in order:
```bash
psql $DATABASE_URL < src/db/migrations/001_init.sql
psql $DATABASE_URL < src/db/migrations/002_add_pipeline.sql
psql $DATABASE_URL < src/db/migrations/003_add_deal_context.sql
psql $DATABASE_URL < src/db/migrations/004_add_is_deal_open.sql
psql $DATABASE_URL < src/db/migrations/005_add_node_outputs.sql
psql $DATABASE_URL < src/db/migrations/006_add_owner_name.sql
psql $DATABASE_URL < src/db/migrations/007_add_risk_type_change_date.sql
```

### 2. Environment Variables
Copy `.env.example` to `.env.local` and populate:
```env
HUBSPOT_ACCESS_TOKEN=your_token
HUBSPOT_PIPELINE_IDS=9308023,9297003,89892425
GONG_ACCESS_KEY=your_key
GONG_ACCESS_SECRET=your_secret
GEMINI_API_KEY=your_gemini_key
ANTHROPIC_API_KEY=your_claude_key       # Optional
DATABASE_URL=postgresql://user:pass@host/db
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
CRON_SECRET=your_secure_random_string
AUTH_PASSWORD=your_shared_password      # Dashboard login password
HIGH_RISK_DEAL_VALUE_THRESHOLD=10000
MRR_ROUTING_THRESHOLD=1200
```

### 3. Local Development
```bash
npm install
npm run dev
# Dashboard runs on http://localhost:3000
```

### 4. Manual Scanning
You can trigger the risk scan manually from the terminal using `curl`.

**Full Scan:**
```bash
curl -X GET "http://localhost:3000/api/cron/risk-scan" \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Specific Deal:**
```bash
curl -X GET "http://localhost:3000/api/cron/risk-scan?deal_id=YOUR_DEAL_ID" \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Specific Pipeline:**
```bash
curl -X GET "http://localhost:3000/api/cron/risk-scan?pipeline_id=YOUR_PIPELINE_ID" \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 5. Deploy to Vercel
Deploy the application to Vercel. Ensure **all environment variables** (including `AUTH_PASSWORD`) are added to the Vercel project settings. The cron job is pre-configured in `vercel.json` and will run automatically.
```bash
npx vercel --prod
```
