# Sales Deal Risk Engine — AI Early Warning System

## Problem
By the time a deal is marked "Closed Lost" in a CRM, intervention is no longer possible. Risk signals exist much earlier in the sales cycle but are scattered across calls, notes, deal properties, and activity data, making them incredibly hard to detect consistently at scale.

## Solution
An AI-assisted system that continuously analyzes open deals to identify early risk signals and recommend corrective action before deals are lost.

The **Sales Deal Risk Engine** aggregates signals from:
* **Gong** call transcripts (last 1-2 calls)
* **HubSpot** deal metadata (Amount, MRR, Stage, Close Date Drift, Pipeline, Forecast Category)
* **Sales Activity** (Emails, Notes, Meetings, Calls, No-shows, cadence gaps)

Using multi-LLM routing (Gemini for small deals, Claude for large/late-stage deals), the system evaluates the data against the MEDDPICC sales methodology and deal velocity patterns to output a structured JSON risk assessment.

### Key Outputs:
1. **Risk Classification:** `LOW`, `MEDIUM`, or `HIGH`
2. **Primary Risk Reason:** e.g., `budget`, `timing`, `no_champion`, `competition`, `feature_gap`, `low_engagement`, `multithreading_gap`
3. **Actionable Insights:** AI-generated explanation with evidence + a recommended specific next action for the AE.
4. **Escalation Targets:** Flags deals that require Manager or Executive/Cofounder intervention.

---

## Business Impact
* **Improved Win Rates** through timely, guided intervention.
* **Better Forecast Reliability** and structured deal inspection.
* **Automated Visibility**: High-risk deals are pushed directly to managers/execs via Slack and a live dashboard.

---

## Tech Stack & Architecture

Built as a serverless-native **Next.js (App Router)** application, designed for easy deployment on **Vercel**.

* **Framework:** Next.js 16 (TypeScript, React Server Components)
* **CRON:** Vercel Cron (Runs daily at 6 AM UTC)
* **Database:** Vanilla PostgreSQL (`pg` library, no ORM) for storing historical `risk_evaluations` and `scan_runs`.
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

### 1. Password Authentication
All pages and API routes are protected by a shared password set via the `AUTH_PASSWORD` environment variable. Unauthenticated users are redirected to `/login`. A **Logout** button is available in the nav. This is designed to be replaced with proper user auth (e.g. Google Sign-In) in a future iteration.

### 2. Daily Scheduled Risk Scan (`/api/cron/risk-scan`)
A Vercel cron job that fetches open deals across configured HubSpot pipelines, enriches them with activity/transcript data, and evaluates them using AI.
* **Write-back to HubSpot:** Updates custom AI properties on the deal and creates a HubSpot Task for HIGH risk deals.
* **Write to Database:** Stores the full evaluation to track prediction accuracy over time.
* **Slack Alerts:** Pings the team with a summary of the scan and alerts leadership for high-value HIGH risk deals.

### 3. Live Risk Dashboard
A beautiful, interactive Next.js dashboard that displays:
* Summary metrics (Total Scanned, High/Medium/Low Risk counts) with per-pipeline breakdowns.
* A sortable table of all evaluated deals.
* **Client-side filtering** by Pipeline, Risk Level, Primary Risk, Close Date range, and Deal Amount (Min/Max).
* Manual trigger to run the risk scan on-demand.

### 4. Deal Detail View
A deep dive into a specific deal showing the current risk assessment, AI explanation, recommended action, and a full historical timeline of previous evaluations to track how the deal's health has changed over time.

---

## Setup & Deployment

### 1. Database Setup
Create a PostgreSQL database (e.g., Neon or Supabase) and run the initialization migrations:
```bash
psql $DATABASE_URL < src/db/migrations/001_init.sql
psql $DATABASE_URL < src/db/migrations/002_add_pipeline.sql
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
