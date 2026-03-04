# MF Analysis Engine — Backend Implementation Spec

### For Claude Code: Read this fully before touching any file.

---

## Context & What Changed

The frontend has been redesigned around two output surfaces:

1. **Dashboard page** — data-driven visualisations (fund race, portfolio map, heatmap, real-world equivalents, benchmark bars). Needs structured computed data, not prose.
2. **Insights page** — LLM-generated `InsightCard[]` with plain-English text, bold/italic markdown, and per-card "Learn About" content.

The old `LLMInsightsResult` type (free-text strings: `headline`, `performanceStory`, etc.) is **replaced** by `InsightCardsResult` (structured card array). The old `NarrativeGenerator` is **replaced** by the new one described below.

The analysis engine also needs to compute additional derived data (real-world equivalents, fund personality labels, portfolio map weights) that it doesn't currently produce. These are **pure computation — no LLM**.

---

## File Map: What to Create / Modify

```
MODIFY:
  src/core/analyse/insights/narrative-generator.ts     ← full rewrite
  src/types/analysis/insights.type.ts                  ← replace LLMInsightsResult
  src/types/analysis/analysis.type.ts                  ← add dashboardData field
  src/core/analyse/analysis-engine.ts                  ← add computeDashboardData()

CREATE:
  src/types/analysis/insight-cards.type.ts             ← new card type system
  src/core/analyse/modules/dashboard-data.computer.ts  ← pure computed dashboard data
  src/core/analyse/insights/anomaly.detector.ts        ← if not yet implemented
```

---

## Step 1 — New Type: `insight-cards.type.ts`

Create this file at `src/types/analysis/insight-cards.type.ts`. This is the canonical shape for all LLM insight output.

```typescript
/**
 * InsightCard — the primary unit of user-facing insights.
 * Every field that contains user-visible text uses **bold** and *italic* markdown.
 * The frontend MD component renders this — do not strip markdown from these strings.
 */

export type CardType =
    | 'performance' // Fund or portfolio return insight
    | 'behavior' // Investment pattern / habit observation
    | 'risk' // Concentration, fee drag, volatility
    | 'action' // Something the user should do right now
    | 'fun_fact' // Surprising comparison or what-if
    | 'anomaly'; // Something unusual needing attention

export type CardSentiment = 'positive' | 'negative' | 'warning' | 'neutral' | 'curious';

export interface LearnAbout {
    /** Short label shown on card button. Max 5 words. */
    topic: string;
    /** One-sentence teaser. Shown as tooltip or preview. */
    preview: string;
    /** Full plain-English explainer, 3–5 sentences. No jargon. */
    deepDive: string;
    /** Optional analogy that makes the concept click. */
    analogy?: string;
}

export interface HighlightMetric {
    /** Formatted value: "₹24,000" or "17.8%" or "314 days" */
    value: string;
    /** What the value means: "earned for you" / "per year in fees" */
    label: string;
    trend: 'up' | 'down' | 'neutral';
}

export interface CardAction {
    label: string;
    type: 'review' | 'learn' | 'act_now' | 'explore';
    urgent?: boolean;
}

export interface InsightCard {
    id: string;
    type: CardType;
    sentiment: CardSentiment;
    /** 1 = show first. Action cards with urgent=true → priority 1–3. */
    priority: number;
    emoji: string;
    /** Max 5 words. Uses **bold** / *italic* markdown. */
    title: string;
    /**
     * Main insight in plain English. 1–2 sentences.
     * MUST use **bold** for key numbers and *italic* for emphasis.
     * Lead with impact ("DSP made **₹24,824**"), not the metric name.
     */
    headline: string;
    /**
     * Context / follow-up. 1–2 sentences.
     * Also uses **bold** / *italic* markdown.
     */
    context: string;
    highlightMetric?: HighlightMetric;
    action?: CardAction;
    learnAbout?: LearnAbout;
    /** Max 3 tag pairs shown as small chips. */
    tags?: { label: string; value: string }[];
}

export interface InsightCardsResult {
    /**
     * Personal greeting shown at screen top.
     * Uses **bold** markdown for key numbers.
     * Example: "Hey Ashutosh! Your portfolio's **up ₹63K** — but 1 thing needs your eye 👀"
     */
    greeting: string;
    /** Cards sorted by priority ascending (1 = most important). */
    cards: InsightCard[];
    /**
     * 1-line summary for home screen / push notification. Max 15 words.
     * Example: "Up ₹63K overall • 1 urgent action • DSP is your star"
     */
    homeSummary: string;
}
```

---

## Step 2 — Update `insights.type.ts`

Replace the existing `LLMInsightsResult` export with a re-export. Keep any other types in the file intact.

```typescript
// src/types/analysis/insights.type.ts

// The new primary output type for LLM insights
export { InsightCardsResult, InsightCard, LearnAbout } from './insight-cards.type';

// Keep these if they exist and are used elsewhere
export interface HoldingInsight {
    schemeName: string;
    insight: string;
}

export interface AnomalyInsight {
    severity: 'critical' | 'warning' | 'info';
    category: 'compliance' | 'risk' | 'opportunity' | 'operational';
    title: string;
    explanation: string;
}
```

---

## Step 3 — `anomaly.detector.ts`

If `src/core/analyse/insights/anomaly.detector.ts` doesn't exist yet, create it. The narrative generator depends on `DetectedAnomaly`.

```typescript
// src/core/analyse/insights/anomaly.detector.ts

import { PortfolioAnalysis } from '@/types/analysis';

export interface DetectedAnomaly {
    id: string;
    severity: 'critical' | 'warning' | 'info';
    category: 'compliance' | 'risk' | 'opportunity' | 'operational';
    title: string;
    /** Pre-computed data points passed to LLM for explanation */
    dataPoints: Record<string, string | number | string[]>;
}

export function detectAnomalies(analysis: PortfolioAnalysis): DetectedAnomaly[] {
    const anomalies: DetectedAnomaly[] = [];

    // ── 1. Nominee missing ──────────────────────────────────────────────────
    // Treat as critical — legal/family risk
    const noNomineeCount = analysis.activeHoldings.filter(h => !h.hasNominee).length;
    if (noNomineeCount > 0) {
        anomalies.push({
            id: 'no_nominee',
            severity: 'critical',
            category: 'compliance',
            title: `${noNomineeCount} active fund${noNomineeCount > 1 ? 's have' : ' has'} no nominee`,
            dataPoints: {
                count: noNomineeCount,
                totalFunds: analysis.activeHoldings.length,
                totalValueAtRisk: Math.round(analysis.portfolioSummary.totalMarketValue),
            },
        });
    }

    // ── 2. Regular plan majority ─────────────────────────────────────────────
    const regularCount = analysis.activeHoldings.filter(h => h.plan === 'Regular').length;
    const totalActive = analysis.activeHoldings.length;
    if (regularCount > totalActive / 2) {
        anomalies.push({
            id: 'regular_plans',
            severity: 'warning',
            category: 'operational',
            title: `${regularCount} of ${totalActive} active funds are Regular plans`,
            dataPoints: {
                regularCount,
                totalActive,
                estimatedAnnualDragPct: 0.8,
                estimatedAnnualDragRs: Math.round(analysis.portfolioSummary.totalMarketValue * 0.008),
            },
        });
    }

    // ── 3. Fund house concentration ──────────────────────────────────────────
    const topHouse = analysis.portfolioSummary.fundHouseSummary[0];
    if (topHouse && topHouse.weight > 25) {
        anomalies.push({
            id: 'fund_house_concentration',
            severity: 'info',
            category: 'risk',
            title: `${topHouse.fundHouse} accounts for ${topHouse.weight.toFixed(1)}% of portfolio`,
            dataPoints: {
                fundHouse: topHouse.fundHouse,
                weight: topHouse.weight,
                marketValue: Math.round(topHouse.marketValue),
            },
        });
    }

    // ── 4. Micro holdings (< 1% of portfolio) ───────────────────────────────
    const microHoldings = analysis.activeHoldings.filter(h => h.weight < 1 && h.marketValue > 0);
    if (microHoldings.length >= 3) {
        anomalies.push({
            id: 'micro_holdings',
            severity: 'info',
            category: 'operational',
            title: `${microHoldings.length} holdings are less than 1% of portfolio`,
            dataPoints: {
                count: microHoldings.length,
                totalValue: Math.round(microHoldings.reduce((s, h) => s + h.marketValue, 0)),
                schemes: microHoldings.map(h => h.schemeName),
            },
        });
    }

    // ── 5. ELSS category overlap ─────────────────────────────────────────────
    const elssCount = analysis.activeHoldings.filter(
        h => h.schemeName.toLowerCase().includes('elss') || h.schemeName.toLowerCase().includes('tax saver')
    ).length;
    if (elssCount >= 4) {
        anomalies.push({
            id: 'elss_overlap',
            severity: 'info',
            category: 'risk',
            title: `${elssCount} funds in the same ELSS category`,
            dataPoints: { count: elssCount },
        });
    }

    // ── 6. Dormant holdings (no activity 12+ months) ─────────────────────────
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const dormantCount = analysis.activeHoldings.filter(h => {
        if (!h.lastTransactionDate) return false;
        return new Date(h.lastTransactionDate) < twelveMonthsAgo;
    }).length;
    if (dormantCount > 0) {
        anomalies.push({
            id: 'dormant_holdings',
            severity: 'info',
            category: 'operational',
            title: `${dormantCount} holding${dormantCount > 1 ? 's' : ''} with no activity for 12+ months`,
            dataPoints: { count: dormantCount },
        });
    }

    return anomalies;
}
```

**Note on `hasNominee` and `lastTransactionDate`**: These need to be present on `ActiveHolding`. If they aren't, add them to the type and populate them in `portfolio-summary.analyser.ts`. `hasNominee` should default to `false` if the data doesn't contain nominee information (conservative — flags everything, user can confirm).

---

## Step 4 — Full Rewrite: `narrative-generator.ts`

Replace `src/core/analyse/insights/narrative-generator.ts` entirely with the following. This is the complete, production file.

### 4a. The VOICE_GUIDE constant (inject into every LLM prompt)

```typescript
const VOICE_GUIDE = `
VOICE & TONE RULES (follow strictly):
- Write like a smart, friendly friend who knows finance — not a banker or compliance officer
- Plain English only. If a term needs explanation, use the learnAbout field — not the text itself
- Lead with the impact: "DSP made ₹24,000 for you" not "DSP has an XIRR of 17.77%"
- Use ₹ for Indian rupee amounts. Never write "INR"
- Relate numbers to real life where it helps: "that's roughly 3 months of groceries" or "a return flight to Bali"
- Positive framing first. Don't open a card with bad news
- Be specific. Vague praise ("you're doing great!") is useless
- Max 2 sentences per text field. Tight writing = high value
- Never use bullet points inside strings. Write prose only

MARKDOWN FORMATTING RULES (apply to every headline and context field):
- Bold ALL key numbers, amounts, percentages, and fund names: "**DSP** made **₹24,824** for you"
- Use *italics* for contrast, qualification, or emphasis: "that's *nearly double* a bank FD"
- Bold the 1–3 most important things per sentence. Never more — over-bolding kills the effect
- Never bold generic words: "you", "your", "fund", "portfolio", "the", "a"
- Correct: "**DSP** made **₹24,824** for you — *nearly double* what a bank FD would give."
- Correct: "It's beating the **Nifty 50 by 7.4 points** — meaning the manager is *genuinely earning* their fee."
- Incorrect: "**Your portfolio** has a **gain** of **₹63,312**" (too many bolded generic words)
`.trim();
```

### 4b. The LEARN_ABOUT_LIBRARY (static, no LLM — do not generate these dynamically)

```typescript
export const LEARN_ABOUT_LIBRARY: Record<string, LearnAbout> = {
    xirr: {
        topic: 'What is XIRR?',
        preview: 'XIRR is the "true" return rate that accounts for when exactly you invested.',
        deepDive:
            "Regular return percentages assume you invested everything on day one. XIRR is smarter — it accounts for the exact date of every investment you made. So if you put ₹10K in January and ₹10K in July, XIRR calculates your actual return for each chunk separately. It's the honest number.",
        analogy: 'Like a restaurant rating that accounts for what you actually ordered, not just the average of every dish on the menu.',
    },
    elss: {
        topic: 'What is ELSS?',
        preview: 'ELSS funds save you tax AND invest your money in stocks.',
        deepDive:
            "ELSS (Equity Linked Savings Scheme) is a mutual fund where your investment qualifies for tax deduction under Section 80C — up to ₹1.5 lakh per year. The catch: money is locked in for 3 years per investment. After that, you can withdraw. Investing in ELSS means you're simultaneously saving tax and building wealth.",
        analogy: 'Like an FD that gives you a tax rebate upfront and invests in the stock market instead of sitting in a bank.',
    },
    regular_vs_direct: {
        topic: 'Regular vs Direct plans',
        preview: "Regular plans pay a commission to your advisor. Direct plans don't — you keep that money.",
        deepDive:
            "When you invest in a Regular plan, the fund house pays a commission (typically 0.5–1.5% per year) to whoever sold you the fund. A Direct plan skips the middleman, so that fee stays in your investment and compounds. On ₹1 lakh at 1% extra TER, you'd lose roughly ₹10,000 over 10 years.",
        analogy:
            "Like booking a flight directly on the airline's app vs. through a travel agent who adds a service fee every year you fly.",
    },
    diversification: {
        topic: 'Why diversification matters',
        preview: 'Spreading money across different funds reduces the risk that one bad decision wipes you out.',
        deepDive:
            "Diversification means owning funds that invest in different companies, sectors, or asset types. If one sector crashes (IT stocks, for example), your other holdings buffer the fall. But too many similar funds and you're just paying more fees for the same exposure — that's over-diversification.",
        analogy:
            'Like a cricket team — you want batters, bowlers, and fielders. A team of 11 batters looks impressive until a bouncy pitch arrives.',
    },
    nominee: {
        topic: 'Why nominees matter',
        preview: 'Without a nominee, your family could face months of legal hurdles to access your money.',
        deepDive:
            "A nominee is the person who receives your investments if something happens to you. Without one, your family must go through a lengthy legal process — filing court papers, getting certificates, waiting months. With a nominee registered, the fund house transfers assets directly and quickly. Adding a nominee takes 5 minutes on your AMC's app.",
    },
    ltcg: {
        topic: 'Long-term capital gains tax',
        preview: 'Hold equity funds for more than 1 year and you pay less tax on profits.',
        deepDive:
            'If you sell equity mutual fund units held for less than 1 year, you pay 20% tax on profits (STCG). Hold for over 1 year and you pay only 12.5% (LTCG) — and the first ₹1.25 lakh of gains each year is completely tax-free. Timing your redemptions by even a few days can save real money.',
        analogy: 'Like a patience discount from the government. Wait 12 months and get a 7.5% rebate on your tax bill.',
    },
    benchmark: {
        topic: 'What is a benchmark?',
        preview: "A benchmark is the 'standard to beat' — usually a stock index like Nifty 50.",
        deepDive:
            "Benchmarks let you judge if your fund manager is adding value. If the Nifty 50 returned 12% last year and your fund returned 10%, your manager underperformed — you'd have done better in an index fund. If your fund returned 16%, they earned their fees.",
        analogy: 'Like comparing your marathon time to the age-group average. 4 hours sounds great until you learn the average is 3.5.',
    },
    cagr: {
        topic: 'What is CAGR?',
        preview: 'CAGR shows how much your money grew per year, on average.',
        deepDive:
            'CAGR (Compound Annual Growth Rate) smooths out the ups and downs to show average yearly growth. If you invested ₹1 lakh and it grew to ₹1.61 lakh in 5 years, CAGR is 10% — it grew 10% per year on average, even though the actual year-by-year growth was bumpy.',
        analogy:
            'CAGR is like saying a journey took 2 hours on average — even if you hit traffic for one stretch and sped through another.',
    },
    market_cap: {
        topic: 'Large cap vs small cap',
        preview: 'Large cap funds are safer. Small cap funds are riskier but can grow faster.',
        deepDive:
            "Market cap is the total value of a company's shares. Large cap = top 100 Indian companies (Reliance, TCS, HDFC Bank) — stable, slower growth. Mid cap = companies ranked 101–250. Small cap = 251 and below — higher risk, higher potential. A balanced portfolio usually holds a mix.",
        analogy:
            'Large caps are like established hotels: reliable but not flashy. Small caps are new restaurants in a trendy neighbourhood: could blow up or close in 6 months.',
    },
    stamp_duty: {
        topic: 'What is stamp duty on MFs?',
        preview: 'A tiny tax (0.005%) charged on every mutual fund purchase.',
        deepDive:
            "Since 2020, every mutual fund purchase attracts a stamp duty of 0.005% of the investment amount. On ₹10,000 invested, that's ₹0.50. It's tiny per transaction but adds up across many purchases. It's automatically deducted — you don't pay it separately.",
    },
};
```

### 4c. Full NarrativeGenerator class

```typescript
export class NarrativeGenerator {
    // ─── Public entry point ─────────────────────────────────────────────────

    async generate(analysis: PortfolioAnalysis, behavioral: BehavioralSignals, anomalies: DetectedAnomaly[]): Promise<InsightCardsResult> {
        const [greeting, homeSummary, allCardGroups] = await Promise.all([
            this.generateGreeting(analysis, anomalies),
            this.generateHomeSummary(analysis, anomalies),
            Promise.all([
                this.generatePortfolioOverviewCard(analysis),
                this.generateStarPerformerCard(analysis),
                this.generateWorstPerformerCard(analysis),
                this.generateBehaviorCard(analysis, behavioral),
                this.generateRiskCard(analysis),
                this.generateAnomalyCards(anomalies, analysis),
                this.generateFunFactCard(analysis),
                this.generateActionCards(anomalies, analysis),
            ]),
        ]);

        const cards = allCardGroups
            .flat()
            .filter((c): c is InsightCard => c !== null)
            .sort((a, b) => a.priority - b.priority);

        return { greeting, cards, homeSummary };
    }

    // ─── Greeting ──────────────────────────────────────────────────────────

    private async generateGreeting(analysis: PortfolioAnalysis, anomalies: DetectedAnomaly[]): Promise<string> {
        const name = analysis.investor.name.split(' ')[0];
        const ps = analysis.portfolioSummary;
        const urgentCount = anomalies.filter(a => a.severity === 'critical').length;

        const context = {
            name,
            urgentCount,
            totalGainRs: Math.round(ps.totalUnrealisedGain),
            gainPct: ps.totalUnrealisedGainPct.toFixed(1),
            isUp: ps.totalUnrealisedGain > 0,
            activeFunds: ps.activeFolioCount,
        };

        return this.callLLM(
            FAST_MODEL,
            `${VOICE_GUIDE}

Write a warm, personal greeting for the top of a mutual fund insights screen. 1–2 sentences.
- Address the investor by first name: ${name}
- Mention portfolio status (up/down) with a **bolded** amount
- If urgent issues exist, acknowledge them briefly and honestly
- End with a light hook like "Here's what we found 👀" or "Here's the full picture 📊"
- Tone: WhatsApp message from a smart friend. NOT corporate.

Context: ${JSON.stringify(context)}
Return just the greeting string. Use **bold** for key numbers.`
        );
    }

    // ─── Home Summary ──────────────────────────────────────────────────────

    private async generateHomeSummary(analysis: PortfolioAnalysis, anomalies: DetectedAnomaly[]): Promise<string> {
        const ps = analysis.portfolioSummary;
        const urgentCount = anomalies.filter(a => a.severity === 'critical').length;
        const topFund = [...analysis.xirrAnalysis.schemeXIRR]
            .filter(s => s.marketValue > 1000 && s.reliability === 'High')
            .sort((a, b) => b.xirr - a.xirr)[0];

        const context = {
            totalGainRs: Math.round(ps.totalUnrealisedGain),
            gainPct: ps.totalUnrealisedGainPct.toFixed(1),
            urgentCount,
            topFundShortName: topFund?.schemeName?.split(' ').slice(0, 2).join(' ') ?? null,
        };

        return this.callLLM(
            FAST_MODEL,
            `${VOICE_GUIDE}

Write a 1-line summary for an app home screen. Max 15 words. Use • as separator. No markdown here.
Format: "[gain status] • [urgent items if any] • [star performer]"
Example: "Up ₹63K overall • 1 urgent action • DSP leading the pack"

Context: ${JSON.stringify(context)}
Return just the summary string. No markdown in this field.`
        );
    }

    // ─── Card generators ───────────────────────────────────────────────────

    private async generatePortfolioOverviewCard(analysis: PortfolioAnalysis): Promise<InsightCard | null> {
        const ps = analysis.portfolioSummary;
        const xi = analysis.xirrAnalysis;

        const raw = await this.callLLMJSON<{ headline: string; context: string }>(
            FAST_MODEL,
            `${VOICE_GUIDE}

Generate a portfolio overview card. Return JSON: { headline, context }.
- headline: The "so what" of overall portfolio. Mention total gain in ₹. Is it good? Relate to something real. (max 25 words)
- context: Add XIRR briefly OR compare to a simple FD alternative. (max 25 words)
Both fields MUST use **bold** for numbers and *italics* for contrast.

Data: ${JSON.stringify({
                totalInvestedRs: Math.round(ps.totalInvested),
                totalMarketValueRs: Math.round(ps.totalMarketValue),
                unrealisedGainRs: Math.round(ps.totalUnrealisedGain),
                unrealisedGainPct: ps.totalUnrealisedGainPct.toFixed(1),
                lifetimePnLRs: Math.round(ps.lifetimePnL),
                portfolioXIRR: xi.portfolioXIRR.toFixed(1),
                activeFunds: ps.activeFolioCount,
            })}`
        );

        if (!raw) return null;

        return {
            id: 'portfolio_overview',
            type: 'performance',
            sentiment: ps.totalUnrealisedGain >= 0 ? 'positive' : 'negative',
            priority: 5,
            emoji: ps.totalUnrealisedGain >= 0 ? '📈' : '📉',
            title: 'The Big Picture',
            headline: raw.headline,
            context: raw.context,
            highlightMetric: {
                value: `₹${Math.abs(ps.totalUnrealisedGain).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
                label: ps.totalUnrealisedGain >= 0 ? 'unrealised gain' : 'unrealised loss',
                trend: ps.totalUnrealisedGain >= 0 ? 'up' : 'down',
            },
            learnAbout: LEARN_ABOUT_LIBRARY.xirr,
            tags: [
                { label: 'Invested', value: `₹${Math.round(ps.totalInvested / 1000)}K` },
                { label: 'Current value', value: `₹${Math.round(ps.totalMarketValue / 1000)}K` },
                { label: 'XIRR', value: `${xi.portfolioXIRR.toFixed(1)}%` },
            ],
        };
    }

    private async generateStarPerformerCard(analysis: PortfolioAnalysis): Promise<InsightCard | null> {
        const reliable = analysis.xirrAnalysis.schemeXIRR.filter(s => s.marketValue > 5000 && s.reliability === 'High' && !isNaN(s.xirr));
        if (reliable.length === 0) return null;

        const top = [...reliable].sort((a, b) => b.xirr - a.xirr)[0];
        const holding = analysis.activeHoldings.find(h => h.schemeName === top.schemeName);
        if (!holding) return null;

        const costValue = holding.costValue ?? 0;
        const earned = Math.round(top.marketValue - costValue);
        const benchmark = analysis.benchmarkComparison?.fundVsBenchmark.find(f => f.schemeName === top.schemeName);

        const raw = await this.callLLMJSON<{ headline: string; context: string }>(
            FAST_MODEL,
            `${VOICE_GUIDE}

Generate a "star performer" card for the best fund. Return JSON: { headline, context }.
- headline: Lead with what the fund EARNED in ₹. Name the fund (can abbreviate). Compare to FD if gap is notable. (max 25 words)
- context: Mention holding period OR benchmark gap if fund is beating it. (max 25 words)
Both fields MUST use **bold** for numbers/names and *italics* for emphasis phrases.

Data: ${JSON.stringify({
                fundName: top.schemeName,
                shortName: top.schemeName.split(' ').slice(0, 2).join(' '),
                xirrPct: top.xirr.toFixed(1),
                gainPct: holding.unrealisedGainPct.toFixed(1),
                earnedRs: earned,
                investedRs: Math.round(costValue),
                currentValueRs: Math.round(top.marketValue),
                holdingDays: holding.holdingDays,
                benchmarkGapPp: benchmark?.gapPctPoints?.toFixed(1) ?? null,
                benchmarkName: benchmark?.benchmarkName ?? null,
            })}`
        );

        if (!raw) return null;

        return {
            id: 'star_performer',
            type: 'performance',
            sentiment: 'positive',
            priority: 6,
            emoji: '⭐',
            title: 'Your Star Fund',
            headline: raw.headline,
            context: raw.context,
            highlightMetric: {
                value: `₹${earned.toLocaleString('en-IN')}`,
                label: 'earned for you',
                trend: 'up',
            },
            learnAbout: LEARN_ABOUT_LIBRARY.benchmark,
            tags: [
                { label: 'XIRR', value: `${top.xirr.toFixed(1)}%` },
                { label: 'Gain', value: `${holding.unrealisedGainPct.toFixed(1)}%` },
                ...(benchmark ? [{ label: `vs ${benchmark.benchmarkName}`, value: `+${benchmark.gapPctPoints.toFixed(1)}pp` }] : []),
            ],
        };
    }

    private async generateWorstPerformerCard(analysis: PortfolioAnalysis): Promise<InsightCard | null> {
        const reliable = analysis.xirrAnalysis.schemeXIRR.filter(s => s.marketValue > 5000 && s.reliability === 'High' && !isNaN(s.xirr));
        if (reliable.length < 2) return null;

        const worst = [...reliable].sort((a, b) => a.xirr - b.xirr)[0];
        const holding = analysis.activeHoldings.find(h => h.schemeName === worst.schemeName);
        if (!holding) return null;
        if (worst.xirr > 4) return null; // Only show if meaningfully underperforming

        const raw = await this.callLLMJSON<{ headline: string; context: string }>(
            FAST_MODEL,
            `${VOICE_GUIDE}

Generate a "needs attention" card for the weakest fund. Be honest but not alarmist. Return JSON: { headline, context }.
- headline: State performance clearly. Name the fund. (max 25 words)
- context: Suggest this is worth reviewing, not necessarily selling. (max 25 words)
Both fields MUST use **bold** for numbers/names and *italics* for qualifications.

Data: ${JSON.stringify({
                fundName: worst.schemeName,
                shortName: worst.schemeName.split(' ').slice(0, 2).join(' '),
                xirrPct: worst.xirr.toFixed(1),
                gainPct: holding.unrealisedGainPct.toFixed(1),
                currentValueRs: Math.round(worst.marketValue),
                holdingDays: holding.holdingDays,
            })}`
        );

        if (!raw) return null;

        return {
            id: 'worst_performer',
            type: 'performance',
            sentiment: worst.xirr < 0 ? 'negative' : 'warning',
            priority: 9,
            emoji: '🔍',
            title: 'Worth a Second Look',
            headline: raw.headline,
            context: raw.context,
            highlightMetric: {
                value: `${worst.xirr.toFixed(1)}%`,
                label: 'annual return (XIRR)',
                trend: worst.xirr < 0 ? 'down' : 'neutral',
            },
            action: { label: 'Review this fund', type: 'review' },
            learnAbout: LEARN_ABOUT_LIBRARY.xirr,
            tags: [{ label: 'Gain', value: `${holding.unrealisedGainPct.toFixed(1)}%` }],
        };
    }

    private async generateBehaviorCard(analysis: PortfolioAnalysis, behavioral: BehavioralSignals): Promise<InsightCard | null> {
        const mostInterestingSignal = this.pickMostInterestingBehaviorSignal(behavioral);

        const raw = await this.callLLMJSON<{
            headline: string;
            context: string;
            sentiment: 'positive' | 'neutral' | 'warning';
            emoji: string;
        }>(
            SMART_MODEL,
            `${VOICE_GUIDE}

Generate a behavioral insight card about this investor's habits. Return JSON: { headline, context, sentiment, emoji }.
Focus on the SINGLE most interesting/surprising pattern. Signal identified: "${mostInterestingSignal}"
- headline: Name the pattern in plain English. No jargon. (max 25 words)
- context: Explain if it's good/bad/neutral and why it matters. (max 25 words)
- sentiment: "positive" | "neutral" | "warning"
- emoji: a single fitting emoji
Both text fields MUST use **bold** for key facts and *italics* for emphasis.

Data: ${JSON.stringify({
                totalPurchases: behavioral.investmentCadence.totalPurchases,
                consistencyScore: behavioral.investmentCadence.consistencyScore,
                longestGapDays: behavioral.investmentCadence.longestGapDays,
                longestGapPeriod: behavioral.investmentCadence.longestGapPeriod,
                avgAmountRs: Math.round(behavioral.amountPatterns.avgPurchaseAmount),
                roundNumberBiasPct: behavioral.amountPatterns.roundNumberBias,
                trendDirection: behavioral.amountPatterns.trendDirection,
                purchasesDuringDips: behavioral.timingSignals.purchasesDuringDips,
                purchasesDuringPeaks: behavioral.timingSignals.purchasesDuringPeaks,
                totalPurchasesWithNAV: behavioral.timingSignals.totalPurchasesWithNAV,
                panicSells: behavioral.emotionalSignals.panicSelling.length,
                fomoEvents: behavioral.emotionalSignals.fomoChasing.length,
            })}`
        );

        if (!raw) return null;

        return {
            id: 'investment_behavior',
            type: 'behavior',
            sentiment: raw.sentiment,
            priority: 10,
            emoji: raw.emoji || '🧠',
            title: 'How You Invest',
            headline: raw.headline,
            context: raw.context,
            tags: [
                { label: 'Investments made', value: `${behavioral.investmentCadence.totalPurchases}` },
                { label: 'Consistency', value: `${behavioral.investmentCadence.consistencyScore}/100` },
                {
                    label: 'Bought the dip',
                    value: `${behavioral.timingSignals.purchasesDuringDips}/${behavioral.timingSignals.totalPurchasesWithNAV}x`,
                },
            ],
        };
    }

    private async generateRiskCard(analysis: PortfolioAnalysis): Promise<InsightCard | null> {
        const ps = analysis.portfolioSummary;
        const topFundHouse = ps.fundHouseSummary[0];
        const regularCount = analysis.activeHoldings.filter(h => h.plan === 'Regular').length;
        const totalActive = analysis.activeHoldings.length;
        const estimatedAnnualFeeDragRs = Math.round(ps.totalMarketValue * 0.008);

        const raw = await this.callLLMJSON<{
            headline: string;
            context: string;
            riskLevel: 'low' | 'medium' | 'high';
            primaryRisk: 'regular_plans' | 'concentration' | 'holding_concentration';
        }>(
            SMART_MODEL,
            `${VOICE_GUIDE}

Generate a risk card. Identify the SINGLE biggest risk. Return JSON: { headline, context, riskLevel, primaryRisk }.

Priority of risks (check in order):
1. regular_plans: if regularCount > half of totalActive
2. concentration: if topFundHouseWeight > 25%
3. holding_concentration: if a single holding > 30%

- headline: Name the risk clearly. Vivid analogy if it helps. (max 25 words)
- context: Quantify impact in ₹ or %. Tell them what to do. (max 25 words)
- riskLevel: "low" | "medium" | "high"
- primaryRisk: as specified above
Both text fields MUST use **bold** for numbers and *italics* for qualifications.

Data: ${JSON.stringify({
                regularCount,
                totalActive,
                estimatedAnnualFeeDragRs,
                topFundHouseName: topFundHouse?.fundHouse,
                topFundHouseWeightPct: topFundHouse?.weight?.toFixed(1),
                topHoldingName: analysis.activeHoldings[0]?.schemeName,
                topHoldingWeightPct: analysis.activeHoldings[0]?.weight?.toFixed(1),
                totalMarketValueRs: Math.round(ps.totalMarketValue),
            })}`
        );

        if (!raw) return null;

        const learnMap: Record<string, LearnAbout> = {
            regular_plans: LEARN_ABOUT_LIBRARY.regular_vs_direct,
            concentration: LEARN_ABOUT_LIBRARY.diversification,
            holding_concentration: LEARN_ABOUT_LIBRARY.diversification,
        };

        const sentimentMap = { low: 'neutral', medium: 'warning', high: 'warning' } as const;

        return {
            id: 'risk_overview',
            type: 'risk',
            sentiment: sentimentMap[raw.riskLevel] ?? 'neutral',
            priority: 7,
            emoji: raw.riskLevel === 'high' ? '⚠️' : '🛡️',
            title: raw.riskLevel === 'high' ? 'Risk Alert' : 'Risk Check',
            headline: raw.headline,
            context: raw.context,
            action: raw.primaryRisk === 'regular_plans' ? { label: 'See how to switch to Direct', type: 'learn' } : undefined,
            learnAbout: learnMap[raw.primaryRisk] ?? LEARN_ABOUT_LIBRARY.diversification,
            tags: [
                { label: 'Regular plans', value: `${regularCount} of ${totalActive}` },
                { label: 'Top fund house', value: `${topFundHouse?.weight?.toFixed(0)}%` },
            ],
        };
    }

    private async generateAnomalyCards(anomalies: DetectedAnomaly[], analysis: PortfolioAnalysis): Promise<InsightCard[]> {
        if (anomalies.length === 0) return [];

        const critical = anomalies.filter(a => a.severity === 'critical').slice(0, 3);
        const warnings = anomalies.filter(a => a.severity === 'warning').slice(0, 2);
        const toProcess = [...critical, ...warnings];

        const results = await Promise.all(toProcess.map((anomaly, i) => this.generateSingleAnomalyCard(anomaly, analysis, i)));
        return results.filter((c): c is InsightCard => c !== null);
    }

    private async generateSingleAnomalyCard(
        anomaly: DetectedAnomaly,
        analysis: PortfolioAnalysis,
        index: number
    ): Promise<InsightCard | null> {
        const raw = await this.callLLMJSON<{
            headline: string;
            context: string;
            actionLabel: string;
            emoji: string;
        }>(
            SMART_MODEL,
            `${VOICE_GUIDE}

Generate an anomaly card. Return JSON: { headline, context, actionLabel, emoji }.
- headline: State the issue in plain English. Be clear about the risk or opportunity. (max 25 words)
- context: What happens if ignored, or what they gain by acting. (max 25 words)
- actionLabel: Short button text, max 4 words. E.g., "Add nominees now", "Review funds"
- emoji: a single fitting emoji
Both text fields MUST use **bold** for key numbers/facts and *italics* for emphasis.

Data: ${JSON.stringify({
                title: anomaly.title,
                severity: anomaly.severity,
                category: anomaly.category,
                data: anomaly.dataPoints,
                investorFirstName: analysis.investor.name.split(' ')[0],
                totalMarketValueRs: Math.round(analysis.portfolioSummary.totalMarketValue),
            })}`
        );

        if (!raw) return null;

        const learnMap: Partial<Record<DetectedAnomaly['category'], LearnAbout>> = {
            compliance: LEARN_ABOUT_LIBRARY.nominee,
            risk: LEARN_ABOUT_LIBRARY.diversification,
            operational: LEARN_ABOUT_LIBRARY.regular_vs_direct,
        };

        return {
            id: `anomaly_${anomaly.id}`,
            type: 'anomaly',
            sentiment: anomaly.severity === 'critical' ? 'warning' : 'neutral',
            priority: anomaly.severity === 'critical' ? index + 1 : index + 7,
            emoji: raw.emoji || '📌',
            title: anomaly.severity === 'critical' ? '⚡ Action Needed' : 'Heads Up',
            headline: raw.headline,
            context: raw.context,
            action: {
                label: raw.actionLabel || 'Learn more',
                type: anomaly.severity === 'critical' ? 'act_now' : 'review',
                urgent: anomaly.severity === 'critical',
            },
            learnAbout: learnMap[anomaly.category],
        };
    }

    private async generateFunFactCard(analysis: PortfolioAnalysis): Promise<InsightCard | null> {
        const ps = analysis.portfolioSummary;
        // FD comparison: ~7% per annum, rough average 3-year holding
        const yearsApprox = 3;
        const fdValue = Math.round(ps.totalInvested * Math.pow(1.07, yearsApprox));
        const mfVsFD = Math.round(ps.totalMarketValue - fdValue);

        const raw = await this.callLLMJSON<{ headline: string; context: string }>(
            FAST_MODEL,
            `${VOICE_GUIDE}

Generate a fun fact card comparing MF to bank FD. Make it surprising and relatable. Return JSON: { headline, context }.
- headline: Lead with the comparison outcome. Make it feel real (relate to everyday purchases). (max 30 words)
- context: Give the FD number for contrast, then a real-world comparison for the difference. (max 25 words)
Both fields MUST use **bold** for all amounts and *italics* for emphasis.

Data: ${JSON.stringify({
                totalInvestedRs: Math.round(ps.totalInvested),
                mfCurrentValueRs: Math.round(ps.totalMarketValue),
                fdValueRs: fdValue,
                differenceRs: mfVsFD,
                differenceIsPositive: mfVsFD > 0,
            })}`
        );

        if (!raw) return null;

        return {
            id: 'fun_fact_fd',
            type: 'fun_fact',
            sentiment: mfVsFD > 0 ? 'positive' : 'curious',
            priority: 12,
            emoji: '🏦',
            title: 'vs. Putting it in the Bank',
            headline: raw.headline,
            context: raw.context,
            highlightMetric: {
                value: `₹${Math.abs(mfVsFD).toLocaleString('en-IN')}`,
                label: mfVsFD > 0 ? 'more than FD would have given' : 'less than FD would have given',
                trend: mfVsFD > 0 ? 'up' : 'down',
            },
            learnAbout: LEARN_ABOUT_LIBRARY.cagr,
        };
    }

    private generateActionCards(anomalies: DetectedAnomaly[], analysis: PortfolioAnalysis): InsightCard[] {
        // Action cards are deterministic — no LLM needed
        const cards: InsightCard[] = [];

        const nomineeAnomaly = anomalies.find(a => a.id === 'no_nominee');
        if (nomineeAnomaly) {
            const count = (nomineeAnomaly.dataPoints.count as number) ?? 0;
            cards.push({
                id: 'action_nominee',
                type: 'action',
                sentiment: 'warning',
                priority: 2,
                emoji: '👤',
                title: 'Takes 5 Minutes',
                headline: `**${
                    count > 0 ? count : 'Several'
                } of your funds** have no nominee — if something happened to you, your family could wait *months* to access **₹${Math.round(
                    (nomineeAnomaly.dataPoints.totalValueAtRisk as number) / 1000
                )}K**.`,
                context: 'Adding a nominee is free, takes 5 minutes on your AMC app, and protects your family *immediately*.',
                action: { label: 'Add nominees now', type: 'act_now', urgent: true },
                learnAbout: LEARN_ABOUT_LIBRARY.nominee,
            });
        }

        return cards;
    }

    // ─── Private helpers ───────────────────────────────────────────────────

    private pickMostInterestingBehaviorSignal(b: BehavioralSignals): string {
        if (b.emotionalSignals.panicSelling.length > 0) return 'panic selling detected';
        if (b.emotionalSignals.fomoChasing.length > 0) return 'FOMO buying detected';
        if (b.investmentCadence.longestGapDays > 180) return `long investment gap of ${b.investmentCadence.longestGapDays} days`;
        if (b.timingSignals.dipBuyerScore > 50) return 'good dip-buying habit';
        if (b.amountPatterns.roundNumberBias > 0.9) return 'high round-number bias (95%+)';
        if (b.investmentCadence.consistencyScore > 70) return 'high consistency score';
        return 'investment cadence and amount patterns';
    }

    private async callLLM(model: string, prompt: string): Promise<string> {
        try {
            const { text } = await generateText({ model: openai(model), prompt });
            return text.trim();
        } catch (err) {
            console.warn(`[NarrativeGenerator] LLM call failed (${model}):`, (err as Error).message);
            return '';
        }
    }

    private async callLLMJSON<T>(model: string, prompt: string): Promise<T | null> {
        try {
            const raw = await this.callLLM(
                model,
                `${prompt}\n\nCRITICAL: Return ONLY valid JSON. No markdown fences, no explanation. Just the JSON object.`
            );
            return JSON.parse(raw) as T;
        } catch (err) {
            console.warn(`[NarrativeGenerator] JSON parse failed:`, (err as Error).message);
            return null;
        }
    }
}
```

---

## Step 5 — New Module: `dashboard-data.computer.ts`

This module computes everything the dashboard page needs. **Zero LLM calls.** Pure functions on existing `PortfolioAnalysis` data.

Create at: `src/core/analyse/modules/dashboard-data.computer.ts`

```typescript
import { PortfolioAnalysis } from '@/types/analysis';
import {
    DashboardData,
    RealWorldEquivalent,
    FundRaceEntry,
    HeatmapYear,
    BenchmarkBar,
    PortfolioMapBlock,
    ClosedFundSummary,
} from '@/types/analysis/dashboard-data.type';

/**
 * Computes all structured data needed for the dashboard page.
 * No LLM. No I/O. Pure functions on PortfolioAnalysis.
 */
export function computeDashboardData(analysis: PortfolioAnalysis): DashboardData {
    return {
        heroStats: computeHeroStats(analysis),
        realWorldEquivalents: computeRealWorldEquivalents(analysis),
        fundRace: computeFundRace(analysis),
        portfolioMap: computePortfolioMap(analysis),
        heatmap: computeHeatmap(analysis),
        benchmarkBars: computeBenchmarkBars(analysis),
        fundCards: computeFundCards(analysis),
        closedFunds: computeClosedFunds(analysis),
    };
}

// ─── Hero Stats ──────────────────────────────────────────────────────────────

function computeHeroStats(analysis: PortfolioAnalysis) {
    const ps = analysis.portfolioSummary;
    const xi = analysis.xirrAnalysis;
    return {
        currentValueRs: ps.totalMarketValue,
        unrealisedGainRs: ps.totalUnrealisedGain,
        unrealisedGainPct: ps.totalUnrealisedGainPct,
        xirr: xi.portfolioXIRR,
        activeFunds: ps.activeFolioCount,
        lifetimePnLRs: ps.lifetimePnL,
        lifetimePnLPct: ps.lifetimePnLPct ?? 0,
    };
}

// ─── Real-World Equivalents ───────────────────────────────────────────────────

const EQUIVALENTS_CATALOGUE = [
    { emoji: '✈️', label: 'Return flights Delhi→Bali', unitCost: 32000, unit: 'trip', unitLabel: (n: number) => `${n}×` },
    { emoji: '🛒', label: 'Months of groceries', unitCost: 20000, unit: 'month', unitLabel: (n: number) => `${n}` },
    { emoji: '📱', label: 'iPhone 16 Pro coverage', unitCost: 134900, unit: 'phone', unitLabel: (n: number) => `${Math.round(n * 100)}%` },
    { emoji: '🎬', label: 'Years of OTT streaming', unitCost: 12000, unit: 'year', unitLabel: (n: number) => `${n}` },
    { emoji: '⛽', label: 'Full fuel tanks', unitCost: 5000, unit: 'tank', unitLabel: (n: number) => `${n}×` },
    { emoji: '🎓', label: 'Months of school fees', unitCost: 15000, unit: 'month', unitLabel: (n: number) => `${n}` },
];

function computeRealWorldEquivalents(analysis: PortfolioAnalysis): RealWorldEquivalent[] {
    const gainRs = Math.max(0, analysis.portfolioSummary.totalUnrealisedGain);
    if (gainRs === 0) return [];

    return EQUIVALENTS_CATALOGUE.slice(0, 4).map(item => {
        const count = gainRs / item.unitCost;
        return {
            emoji: item.emoji,
            label: item.label,
            displayCount: item.unitLabel(Math.floor(count)),
            subtext: `At ₹${(item.unitCost / 1000).toFixed(0)}K per ${item.unit}`,
        };
    });
}

// ─── Fund Race ────────────────────────────────────────────────────────────────

function computeFundRace(analysis: PortfolioAnalysis): FundRaceEntry[] {
    return analysis.activeHoldings
        .filter(h => h.marketValue > 500)
        .map(h => {
            const schemeXirr = analysis.xirrAnalysis.schemeXIRR.find(s => s.schemeName === h.schemeName);
            return {
                schemeName: h.schemeName,
                shortName: abbreviateFundName(h.schemeName),
                gainPct: h.unrealisedGainPct,
                xirr: schemeXirr?.xirr ?? null,
                marketValueRs: h.marketValue,
                plan: h.plan,
                color: assignFundColor(h.unrealisedGainPct),
                xirrReliability: schemeXirr?.reliability ?? 'Unknown',
            };
        })
        .sort((a, b) => b.gainPct - a.gainPct);
}

// ─── Portfolio Map ────────────────────────────────────────────────────────────

function computePortfolioMap(analysis: PortfolioAnalysis): PortfolioMapBlock[] {
    const totalMV = analysis.portfolioSummary.totalMarketValue;
    return analysis.activeHoldings
        .filter(h => h.marketValue > 500 && h.weight > 0.5)
        .sort((a, b) => b.marketValue - a.marketValue)
        .map(h => ({
            schemeName: h.schemeName,
            shortName: abbreviateFundName(h.schemeName),
            weightPct: h.weight,
            gainPct: h.unrealisedGainPct,
            marketValueRs: h.marketValue,
            color: assignFundColor(h.unrealisedGainPct),
        }));
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────

function computeHeatmap(analysis: PortfolioAnalysis): HeatmapYear[] {
    const cf = analysis.cashflowAnalysis;
    if (!cf?.annualCashflows) return [];

    return cf.annualCashflows.map(y => {
        // Build month-level data from transaction timeline if available
        const monthlyInvested: Record<number, number> = {};
        const monthlyWithdrawn: Record<number, number> = {};

        for (let m = 1; m <= 12; m++) {
            monthlyInvested[m] = 0;
            monthlyWithdrawn[m] = 0;
        }

        // Pull monthly data from transactionTimeline if present
        if (analysis.transactionTimeline?.byMonth) {
            for (const entry of analysis.transactionTimeline.byMonth) {
                const d = new Date(entry.month);
                if (d.getFullYear() === parseInt(y.year)) {
                    const m = d.getMonth() + 1;
                    monthlyInvested[m] = (monthlyInvested[m] ?? 0) + (entry.invested ?? 0);
                    monthlyWithdrawn[m] = (monthlyWithdrawn[m] ?? 0) + (entry.withdrawn ?? 0);
                }
            }
        }

        return {
            year: y.year.toString(),
            totalInvestedRs: y.invested,
            totalWithdrawnRs: y.withdrawn,
            months: Array.from({ length: 12 }, (_, i) => ({
                month: i + 1,
                investedRs: monthlyInvested[i + 1] ?? 0,
                withdrawnRs: monthlyWithdrawn[i + 1] ?? 0,
            })),
        };
    });
}

// ─── Benchmark Bars ───────────────────────────────────────────────────────────

function computeBenchmarkBars(analysis: PortfolioAnalysis): BenchmarkBar[] {
    const bars: BenchmarkBar[] = [
        { name: 'Bank FD', xirr: 7.0, isPortfolio: false, color: '#64748b' },
        {
            name: 'Your Portfolio',
            xirr: analysis.xirrAnalysis.portfolioXIRR,
            isPortfolio: true,
            color: '#f59e0b',
        },
    ];

    if (analysis.benchmarkComparison?.portfolioBenchmarks) {
        for (const b of analysis.benchmarkComparison.portfolioBenchmarks) {
            bars.push({
                name: b.benchmarkName,
                xirr: b.cagr,
                isPortfolio: false,
                color: '#3b82f6',
            });
        }
    }

    return bars.sort((a, b) => a.xirr - b.xirr);
}

// ─── Fund Cards ───────────────────────────────────────────────────────────────

const FUND_PERSONALITIES = [
    { label: 'Superstar ⭐', minGain: 50, description: 'Exceptional gains' },
    { label: 'Strong performer 💪', minGain: 30, description: 'Beating most peers' },
    { label: 'Steady Eddie 🔄', minGain: 10, description: 'Consistent, reliable' },
    { label: 'Slowly cooking 🍳', minGain: 0, description: 'Positive but slow' },
    { label: 'Needs review 🔍', minGain: -Infinity, description: 'Underperforming' },
] as const;

function getFundPersonality(gainPct: number) {
    return FUND_PERSONALITIES.find(p => gainPct >= p.minGain) ?? FUND_PERSONALITIES[FUND_PERSONALITIES.length - 1];
}

function computeFundCards(analysis: PortfolioAnalysis) {
    return analysis.activeHoldings
        .filter(h => h.marketValue > 1)
        .sort((a, b) => b.marketValue - a.marketValue)
        .map(h => {
            const schemeXirr = analysis.xirrAnalysis.schemeXIRR.find(s => s.schemeName === h.schemeName);
            const personality = getFundPersonality(h.unrealisedGainPct);
            const benchmark = analysis.benchmarkComparison?.fundVsBenchmark.find(f => f.schemeName === h.schemeName);
            return {
                schemeName: h.schemeName,
                shortName: abbreviateFundName(h.schemeName),
                gainPct: h.unrealisedGainPct,
                xirr: schemeXirr?.xirr ?? null,
                xirrReliability: schemeXirr?.reliability ?? 'Unknown',
                marketValueRs: h.marketValue,
                weightPct: h.weight,
                plan: h.plan,
                holdingDays: h.holdingDays,
                personality: personality.label,
                personalityDescription: personality.description,
                benchmarkGapPp: benchmark?.gapPctPoints ?? null,
                benchmarkName: benchmark?.benchmarkName ?? null,
                color: assignFundColor(h.unrealisedGainPct),
                isRegular: h.plan === 'Regular',
            };
        });
}

// ─── Closed Funds ─────────────────────────────────────────────────────────────

function computeClosedFunds(analysis: PortfolioAnalysis): ClosedFundSummary[] {
    return (analysis.portfolioSummary.closedFolios ?? []).map(f => ({
        schemeName: f.schemeName,
        shortName: abbreviateFundName(f.schemeName),
        investedRs: f.totalInvested,
        redeemedRs: f.totalRedeemed,
        pnlRs: f.pnl,
        pnlPct: f.pnlPct,
    }));
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function abbreviateFundName(name: string): string {
    // Remove common suffixes
    return name
        .replace(/- (Regular|Direct) (Plan|Growth|Option)?/gi, '')
        .replace(/\((?:Demat|Non-Demat|Regular|Direct|Growth)\)/gi, '')
        .replace(/Fund/gi, '')
        .replace(/Tax Saver/gi, 'TS')
        .replace(/ELSS/gi, 'ELSS')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 18)
        .trim();
}

// Deterministic color per gain range (same fund always same color)
function assignFundColor(gainPct: number): string {
    if (gainPct > 50) return '#f59e0b';
    if (gainPct > 30) return '#10b981';
    if (gainPct > 10) return '#3b82f6';
    if (gainPct >= 0) return '#8b5cf6';
    return '#ef4444';
}
```

---

## Step 6 — New Type: `dashboard-data.type.ts`

Create at `src/types/analysis/dashboard-data.type.ts`:

```typescript
export interface RealWorldEquivalent {
    emoji: string;
    label: string;
    displayCount: string;
    subtext: string;
}

export interface FundRaceEntry {
    schemeName: string;
    shortName: string;
    gainPct: number;
    xirr: number | null;
    marketValueRs: number;
    plan: string;
    color: string;
    xirrReliability: string;
}

export interface PortfolioMapBlock {
    schemeName: string;
    shortName: string;
    weightPct: number;
    gainPct: number;
    marketValueRs: number;
    color: string;
}

export interface HeatmapMonth {
    month: number; // 1–12
    investedRs: number;
    withdrawnRs: number;
}

export interface HeatmapYear {
    year: string;
    totalInvestedRs: number;
    totalWithdrawnRs: number;
    months: HeatmapMonth[];
}

export interface BenchmarkBar {
    name: string;
    xirr: number;
    isPortfolio: boolean;
    color: string;
}

export interface FundCard {
    schemeName: string;
    shortName: string;
    gainPct: number;
    xirr: number | null;
    xirrReliability: string;
    marketValueRs: number;
    weightPct: number;
    plan: string;
    holdingDays: number;
    personality: string;
    personalityDescription: string;
    benchmarkGapPp: number | null;
    benchmarkName: string | null;
    color: string;
    isRegular: boolean;
}

export interface ClosedFundSummary {
    schemeName: string;
    shortName: string;
    investedRs: number;
    redeemedRs: number;
    pnlRs: number;
    pnlPct: number;
}

export interface DashboardData {
    heroStats: {
        currentValueRs: number;
        unrealisedGainRs: number;
        unrealisedGainPct: number;
        xirr: number;
        activeFunds: number;
        lifetimePnLRs: number;
        lifetimePnLPct: number;
    };
    realWorldEquivalents: RealWorldEquivalent[];
    fundRace: FundRaceEntry[];
    portfolioMap: PortfolioMapBlock[];
    heatmap: HeatmapYear[];
    benchmarkBars: BenchmarkBar[];
    fundCards: FundCard[];
    closedFunds: ClosedFundSummary[];
}
```

---

## Step 7 — Update `analysis.type.ts`

Add `dashboardData` and `insightCards` to `PortfolioAnalysis`:

```typescript
// In src/types/analysis/analysis.type.ts
// Add these two fields to the PortfolioAnalysis interface:

import { InsightCardsResult } from './insight-cards.type';
import { DashboardData } from './dashboard-data.type';

// Inside PortfolioAnalysis:
  dashboardData: DashboardData;

  // Replace old `insights?: LLMInsightsResult` with:
  insightCards?: InsightCardsResult;
```

---

## Step 8 — Update `analysis-engine.ts`

Wire the new modules into the orchestrator. In `src/core/analyse/analysis-engine.ts`:

```typescript
// Add imports:
import { computeDashboardData } from './modules/dashboard-data.computer';
import { detectAnomalies } from './insights/anomaly.detector';
// NarrativeGenerator import remains the same path

// In the analyse() method, after all core modules have run:
const dashboardData = computeDashboardData(analysis);
analysis.dashboardData = dashboardData;

// In generateInsights() or wherever the LLM layer is called:
const anomalies = detectAnomalies(analysis);
const insightCards = await narrativeGenerator.generate(analysis, behavioralSignals, anomalies);
analysis.insightCards = insightCards;
```

---

## Step 9 — API Response Shape

The endpoint that serves analysis results to the frontend should return:

```typescript
// GET /api/analysis/:requestId or /api/analysis/latest

{
  // Existing fields (unchanged)
  analysisId: string;
  analysedAt: string;
  investor: { name: string; pan: string };
  statementPeriod: { from: string; to: string };
  portfolioSummary: PortfolioSummaryResult;
  xirrAnalysis: XIRRAnalysisResult;
  // ... other existing analysis fields

  // New fields
  dashboardData: DashboardData;       // Always present, computed synchronously
  insightCards?: InsightCardsResult;  // Present after LLM pass completes
}
```

The LLM pass can run asynchronously after the synchronous analysis. Use a `status` field if you want the frontend to poll:

```typescript
{
    analysisStatus: 'computing' | 'ready' | 'insights_pending' | 'complete';
    // 'ready' = dashboardData available, insightCards not yet
    // 'complete' = both available
}
```

---

## Data Dependencies: What the Analyser Must Produce

The dashboard computer and narrative generator depend on fields that must exist on `PortfolioAnalysis`. Verify or add these:

| Field                                            | Where to add if missing                                              |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| `activeHoldings[].costValue`                     | `portfolio-summary.analyser.ts`                                      |
| `activeHoldings[].holdingDays`                   | `portfolio-summary.analyser.ts` — days since first purchase in folio |
| `activeHoldings[].plan`                          | Pulled from `folio.scheme.plan`                                      |
| `activeHoldings[].hasNominee`                    | Set to `false` by default if not parseable from statement            |
| `activeHoldings[].lastTransactionDate`           | Last tx date from folio.transactions                                 |
| `portfolioSummary.closedFolios[]`                | `portfolio-summary.analyser.ts` — folios with closingUnitBalance = 0 |
| `portfolioSummary.closedFolios[].pnl`            | Sum of redemptions - sum of purchases for closed folio               |
| `portfolioSummary.closedFolios[].pnlPct`         | pnl / totalInvested \* 100                                           |
| `portfolioSummary.totalInvested`                 | Sum of all purchase cashflows (existing)                             |
| `portfolioSummary.lifetimePnL`                   | totalWithdrawn + totalMarketValue - totalInvested                    |
| `portfolioSummary.lifetimePnLPct`                | lifetimePnL / totalInvested \* 100                                   |
| `cashflowAnalysis.annualCashflows[].year`        | Must be a string or number — coerce to string                        |
| `transactionTimeline.byMonth`                    | Monthly grouped transactions — add if not present                    |
| `benchmarkComparison.portfolioBenchmarks[].cagr` | From benchmark provider                                              |

---

## What NOT to LLM

These are computed deterministically. Do not send them to the LLM:

| Thing                          | How to compute                                                 |
| ------------------------------ | -------------------------------------------------------------- |
| Real-world equivalents         | `gain / unitCost` from hardcoded catalogue                     |
| Fund personality labels        | Threshold on `gainPct` — see `FUND_PERSONALITIES` above        |
| Heatmap month data             | Group transactions by year/month                               |
| Benchmark bars                 | Pull from `benchmarkComparison` in analysis                    |
| Portfolio map blocks           | `activeHoldings` sorted by weight                              |
| Fund race entries              | `activeHoldings` sorted by gainPct                             |
| `homeSummary` for notification | LLM (fast model) — but could be templated if cost is a concern |
| Action cards (nominee)         | Fully deterministic — hardcoded in `generateActionCards()`     |

---

## Cost Budget

| Call                            | Model       | Frequency    | Est. cost   |
| ------------------------------- | ----------- | ------------ | ----------- |
| `generateGreeting`              | gpt-4o-mini | Per analysis | ~$0.001     |
| `generateHomeSummary`           | gpt-4o-mini | Per analysis | ~$0.001     |
| `generatePortfolioOverviewCard` | gpt-4o-mini | Per analysis | ~$0.002     |
| `generateStarPerformerCard`     | gpt-4o-mini | Per analysis | ~$0.002     |
| `generateWorstPerformerCard`    | gpt-4o-mini | Per analysis | ~$0.002     |
| `generateFunFactCard`           | gpt-4o-mini | Per analysis | ~$0.002     |
| `generateBehaviorCard`          | gpt-4o      | Per analysis | ~$0.02      |
| `generateRiskCard`              | gpt-4o      | Per analysis | ~$0.015     |
| `generateAnomalyCards` (×2–3)   | gpt-4o      | Per analysis | ~$0.03      |
| **Total per full analysis**     |             |              | **~$0.075** |

Cache `insightCards` in MongoDB alongside the analysis result. Only regenerate when:

-   A new statement is parsed
-   The user explicitly requests a refresh
-   30 days have elapsed

---

## Summary of Files to Touch

```
CREATE (new):
  src/types/analysis/insight-cards.type.ts
  src/types/analysis/dashboard-data.type.ts
  src/core/analyse/modules/dashboard-data.computer.ts
  src/core/analyse/insights/anomaly.detector.ts     (if not exists)

REWRITE (full replacement):
  src/core/analyse/insights/narrative-generator.ts

MODIFY (targeted edits):
  src/types/analysis/insights.type.ts               add re-export
  src/types/analysis/analysis.type.ts               add dashboardData + insightCards fields
  src/core/analyse/analysis-engine.ts               wire computeDashboardData() + detectAnomalies()
  src/types/analysis/analysis-sections.type.ts      add hasNominee + lastTransactionDate to ActiveHolding if missing
```
