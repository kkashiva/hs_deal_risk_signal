# Contributing to Sales Deal Risk Engine

Thank you for your interest in contributing! We welcome contributions of all kinds—bug reports, feature suggestions, code improvements, and documentation enhancements.

## Code of Conduct

This project is committed to fostering an inclusive and welcoming community. Please be respectful, constructive, and supportive when interacting with other contributors.

## Getting Started

### Prerequisites
- **Node.js**: v18 or higher
- **npm**: v9 or higher
- **PostgreSQL**: For local database setup
- **Git**: For version control

### Setup Development Environment

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/hs_deal_risk_signal.git
   cd hs_deal_risk_signal
   ```
2. **Install Dependencies**
```bash
npm install
```

3. **Environment Configuration**
- Copy .env.example to .env.local
- Fill in the required environment variables:
```env
HUBSPOT_ACCESS_TOKEN=your_token
GONG_ACCESS_KEY=your_key
GONG_ACCESS_SECRET=your_secret
GEMINI_API_KEY=your_key
DATABASE_URL=postgresql://user:pass@localhost/hs_deal_risk
AUTH_PASSWORD=dev_password
CRON_SECRET=your_secret
```

4. **Database Setup** (if working with database features)
```bash
# Create PostgreSQL database
createdb hs_deal_risk

# Run migrations
psql hs_deal_risk < src/db/migrations/001_init.sql
psql hs_deal_risk < src/db/migrations/002_add_pipeline.sql
```

5. **Start Development Server**
```bash
npm run dev
```
The app will run at http://localhost:3000

## Project Structure
```code
hs_deal_risk_signal/
├── src/
│   ├── app/                    # Next.js App Router pages & layouts
│   │   ├── dashboard-client.tsx   # Main dashboard component (client-side filtering)
│   │   ├── login/              # Authentication page
│   │   ├── deal/               # Deal detail pages
│   │   └── api/                # API routes
│   │       ├── cron/           # Scheduled cron jobs
│   │       ├── deals/          # Deal endpoints
│   │       └── ...
│   ├── db/                     # Database utilities
│   │   ├── migrations/         # SQL migrations
│   │   └── queries.ts          # Database query functions
│   ├── lib/                    # Utility functions
│   │   ├── hubspot.ts          # HubSpot API integration
│   │   ├── gong.ts             # Gong API integration
│   │   ├── gemini.ts           # Google Gemini integration
│   │   ├── claude.ts           # Anthropic Claude integration
│   │   └── slack.ts            # Slack webhooks
│   └── styles/
│       └── globals.css         # Global styles
├── package.json
├── tsconfig.json
└── vercel.json                 # Cron job configuration
```

## Code Style & Standards

### Typescript
- Strict Mode: Always enable. Use proper type annotations.
- Naming: Use camelCase for variables/functions, PascalCase for types/interfaces/components
- Imports: Group imports (React, external libraries, then local modules)

### Next.js
- Server Components: Use by default in App Router
- Client Components: Mark with 'use client' only when needed (interactivity, hooks)
- Hooks: Avoid unnecessary re-renders with proper dependency arrays
- Component Structure: Keep components focused and single-responsibility

### CSS
- Use Tailwind CSS classes or vanilla CSS modules
- Avoid inline styles: Keep styling in CSS files or Tailwind
- Dark Mode: The app uses a dark theme; maintain consistency

## Contribution Workflow
1. Create an Issue or Find One. Look for issues with labels 'good first issue', 'help wanted'.
2. Comment on the issue to express interest and ask to assign ownership if you're confident of implementation plan.
3. Fork the repository: Click the 'Fork' button on the top right corner of the repository page.
4. Create a feature branch. Create a new branch for your feature or bug fix:
    ```bash
    git checkout -b my-new-feature
    ```
5. Make your changes: Implement your feature or fix the bug.
6. Commit your changes: Write meaningful commit messages and commit your changes
    ```bash
    git commit -m 'Added feature which does XYZ'
    ```
7. Push to the branch: Push your changes to your forked repository
    ```bash
    git push origin my-new-feature
    ```
8. Create a pull request: Go to the original repository and click on 'New Pull Request'. Select your feature branch for the comparison and submit the pull request.

Thank you for contributing!

