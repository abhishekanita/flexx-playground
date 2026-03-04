# Frontend Data Schema Reference

Everything the frontend needs to render the dashboard, insight cards, and job activity monitor.

Two MongoDB collections serve the frontend:
- `mfs.user.insights` — user-facing data (dashboard + cards)
- `mfs.job.runs` — job tracking / admin monitoring

---

## 1. User Insights (`mfs.user.insights`)

**Query**: `{ pan } sorted by { generatedAt: -1 }` — always fetch the latest version.

```typescript
{
  pan: string;
  email: string;
  version: number;                    // auto-incremented per user
  generatedAt: Date;
  trigger: 'initial' | 'sync' | 'scheduled' | 'manual';

  dashboardData: DashboardData;       // always present (pure computation)
  insightCards: InsightCardsResult | null;  // null if LLM failed/unavailable
  insightCardsStatus: 'pending' | 'ready' | 'failed';

  nextScheduledRefresh: Date;
  llmCostUsd: number;                // cost of LLM calls for this generation
}
```

> **Note**: `analysis` is also stored but is a large internal blob. Don't fetch it for the UI — only use `dashboardData` and `insightCards`.

---

## 2. DashboardData

All values are pre-computed. No formatting needed on the frontend except ₹/% display.

### 2.1 Hero Stats

```typescript
heroStats: {
  currentValueRs: number;       // e.g. 547832
  unrealisedGainRs: number;     // e.g. 63140
  unrealisedGainPct: number;    // e.g. 13.02 (already ×100)
  xirr: number;                 // e.g. 14.5 (already ×100, percentage)
  activeFunds: number;          // e.g. 12
  lifetimePnLRs: number;        // can be NEGATIVE — e.g. -24150
  lifetimePnLPct: number;       // can be NEGATIVE
}
```

**UI**: Show `currentValueRs` as the big number. Color-code `unrealisedGainRs` and `lifetimePnLRs` (green/red). Show XIRR as the return metric.

### 2.2 Real-World Equivalents

```typescript
realWorldEquivalents: Array<{
  emoji: string;        // "🎬" "⛽" "🛒"
  label: string;        // "Movie nights for 2"
  displayCount: string; // "7" or "141%"  — already formatted
  subtext: string;      // "at ₹900 each"
}>
```

**UI**: Grid of fun equivalents cards. `displayCount` is already a display string — render as-is. Tiered by portfolio size (small gains get movie nights, large gains get international trips).

### 2.3 Fund Race

```typescript
fundRace: Array<{
  schemeName: string;     // full name
  shortName: string;      // 2-3 word abbreviated name
  gainPct: number;        // e.g. 24.5
  xirr: number | null;    // null if unreliable
  marketValueRs: number;
  plan: string;           // "Direct" | "Regular"
  color: string;          // hex color, e.g. "#10B981"
  xirrReliability: string; // "reliable" | "unstable" | "too_short"
}>
```

**UI**: Horizontal bar chart sorted by `gainPct`. Use `shortName` for labels, `color` for bars. Show `xirr` only if `xirrReliability === 'reliable'`.

### 2.4 Portfolio Map (Treemap)

```typescript
portfolioMap: Array<{
  schemeName: string;
  shortName: string;
  weightPct: number;      // e.g. 22.5 (sums to ~100)
  gainPct: number;
  marketValueRs: number;
  color: string;          // hex
}>
```

**UI**: Treemap where block size = `weightPct`, color = `color` (green shades for gains, red for losses).

### 2.5 Investment Heatmap

```typescript
heatmap: Array<{
  year: string;           // "2023", "2024"
  totalInvestedRs: number;
  totalWithdrawnRs: number;
  months: Array<{
    month: number;        // 1-12
    investedRs: number;
    withdrawnRs: number;
  }>;
}>
```

**UI**: Calendar heatmap grid. Intensity = `investedRs`. Show `withdrawnRs` as a different color or overlay.

### 2.6 Benchmark Comparison

```typescript
benchmarkBars: Array<{
  name: string;          // "Your Portfolio", "Nifty 50", "FD @7%"
  xirr: number;         // e.g. 14.5
  isPortfolio: boolean;  // true for the user's portfolio bar
  color: string;         // hex
}>
```

**UI**: Horizontal bar chart. Highlight the `isPortfolio: true` bar differently.

### 2.7 Fund Cards

```typescript
fundCards: Array<{
  schemeName: string;
  shortName: string;
  gainPct: number;
  xirr: number | null;
  xirrReliability: string;
  marketValueRs: number;
  weightPct: number;
  plan: string;              // "Direct" | "Regular"
  holdingDays: number;
  personality: string;       // "Star Performer" | "Quiet Compounder" | "Underperformer" | etc.
  personalityDescription: string;  // 1-line explanation
  benchmarkGapPp: number | null;   // percentage points vs benchmark
  benchmarkName: string | null;
  color: string;
  isRegular: boolean;
}>
```

**UI**: Expandable cards for each active fund. Show `personality` as a badge. If `isRegular`, show a "Switch to Direct" nudge.

### 2.8 Closed Funds

```typescript
closedFunds: Array<{
  schemeName: string;
  shortName: string;
  investedRs: number;
  redeemedRs: number;
  pnlRs: number;
  pnlPct: number;
}>
```

**UI**: Collapsible table. Color-code `pnlRs`/`pnlPct` green/red.

---

## 3. InsightCards

The main card-based insight system. Cards use **bold** and *italic* markdown — render with a markdown component.

### 3.1 Top-Level

```typescript
{
  greeting: string;       // "Hey Abhishek, your **₹5.47L** portfolio..."
  homeSummary: string;    // 1-line for home screen / notification (max 15 words)
  cards: InsightCard[];   // sorted by priority ascending (1 = most important)
}
```

### 3.2 InsightCard

```typescript
{
  id: string;             // "perf_headline", "action_nominee", "anomaly_GOLD_BEATING_EQUITY"
  type: CardType;         // see below
  sentiment: CardSentiment;  // see below
  priority: number;       // 1 = show first
  emoji: string;          // "📈" "⚠️" "💡"
  title: string;          // max 5 words, uses markdown
  headline: string;       // main insight, 1-2 sentences, uses **bold** for numbers
  context: string;        // follow-up, 1-2 sentences, uses markdown
  highlightMetric?: {
    value: string;        // "₹24,000" or "17.8%"
    label: string;        // "earned for you"
    trend: 'up' | 'down' | 'neutral';
  };
  action?: {
    label: string;        // "Review nominees"
    type: 'review' | 'learn' | 'act_now' | 'explore';
    urgent?: boolean;     // if true, show as red/prominent CTA
  };
  learnAbout?: {
    topic: string;        // "XIRR vs Absolute Return"
    preview: string;      // 1-sentence teaser
    deepDive: string;     // 3-5 sentence plain English explainer
    analogy?: string;     // optional analogy
  };
  tags?: Array<{
    label: string;        // "Holding period"
    value: string;        // "2.4 years"
  }>;  // max 3
}
```

### 3.3 Card Types

| Type | What it covers |
|---|---|
| `performance` | Overall portfolio performance, star/worst performers |
| `behavior` | SIP consistency, investment patterns |
| `risk` | Regular vs Direct plan costs, concentration risk |
| `action` | Nominee registration, fund switches — things to do |
| `fun_fact` | Light/interesting observations about the portfolio |
| `anomaly` | System-detected anomalies (misleading gains, too many funds, etc.) |

### 3.4 Card Sentiments

| Sentiment | UI treatment |
|---|---|
| `positive` | Green accent, upward indicators |
| `negative` | Red accent, downward indicators |
| `warning` | Amber/yellow accent, alert icon |
| `neutral` | Default/grey styling |
| `curious` | Blue/purple accent, question/lightbulb icon |

### 3.5 Rendering Rules

1. **Sort** cards by `priority` (already sorted, but verify).
2. **Markdown**: `headline`, `context`, `title`, and `greeting` all contain `**bold**` and `*italic*` markdown. Use a lightweight markdown renderer.
3. **HighlightMetric**: If present, render as a prominent number with trend arrow (↑/↓/→).
4. **Action button**: If `action.urgent === true`, render as a red/alert CTA.
5. **LearnAbout**: Render as an expandable "Learn more" section at the bottom of the card.
6. **Tags**: Render as small chips below the card content.

---

## 4. Job Runs (`mfs.job.runs`) — Admin/Monitoring

Collection for tracking every pipeline job. Useful for an admin panel showing job history, AI costs, and failure rates.

### 4.1 Document Shape

```typescript
{
  _id: ObjectId;
  pan: string | null;
  email: string | null;

  jobType: 'insights_generation' | 'statement_acquisition' | 'sync';
  jobId: string;                // UUID
  trigger: 'initial' | 'sync' | 'scheduled' | 'manual';

  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;    // auto-computed on completion
  error: string | null;         // error message if failed

  aiUsage: JobAIUsage[];        // per-model breakdown (see below)
  totalAICostUsd: number;       // sum of all model costs
  totalTokens: number;          // sum of all input+output tokens

  metrics: {
    insightCardsGenerated: number | null;
    anomaliesDetected: number | null;
    gapCardsFound: number | null;
    dashboardComputed: boolean;
    isFirstRun: boolean;
    analysisVersion: number | null;
  };

  context: Record<string, any>;  // debug context (activeFolios, etc.)
  createdAt: Date;               // Mongoose timestamp
  updatedAt: Date;               // Mongoose timestamp
}
```

### 4.2 JobAIUsage (per-model breakdown)

Each entry in `aiUsage[]` represents one model used during the job:

```typescript
{
  model: string;         // "gpt-4o-mini", "gpt-4o"
  calls: number;         // how many LLM calls used this model
  tokens: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    cacheWriteTokens: number;
  };
  cost: {
    inputCost: number;        // USD
    cachedInputCost: number;  // USD
    cacheWriteCost: number;   // USD
    outputCost: number;       // USD
    totalCost: number;        // USD
  };
}
```

### 4.3 Real Example (from Ashu's generation)

```json
{
  "jobType": "insights_generation",
  "trigger": "sync",
  "status": "completed",
  "durationMs": 18432,
  "totalAICostUsd": 0.0093,
  "totalTokens": 9576,
  "aiUsage": [
    {
      "model": "gpt-4o-mini",
      "calls": 7,
      "tokens": { "inputTokens": 6457, "outputTokens": 477, "cachedInputTokens": 0, "cacheWriteTokens": 0 },
      "cost": { "inputCost": 0.00097, "cachedInputCost": 0, "cacheWriteCost": 0, "outputCost": 0.00029, "totalCost": 0.00126 }
    },
    {
      "model": "gpt-4o",
      "calls": 3,
      "tokens": { "inputTokens": 2455, "outputTokens": 187, "cachedInputTokens": 0, "cacheWriteTokens": 0 },
      "cost": { "inputCost": 0.00614, "cachedInputCost": 0, "cacheWriteCost": 0, "outputCost": 0.00187, "totalCost": 0.00801 }
    }
  ],
  "metrics": {
    "insightCardsGenerated": 10,
    "anomaliesDetected": 9,
    "gapCardsFound": 2,
    "dashboardComputed": true,
    "isFirstRun": false,
    "analysisVersion": 3
  }
}
```

### 4.4 Querying Job Runs

Available service methods (wire as API endpoints as needed):

| Method | Query | Returns |
|---|---|---|
| `getLatestForPan(pan)` | `{ pan }` sorted by `startedAt: -1` | Latest job for a user |
| `getRecent(limit=20)` | All jobs sorted by `startedAt: -1` | Recent jobs across all users |
| `getRecentByType(jobType, limit=20)` | `{ jobType }` sorted by `startedAt: -1` | Recent jobs of a specific type |
| `getFailedJobs(limit=50)` | `{ status: 'failed' }` sorted by `startedAt: -1` | Failed jobs for debugging |
| `getTotalCost(since: Date)` | Aggregation on completed jobs since date | `{ totalCost, jobCount }` |

### 4.5 Indexes

```
{ pan: 1, startedAt: -1 }      // user's job history
{ jobType: 1, startedAt: -1 }  // filter by type
{ status: 1 }                  // find running/failed jobs
```

---

## 5. Frontend UI Suggestions

### Dashboard Screen
1. **Hero section**: `heroStats` — big current value, gain/loss, XIRR
2. **Equivalents strip**: `realWorldEquivalents` — horizontal scroll of fun cards
3. **Fund race**: `fundRace` — horizontal bar chart
4. **Portfolio map**: `portfolioMap` — treemap visualization
5. **Heatmap**: `heatmap` — calendar grid
6. **Benchmark**: `benchmarkBars` — bar chart comparison
7. **Fund cards**: `fundCards` — expandable list/grid
8. **Closed funds**: `closedFunds` — collapsible table

### Insights Screen
1. **Greeting**: `insightCards.greeting` at top
2. **Cards**: `insightCards.cards` in priority order
3. **Home summary**: `insightCards.homeSummary` for notification/widget

### Admin/Monitoring Screen
1. **Job history table**: `getRecent()` — status, duration, cost, card count
2. **AI cost tracker**: `getTotalCost(since)` — running total with date filter
3. **Model breakdown**: Expand `aiUsage[]` to show per-model token/cost split
4. **Failure log**: `getFailedJobs()` — shows error messages and trigger context

---

## 6. Status Handling

```
insightCardsStatus:
  'ready'   → show cards normally
  'pending' → show skeleton/loading state (generation in progress)
  'failed'  → show fallback message, dashboard still works

jobRun.status:
  'running'   → show spinner, disable re-trigger
  'completed' → show green check, display metrics
  'failed'    → show red X, display error message
```

Dashboard data (`dashboardData`) is always available regardless of `insightCardsStatus` — it's pure computation with no LLM dependency.
