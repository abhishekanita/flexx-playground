# MF Insights — Frontend Design Spec

**For:** Frontend developer  
**Stack:** Next.js (App Router) · shadcn/ui · Tailwind CSS · Recharts  
**Theme:** Light · Internal playground · Production-quality feel  
**Last updated:** March 2026

---

## 1. Context

This is an internal tool that parses CAMS mutual fund statements and surfaces portfolio insights for non-financially savvy users. Think of it as a personal finance co-pilot — not a Bloomberg terminal, not a bank passbook. The experience needs to feel smart, calm, and trustworthy — like a financially literate friend explained your money to you.

**Target user:** Ashu-style investor. Understands ₹ but not XIRR. Checks this once a month. On a laptop, probably Chrome, 1440px screen.

**Three pages:**

-   **Dashboard** — visual overview, charts, fun context
-   **Insights** — AI-generated insight cards with bold/italic markdown
-   **Funds** — fund-by-fund breakdown

---

## 2. Design Tokens

### Colors

Use CSS variables in `globals.css`. All colors are **light theme only** for this build.

```css
:root {
    /* Backgrounds */
    --bg: #f8f9fb; /* page background — very slightly warm grey */
    --surface: #ffffff; /* cards, panels */
    --surface-2: #f1f4f8; /* nested surfaces, table stripes */

    /* Borders */
    --border: #e4e8f0;
    --border-strong: #c8d0dc;

    /* Text */
    --text: #0f172a; /* primary */
    --text-muted: #64748b; /* secondary */
    --text-subtle: #94a3b8; /* placeholder, labels */

    /* Brand accent */
    --amber: #d97706; /* primary action, highlights */
    --amber-light: #fef3c7; /* amber chip backgrounds */
    --amber-dim: #fbbf24; /* softer amber, charts */

    /* Semantic */
    --green: #059669;
    --green-light: #d1fae5;
    --red: #dc2626;
    --red-light: #fee2e2;
    --blue: #2563eb;
    --blue-light: #dbeafe;
    --yellow: #d97706;
    --yellow-light: #fef3c7;
}
```

### Typography

```css
/* In layout.tsx */
import { Lora, DM_Sans } from 'next/font/google';

const lora = Lora({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-display',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-body',
});
```

| Use                        | Font         | Weight  | Size    |
| -------------------------- | ------------ | ------- | ------- |
| Big numbers (hero, metric) | Lora (serif) | 700     | 36–48px |
| Section headings           | DM Sans      | 800     | 18–22px |
| Card titles                | DM Sans      | 700     | 15–16px |
| Body / descriptions        | DM Sans      | 400–500 | 13–14px |
| Labels / chips             | DM Sans      | 600     | 11–12px |
| Muted meta                 | DM Sans      | 400     | 11px    |

### Spacing

Stick to Tailwind's scale. Key spacings used everywhere:

-   **Card padding:** `p-6` (24px)
-   **Card gap:** `gap-4` (16px) in grids, `gap-6` between sections
-   **Section margin:** `mb-10` between major sections
-   **Inner element gap:** `gap-2` or `gap-3`
-   **Page padding:** `px-8 py-8` on the main content wrapper

### Shadows & Borders

```css
/* Custom shadow utilities — add to tailwind.config */
boxShadow: {
  card: '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
  'card-hover': '0 4px 12px rgba(15,23,42,0.10), 0 2px 4px rgba(15,23,42,0.06)',
  'card-active': '0 0 0 2px var(--amber)',
}
```

All cards use `rounded-2xl` (16px), borders use `border border-[--border]`.

---

## 3. Layout

### Shell

```
┌─────────────────────────────────────────┐
│  Sidebar (240px fixed)                  │
│  ┌──────────────────────────────────┐   │
│  │  Logo + "MF Insights"            │   │
│  │  ──────────────────────          │   │
│  │  📊 Dashboard                    │   │
│  │  💡 Insights          ← badge 1  │   │
│  │  📁 Funds                        │   │
│  │  ──────────────────────          │   │
│  │  ⚙️  Settings                    │   │
│  └──────────────────────────────────┘   │
│                                         │
│  Main content area (flex-1)             │
│  px-8 py-8, bg-[--bg]                  │
└─────────────────────────────────────────┘
```

-   Sidebar: `bg-white border-r border-[--border]`, `w-60`, fixed height
-   Nav items: use shadcn `Button variant="ghost"` with `justify-start gap-3 w-full`
-   Active state: `bg-amber-50 text-amber-700 font-semibold`
-   Urgent badge: red dot on Insights nav item when action cards exist

### Main content max-width

Wrap in `max-w-6xl mx-auto` — don't let it go full width at 1440px, it looks sparse.

---

## 4. shadcn Components Used

Install these upfront:

```bash
npx shadcn@latest add card badge button tabs separator tooltip
npx shadcn@latest add scroll-area sheet dialog progress
```

| shadcn Component                      | Used for                                 |
| ------------------------------------- | ---------------------------------------- |
| `Card` + `CardContent` + `CardHeader` | Every visual panel                       |
| `Badge`                               | Sentiment tags, fund plan labels, URGENT |
| `Button`                              | CTAs on insight cards, filter pills      |
| `Tabs` + `TabsList` + `TabsTrigger`   | Filter bar on Insights page              |
| `Separator`                           | Section dividers                         |
| `Tooltip`                             | Heatmap cells, chart data points         |
| `Sheet`                               | "Learn About" bottom/side drawer         |
| `Dialog`                              | Fund detail modal (optional)             |
| `ScrollArea`                          | Insights card list, fund list            |
| `Progress`                            | Performance bars in Fund Race            |

---

## 5. Page: Dashboard

### 5.1 Hero row

Full-width card at the top. Three columns:

```
┌──────────────────────────────────────────────────────┐
│  Portfolio Value          Gain            XIRR        │
│  ₹3,23,510               ₹63,312 ↑       8.28%        │
│  as of today             +24.33%         annual       │
└──────────────────────────────────────────────────────┘
```

-   Portfolio value uses `font-display text-5xl font-bold text-[--text]`
-   Gain uses `text-green-600 font-bold text-2xl`
-   Animate the numbers on page load with a count-up effect (use `react-countup` or a simple `useEffect` counter over 1.2s)
-   Subtle green glow on the gain: `text-shadow: 0 0 20px rgba(5,150,105,0.2)` (inline style)
-   Below the three numbers: a thin row of chips — `Invested ₹2.6L` · `12 active funds` · `Lifetime P&L +₹1.3L`

### 5.2 Real-world equivalents

**Title:** "What your ₹63K gain could buy"  
**Layout:** 4-column grid of small cards

Each card:

```
┌─────────────────┐
│  ✈️              │
│  2×             │  ← large, font-display, amber color
│  Return flights │
│  Delhi → Bali   │
│  Economy season │  ← muted text-xs
└─────────────────┘
```

-   `Card` with `p-5`, `hover:shadow-card-hover transition-shadow`
-   The count ("2×", "3 months") in `font-display text-3xl text-[--amber]`
-   Four items: Flights, Groceries, Phone coverage, Streaming years

### 5.3 Fund Performance Race

**Title:** "Who's winning in your portfolio"  
Single `Card` with a vertical list of funds sorted by gain %.

Each row:

```
DSP                              +70.9%
████████████████████░░░░░░░░░░   (Progress bar)
₹59,824 · Regular plan · 1197 days
```

Use shadcn `Progress` component. Customise the fill color per fund using `style={{ '--progress-fill': fund.color }}` or override the class. Bar animates from 0 on mount (`transition-all duration-700`).

-   Positive gain: green fill, `text-green-600`
-   Negative gain: red fill, `text-red-600`
-   Each fund gets a colored left-border dot matching its color

### 5.4 Portfolio Map (Treemap)

**Title:** "Portfolio composition"  
Use `Recharts Treemap` — it's already in Recharts, no extra lib needed.

```tsx
import { Treemap, ResponsiveContainer } from 'recharts';

const data = funds.map(f => ({
    name: f.shortName,
    size: f.value,
    gainPct: f.gainPct,
    color: f.color,
}));
```

Custom content renderer: each block shows fund name, weight %, and gain % with color-coded text. Cells use `stroke="white" strokeWidth={2}` to separate them cleanly. Height: `h-64`.

### 5.5 Investment Journey Heatmap

**Title:** "Your investing history" · **Subtitle:** "Darker = more invested that month"

Grid layout: years as rows, months as columns. Each cell is a `Tooltip`-wrapped `div`.

```
     J  F  M  A  M  J  J  A  S  O  N  D
2022 ░  ░  ░  ░  ░  ░  ░  ▓  ▒  ▓  ▓  ▓
2023 ▒  ░  ▒  ░  ▒  ░  ▒  ▒  ▒  ░  ▒  ░
2024 ▓  ▓  ▓  ▓  ▓  ▓  ▓  ▓  ▓  ██ ▓  ▓
2025 ▒  ▒  ▒  ░  ░  ░  ░  ░  ░  ░  ░  ░
2026 ░  ▒  ░  ...
```

Cell styles:

-   `w-8 h-7 rounded-md cursor-pointer transition-transform hover:scale-110`
-   Empty month: `bg-slate-100`
-   Invested: amber scale — `opacity` from 0.2 (small) to 1.0 (large), `bg-amber-400`
-   Withdrawal month: `bg-red-200`
-   On hover: `Tooltip` shows `₹49,999 invested` or `₹9.1L withdrawn`

Note: 2024 will visually stand out immediately — it was ₹6.5L invested. That's the moment users will go "oh, that was when I went all in."

### 5.6 XIRR vs Benchmarks

**Title:** "How you compare"

Horizontal bar chart, 4 bars:

|                    |                         |
| ------------------ | ----------------------- |
| Bank FD            | 7.0%                    |
| **Your Portfolio** | **8.28%** ← highlighted |
| Nifty 500          | 12.15%                  |
| Nifty Next 50      | 14.51%                  |

Use `Recharts BarChart layout="vertical"`. Your portfolio bar gets `fill="var(--amber)"` and a subtle glow. Others get `fill="#e2e8f0"`. Show the % as a label at the end of each bar.

Add a callout below: `"You're beating FDs. The market indices are still ahead — something to aim for."` in a `Badge variant="outline"` style muted box.

### 5.7 Funds at a Glance

List of fund cards, one per fund sorted by portfolio weight.

Each card:

```
┌────────────────────────────────────────────────┐
│  ⭐ Superstar          DSP ELSS         +70.9%  │
│  Regular plan · 1,197 days held         ₹59,824 │
│  ████████████████████░░░░░░                      │
│  [XIRR 17.8%]  [18.5% of portfolio]             │
└────────────────────────────────────────────────┘
```

-   Personality label in small `Badge` with matching color
-   Gain % in `font-display text-2xl`
-   Regular plan triggers an amber warning chip: `⚠ Regular — fees apply`
-   Direct plan gets a green chip: `✓ Direct`

---

## 6. Page: Insights

### 6.1 Greeting banner

Full-width subtle card at top. Renders the `greeting` string from the API through the `<MD>` component (see section 8). Background: `bg-amber-50 border border-amber-200 rounded-2xl p-5`.

### 6.2 Filter bar

Use shadcn `Tabs` — not custom buttons.

```tsx
<Tabs defaultValue="all">
    <TabsList className="mb-6">
        <TabsTrigger value="all">All</TabsTrigger>
        <TabsTrigger value="action">⚡ Actions</TabsTrigger>
        <TabsTrigger value="performance">📈 Returns</TabsTrigger>
        <TabsTrigger value="risk">🛡️ Risk</TabsTrigger>
        <TabsTrigger value="behavior">🧠 Habits</TabsTrigger>
        <TabsTrigger value="fun_fact">🎲 Fun</TabsTrigger>
    </TabsList>
</Tabs>
```

Active tab: `bg-white shadow-sm text-[--text]`. Inactive: `text-[--text-muted]`.

### 6.3 Insight Cards

Cards are stacked in a `ScrollArea` with `max-h-[calc(100vh-240px)]`.

Each `InsightCard` renders as a shadcn `Card` with sentiment-based styling:

| Sentiment | Border left                   | Background       | Badge color |
| --------- | ----------------------------- | ---------------- | ----------- |
| positive  | `border-l-4 border-green-500` | `bg-green-50/50` | green       |
| negative  | `border-l-4 border-red-400`   | `bg-red-50/50`   | red         |
| warning   | `border-l-4 border-amber-400` | `bg-amber-50/50` | amber       |
| neutral   | `border-l-4 border-slate-300` | `bg-white`       | slate       |

Card anatomy:

```
┌─── Card ────────────────────────────────────────────┐
│  [emoji]  PERFORMANCE          ← type label, muted  │
│           Your Star Fund       ← card title, bold   │
│                                                      │
│  DSP made ₹24,824 for you — nearly double...        │
│  ← rendered through <MD> component                  │
│                                                      │
│  ┌──────────────────────┐                           │
│  │ ↑ ₹24,824            │  ← highlight metric       │
│  │ earned for you       │                           │
│  └──────────────────────┘                           │
│                                                      │
│  [Expanded: context text + tag chips]               │
│                                                      │
│  [Learn About: XIRR]   [Review this fund →]         │
└─────────────────────────────────────────────────────┘
```

-   **Collapsed by default.** Click anywhere to expand context + tags.
-   **Expand animation:** `max-h-0` → `max-h-96` with `transition-all duration-300 overflow-hidden`
-   **Urgent badge:** `<Badge variant="destructive">URGENT</Badge>` top-right corner
-   **Stagger on mount:** Each card gets `animation-delay: index * 60ms` via inline style

**Highlight metric block:**

```tsx
<div className="inline-flex flex-col rounded-xl bg-white border border-[--border] px-4 py-3 my-3 shadow-card">
    <span className="font-display text-2xl font-bold text-green-600">↑ ₹24,824</span>
    <span className="text-xs text-[--text-subtle] mt-0.5">earned for you</span>
</div>
```

**Tags (secondary data points):**

```tsx
{
    card.tags?.map(t => (
        <Badge key={t.l} variant="outline" className="text-xs font-medium">
            <span className="text-[--text-muted] mr-1">{t.l}:</span> {t.v}
        </Badge>
    ));
}
```

**Footer buttons:**

```tsx
{
    card.action && (
        <Button
            size="sm"
            variant={card.action.urgent ? 'default' : 'outline'}
            className={card.action.urgent ? 'bg-[--amber] text-white hover:bg-amber-600' : ''}
        >
            {card.action.label}
        </Button>
    );
}
{
    card.learn && (
        <Button size="sm" variant="ghost" onClick={() => setLearnOpen(true)}>
            📚 {card.learn.topic}
        </Button>
    );
}
```

### 6.4 Learn About Sheet

Use shadcn `Sheet` with `side="right"` on desktop, `side="bottom"` on mobile (detect with a small hook or just use bottom always at this screen size).

```tsx
<Sheet open={learnOpen} onOpenChange={setLearnOpen}>
    <SheetContent side="right" className="w-[400px]">
        <div className="text-xs font-bold uppercase tracking-widest text-[--amber] mb-2">Learn about</div>
        <h2 className="font-display text-2xl font-bold mb-4">{learn.topic}</h2>
        <p className="text-[--text-muted] leading-relaxed mb-5">{learn.deepDive}</p>
        {learn.analogy && (
            <div className="border-l-4 border-[--amber] bg-amber-50 rounded-r-xl p-4 text-sm italic text-slate-600">💡 {learn.analogy}</div>
        )}
    </SheetContent>
</Sheet>
```

---

## 7. Page: Funds

### 7.1 Summary row

Three mini-stats at the top: Active funds | Closed funds | Total ever invested. Use `Card` with `p-4`, smaller numbers.

### 7.2 Active funds list

`Card` with no internal padding. Use a table-like row structure (not an actual `<table>`):

```
┌────────────────────────────────────────────────────────┐
│ Fund name              Plan     Weight    Gain    XIRR  │
├────────────────────────────────────────────────────────┤
│ Parag Parikh ELSS      ⚠ Reg   25.1%    +8.1%   6.1%  │
│ Quantum ELSS           ⚠ Reg   21.6%    +39.4%  13.9% │
│ DSP ELSS               ⚠ Reg   18.5%    +70.9%  17.8% │
│  ...                                                    │
└────────────────────────────────────────────────────────┘
```

Row on click: expand inline (accordion style) to show:

-   A 3-col mini-stat grid: XIRR / Days held / Plan
-   Regular plan warning if applicable
-   A small sparkline of the fund's NAV trend (if data available later)

### 7.3 Closed / Exited funds

Same structure but visually dimmed: `opacity-60`. Collapsed section with a "Show 7 exited funds" `Button variant="ghost"` toggle.

---

## 8. The `<MD>` Component

This is critical — all LLM-generated text runs through it. The LLM produces inline markdown (`**bold**`, `*italic*`) and the component renders it correctly.

```tsx
// components/md.tsx
interface MDProps {
    text: string;
    accentColor?: string; // CSS color for bold text, defaults to current color
    className?: string;
}

export function MD({ text, accentColor, className }: MDProps) {
    // Parse **bold** and *italic* inline
    // Return <strong> and <em> elements
    // Bold inherits accentColor if provided
    // Never render block elements — this is always inline
}
```

**Rendering rules:**

-   `**text**` → `<strong className="font-bold" style={{ color: accentColor }}>text</strong>`
-   `*text*` → `<em className="not-italic opacity-80 font-medium">text</em>` (use font-medium italic-but-visually-subtle for contrast, not jarring italic)
-   Plain text → `<span>text</span>`
-   Parse left-to-right; `**` takes priority over `*`

**Usage everywhere:**

```tsx
<MD text={card.headline} accentColor="var(--text)" />
<MD text={card.context} accentColor="var(--text-muted)" />
<MD text={greeting} accentColor="var(--amber)" />
```

---

## 9. Animation & Interaction Guidelines

Keep animations purposeful. One principle: **entrance animations only on data-heavy pages**. Don't animate buttons or decorative elements.

| Element           | Animation                                    | Duration              |
| ----------------- | -------------------------------------------- | --------------------- |
| Hero number       | Count-up from 0                              | 1.2s, ease-out-cubic  |
| Dashboard cards   | Fade up (`opacity 0→1`, `translateY 16px→0`) | 400ms, staggered 80ms |
| Insight cards     | Same fade up                                 | 400ms, staggered 60ms |
| Progress bars     | Width 0→target                               | 700ms, ease-out       |
| Treemap cells     | Scale in                                     | 400ms, staggered 50ms |
| Heatmap cells     | Opacity 0→target                             | 300ms, staggered 20ms |
| Expand/collapse   | max-height transition                        | 250ms, ease-in-out    |
| Learn About sheet | shadcn default slide                         | default               |

No looping animations. No hover animations on cards (shadow change is enough). Performance bar animation triggers on mount with `useEffect`.

---

## 10. Data Flow Notes

### API response shape (summary)

```ts
// What the backend returns — wire your components to this
interface PortfolioInsightsResponse {
    investor: { name: string };
    portfolio: {
        currentValue: number;
        costValue: number;
        gain: number;
        gainPct: number;
        xirr: number;
        lifetimePnL: number;
    };
    funds: FundSummary[]; // active funds
    closedFunds: ClosedFund[];
    cashflows: YearlyCashflow[]; // for heatmap
    insights: InsightCardsResult; // cards, greeting
    benchmarks: BenchmarkPoint[];
}
```

### Markdown in API responses

Assume any `string` field inside `insights.cards[n].headline`, `.context`, and `insights.greeting` may contain `**bold**` or `*italic*`. Always render via `<MD>`, never raw.

### Loading state

Show a skeleton (`shadcn Skeleton`) for:

-   Hero section: 3 skeleton boxes, `h-12 w-40` each
-   Cards list: 4 skeleton cards, `h-28 rounded-2xl`
-   Charts: a single `h-48 rounded-2xl` grey box

Don't show partial data. Wait for full response.

---

## 11. File Structure Suggestion

```
app/
  layout.tsx              ← font imports, sidebar shell
  page.tsx                ← redirects to /dashboard
  dashboard/
    page.tsx
    _components/
      hero-section.tsx
      real-world-grid.tsx
      fund-race.tsx
      portfolio-treemap.tsx
      investment-heatmap.tsx
      benchmark-chart.tsx
      fund-cards-list.tsx
  insights/
    page.tsx
    _components/
      greeting-banner.tsx
      insight-card.tsx    ← the main card, includes expand + buttons
      learn-sheet.tsx
      filter-tabs.tsx
  funds/
    page.tsx
    _components/
      fund-row.tsx
      closed-funds.tsx
components/
  md.tsx                  ← markdown inline renderer
  sidebar.tsx
  chip.tsx                ← reusable sentiment chip
lib/
  api.ts                  ← fetch functions
  formatters.ts           ← fmt(), fmtK(), date utils
types/
  portfolio.ts
```

---

## 12. Key Implementation Details

**Recharts customisation:** Override default tooltips with `<CustomTooltip>` component everywhere. Recharts' default tooltip looks bad. Custom tooltip: `bg-white rounded-xl shadow-card-hover p-3 border border-[--border]`.

**Heatmap month tooltip:** `₹49,999 invested in August 2024` — format with `Intl.NumberFormat('en-IN')`.

**Fund color consistency:** Define a color map keyed by fund short name. Same color appears in treemap, race bars, and fund cards. Don't generate dynamically — hardcode so it's stable.

```ts
const FUND_COLORS: Record<string, string> = {
    DSP: '#f59e0b',
    Mirae: '#10b981',
    Quantum: '#3b82f6',
    PPFAS: '#8b5cf6',
    'Quant E': '#ec4899',
    SBI: '#64748b',
};
```

**Number formatting:** Always use `en-IN` locale:

```ts
export const fmt = (n: number) => '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export const fmtL = (n: number) => (n >= 100_000 ? `₹${(n / 100_000).toFixed(1)}L` : n >= 1_000 ? `₹${(n / 1_000).toFixed(0)}K` : fmt(n));
```

**Urgent badge logic:** If any card has `action.urgent === true`, show a red dot on the Insights nav item. Use a context or a simple global atom (Zustand or Jotai if already in the stack).

---

## 13. What Not to Do

-   No dark mode for this build — keep it light only
-   No mobile responsiveness needed — 1440px laptop is the target
-   No table headers with `<th>` styling — use label rows as styled divs
-   No global toast/notifications — these are analysis results, not user actions
-   Don't show loading spinners inside cards — skeleton blocks only
-   Don't paginate the fund list — max 20 funds, just scroll
-   Don't add charts to the Insights page — that's the Dashboard's job. Insights is text-first
