/**
 * Narrative Generator — produces InsightCards output using structured generation.
 *
 * Uses Vercel AI SDK `generateObject` with Zod schemas for type-safe LLM output.
 * Models:
 *   - gpt-4o-mini (FAST_MODEL): headlines, overview, star/worst performer, fun fact
 *   - gpt-4o (SMART_MODEL): behavioral, risk, anomaly cards
 *
 * The VOICE_GUIDE constant is injected into every LLM prompt.
 * The LEARN_ABOUT_LIBRARY is static (no LLM).
 */

import { generateObject, generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { PortfolioAnalysis } from '@/types/analysis';
import { InsightCardsResult, InsightCard, LearnAbout } from '@/types/analysis/insight-cards.type';
import { BehavioralSignals } from './behavioral.analyser';
import { DetectedAnomaly } from './anomaly.detector';
import { config } from '@/config';

const openai = createOpenAI({
    apiKey: config.openai.apiKey,
});

const FAST_MODEL = 'gpt-5-mini';
const SMART_MODEL = 'gpt-5-mini';
const GAP_MODEL = 'gpt-5-mini';

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
- Incorrect: "**Your portfolio** has a **gain** of **₹63,312**" (too many bolded generic words)

BAD EXAMPLES (real production output — NEVER write like this):
- "**Your portfolio** gained..." → WRONG: bolding generic word "Your portfolio"
- "Great news!" / "Good news!" → WRONG: corporate and condescending
- "Don't worry" / "No need to panic" → WRONG: patronising, raises anxiety
- "has seen a -0.5% gain" → WRONG: passive/euphemistic. Say "lost 0.5%"
- "!!!!" or multiple exclamation marks → WRONG: performative excitement
- Starting with "So," / "Well," / "Let's see" → WRONG: filler words, wastes space
- "Your investment journey" → WRONG: corporate brochure language
- "Exciting update!" → WRONG: fake enthusiasm. Lead with the fact instead
`.trim();

const MF_EXPERT_SYSTEM_PROMPT = `
You are a sharp, opinionated Indian mutual fund analyst. You think like the best advice on r/IndiaInvestments and r/mutualfunds distilled into one voice.

Core principles you believe deeply:
- 3-4 funds is enough for any investor. More than 6 is over-diversification — you're paying extra fees for the same exposure.
- Direct plans ALWAYS beat Regular plans. The TER difference (0.5-1.5% annually) compounds dramatically — it's the single biggest drag most investors ignore.
- Index funds should be the core of any portfolio. Active fund managers rarely beat the index consistently over 10+ years.
- A portfolio showing positive unrealised gain can hide lifetime losses from past bad redemptions. The "green screen" is misleading.
- If a gold or commodity fund is beating all equity picks, the equity selection needs serious review — a passive commodity shouldn't win.
- Nominee registration is a SEBI mandate, not optional. Without nominees, families face months of legal hurdles.
- 100% equity without an emergency fund is gambling, not investing.
- Regular plan commissions are the single biggest drag on Indian mutual fund returns. Most investors don't even know they're paying them.
- SIP consistency matters more than timing. The investor who invests every month beats the one trying to time the market.
- Overlap between funds in the same category wastes fees. Two large-cap funds hold nearly identical stocks.
`.trim();

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const HeadlineContextSchema = z.object({
    headline: z
        .string()
        .describe('The main takeaway in 1-2 sentences. Use **bold** for key numbers/fund names and *italics* for emphasis. Max 25 words.'),
    context: z
        .string()
        .describe('Supporting detail or comparison in 1-2 sentences. Use **bold** and *italics* per formatting rules. Max 25 words.'),
});

const BehaviorCardSchema = z.object({
    headline: z
        .string()
        .describe('Name the behavioral pattern in plain English. Use **bold** for key facts and *italics* for emphasis. Max 25 words.'),
    context: z
        .string()
        .describe('Explain if the pattern is good/bad/neutral and why it matters. Use **bold** and *italics*. Max 25 words.'),
    sentiment: z.enum(['positive', 'neutral', 'warning']).describe('Overall sentiment of this behavioral insight.'),
    emoji: z.string().describe('A single emoji that fits the behavioral insight.'),
});

const RiskCardSchema = z.object({
    headline: z
        .string()
        .describe(
            'Name the biggest risk clearly. Use a vivid analogy if helpful. **Bold** numbers, *italics* for qualifications. Max 25 words.'
        ),
    context: z
        .string()
        .describe('Quantify the impact in ₹ or %. Tell the user what to do. **Bold** numbers, *italics* for qualifications. Max 25 words.'),
    riskLevel: z.enum(['low', 'medium', 'high']).describe('Severity of the identified risk.'),
    primaryRisk: z
        .enum(['regular_plans', 'concentration', 'holding_concentration'])
        .describe(
            'Which risk category is dominant: regular_plans if >50% are regular, concentration if top fund house >25%, holding_concentration if single holding >30%.'
        ),
});

const AnomalyCardSchema = z.object({
    headline: z
        .string()
        .describe('State the issue in plain English. Be clear about the risk or opportunity. **Bold** key facts. Max 25 words.'),
    context: z
        .string()
        .describe('What happens if ignored, or what they gain by acting. **Bold** numbers, *italics* for emphasis. Max 25 words.'),
    actionLabel: z.string().describe('Short button text for the action CTA. Max 4 words. E.g. "Add nominees now", "Review funds".'),
    emoji: z.string().describe('A single emoji that fits this anomaly.'),
});

const GapDetectionSchema = z.object({
    gaps: z
        .array(
            z.object({
                headline: z
                    .string()
                    .describe(
                        'The missed insight in 1-2 sentences. Use **bold** for key numbers/fund names and *italics* for emphasis. Max 25 words.'
                    ),
                context: z.string().describe('Why this matters or what to do about it. Use **bold** and *italics*. Max 25 words.'),
                emoji: z.string().describe('A single emoji that fits this insight.'),
                sentiment: z.enum(['positive', 'neutral', 'warning', 'curious']).describe('Overall sentiment of this gap insight.'),
                importance: z.enum(['high', 'medium']).describe('How important is this missed insight.'),
                suggestedTitle: z.string().describe('Short card title, max 5 words.'),
            })
        )
        .min(0)
        .max(2),
});

// ── Learn About Library (static, no LLM) ──────────────────────────────────────

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

// ── Usage Tracking ──────────────────────────────────────────────────────────

export interface LLMCallUsage {
    model: string;
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    cacheWriteTokens: number;
}

// ── Main Class ─────────────────────────────────────────────────────────────────

export class NarrativeGenerator {
    private _calls: LLMCallUsage[] = [];

    /** Get accumulated token usage across all LLM calls. */
    getUsage(): LLMCallUsage[] {
        return this._calls;
    }

    /** Get usage aggregated per model. */
    getUsageByModel(): Map<
        string,
        { calls: number; inputTokens: number; outputTokens: number; cachedInputTokens: number; cacheWriteTokens: number }
    > {
        const map = new Map<
            string,
            { calls: number; inputTokens: number; outputTokens: number; cachedInputTokens: number; cacheWriteTokens: number }
        >();
        for (const call of this._calls) {
            const entry = map.get(call.model) ?? { calls: 0, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0 };
            entry.calls++;
            entry.inputTokens += call.inputTokens;
            entry.outputTokens += call.outputTokens;
            entry.cachedInputTokens += call.cachedInputTokens;
            entry.cacheWriteTokens += call.cacheWriteTokens;
            map.set(call.model, entry);
        }
        return map;
    }

    private trackUsage(model: string, usage: any): void {
        if (!usage) return;
        this._calls.push({
            model,
            inputTokens: usage.inputTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
            cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
            cacheWriteTokens: usage.inputTokenDetails?.cacheWriteTokens ?? 0,
        });
    }

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

    // ── Gap Detection Agent ─────────────────────────────────────────────

    async detectGaps(analysis: PortfolioAnalysis, existingCards: InsightCard[]): Promise<InsightCard[]> {
        try {
            const ps = analysis.portfolioSummary;
            const xi = analysis.xirrAnalysis;

            const cardSummaries = existingCards.map(c => ({
                id: c.id,
                title: c.title,
                headline: c.headline,
                type: c.type,
            }));

            const portfolioContext = {
                totalInvestedRs: Math.round(ps.totalInvested),
                totalMarketValueRs: Math.round(ps.totalMarketValue),
                unrealisedGainRs: Math.round(ps.totalUnrealisedGain),
                lifetimePnLRs: Math.round(ps.lifetimePnL),
                portfolioXIRR: xi.portfolioXIRR.toFixed(1),
                activeFunds: ps.activeFolioCount,
                regularPlanCount: analysis.activeHoldings.filter(h => h.plan === 'Regular').length,
                directPlanCount: analysis.activeHoldings.filter(h => h.plan === 'Direct').length,
                topHoldings: analysis.activeHoldings.slice(0, 5).map(h => ({
                    name: h.schemeName,
                    weight: h.weight.toFixed(1),
                    gainPct: h.unrealisedGainPct.toFixed(1),
                    plan: h.plan,
                })),
                schemeXIRRs: xi.schemeXIRR.slice(0, 8).map(s => ({
                    name: s.schemeName,
                    xirr: s.xirr.toFixed(1),
                    mv: Math.round(s.marketValue),
                })),
            };

            const result = await this.callLLMObjectWithSystem(
                GAP_MODEL,
                MF_EXPERT_SYSTEM_PROMPT,
                `${VOICE_GUIDE}

You are reviewing a set of insight cards already generated for this investor's portfolio. Your job is to find 0-2 genuinely important insights that the existing cards MISSED.

DO NOT repeat anything the existing cards already cover. Only surface insights that are truly missing and would meaningfully help the investor.

If the existing cards already cover everything important, return an empty gaps array. Quality over quantity — only flag genuinely missed signals.

EXISTING CARDS:
${JSON.stringify(cardSummaries, null, 2)}

PORTFOLIO DATA:
${JSON.stringify(portfolioContext, null, 2)}`,
                GapDetectionSchema
            );

            if (!result || result.gaps.length === 0) return [];

            const maxExistingPriority = Math.max(...existingCards.map(c => c.priority), 0);

            return result.gaps.map((gap, i) => ({
                id: `gap_${i + 1}`,
                type: 'performance' as const,
                sentiment: gap.sentiment === 'curious' ? ('curious' as const) : (gap.sentiment as InsightCard['sentiment']),
                priority: maxExistingPriority + 1 + i,
                emoji: gap.emoji || '💡',
                title: gap.suggestedTitle,
                headline: gap.headline,
                context: gap.context,
            }));
        } catch (err) {
            console.warn('[NarrativeGenerator] Gap detection failed:', (err as Error).message);
            return [];
        }
    }

    // ── Greeting ───────────────────────────────────────────────────────────

    private async generateGreeting(analysis: PortfolioAnalysis, anomalies: DetectedAnomaly[]): Promise<string> {
        const rawName = analysis.investor.name.split(' ')[0];
        const name = rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();
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

        return this.callLLMText(
            FAST_MODEL,
            `${VOICE_GUIDE}

Write a warm, personal greeting for the top of a mutual fund insights screen. 1-2 sentences.
- Address the investor by first name: ${name}
- Mention portfolio status (up/down) with a **bolded** amount
- If urgent issues exist, acknowledge them briefly and honestly
- End with a light hook like "Here's what we found" or "Here's the full picture"
- Tone: WhatsApp message from a smart friend. NOT corporate.

Context: ${JSON.stringify(context)}
Return just the greeting string. Use **bold** for key numbers.`
        );
    }

    // ── Home Summary ───────────────────────────────────────────────────────

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

        return this.callLLMText(
            FAST_MODEL,
            `${VOICE_GUIDE}

Write a 1-line summary for an app home screen. Max 15 words. Use bullet as separator. No markdown here.
Format: "[gain status] [bullet] [urgent items if any] [bullet] [star performer]"
Example: "Up 63K overall [bullet] 1 urgent action [bullet] DSP leading the pack"

Context: ${JSON.stringify(context)}
Return just the summary string. No markdown in this field.`
        );
    }

    // ── Card Generators ────────────────────────────────────────────────────

    private async generatePortfolioOverviewCard(analysis: PortfolioAnalysis): Promise<InsightCard | null> {
        const ps = analysis.portfolioSummary;
        const xi = analysis.xirrAnalysis;

        const result = await this.callLLMObject(
            FAST_MODEL,
            `${VOICE_GUIDE}

Generate a portfolio overview card.
- headline: The "so what" of overall portfolio. Mention total gain in INR. Is it good? Relate to something real.
- context: Add XIRR briefly OR compare to a simple FD alternative.

Data: ${JSON.stringify({
                totalInvestedRs: Math.round(ps.totalInvested),
                totalMarketValueRs: Math.round(ps.totalMarketValue),
                unrealisedGainRs: Math.round(ps.totalUnrealisedGain),
                unrealisedGainPct: ps.totalUnrealisedGainPct.toFixed(1),
                lifetimePnLRs: Math.round(ps.lifetimePnL),
                portfolioXIRR: xi.portfolioXIRR.toFixed(1),
                activeFunds: ps.activeFolioCount,
            })}`,
            HeadlineContextSchema
        );

        if (!result) return null;

        return {
            id: 'portfolio_overview',
            type: 'performance',
            sentiment: ps.totalUnrealisedGain >= 0 ? 'positive' : 'negative',
            priority: 5,
            emoji: ps.totalUnrealisedGain >= 0 ? '📈' : '📉',
            title: 'The Big Picture',
            headline: result.headline,
            context: result.context,
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

        const result = await this.callLLMObject(
            FAST_MODEL,
            `${VOICE_GUIDE}

Generate a "star performer" card for the best fund.
- headline: Lead with what the fund EARNED in INR. Name the fund (can abbreviate). Compare to FD if gap is notable.
- context: Mention holding period OR benchmark gap if fund is beating it.

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
            })}`,
            HeadlineContextSchema
        );

        if (!result) return null;

        return {
            id: 'star_performer',
            type: 'performance',
            sentiment: 'positive',
            priority: 6,
            emoji: '⭐',
            title: 'Your Star Fund',
            headline: result.headline,
            context: result.context,
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
        if (worst.xirr > 4) return null;

        const result = await this.callLLMObject(
            FAST_MODEL,
            `${VOICE_GUIDE}

Generate a "needs attention" card for the weakest fund. Be honest but not alarmist.
- headline: State performance clearly. Name the fund.
- context: Suggest this is worth reviewing, not necessarily selling.

Data: ${JSON.stringify({
                fundName: worst.schemeName,
                shortName: worst.schemeName.split(' ').slice(0, 2).join(' '),
                xirrPct: worst.xirr.toFixed(1),
                gainPct: holding.unrealisedGainPct.toFixed(1),
                currentValueRs: Math.round(worst.marketValue),
                holdingDays: holding.holdingDays,
            })}`,
            HeadlineContextSchema
        );

        if (!result) return null;

        return {
            id: 'worst_performer',
            type: 'performance',
            sentiment: worst.xirr < 0 ? 'negative' : 'warning',
            priority: 9,
            emoji: '🔍',
            title: 'Worth a Second Look',
            headline: result.headline,
            context: result.context,
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

        const result = await this.callLLMObject(
            SMART_MODEL,
            `${VOICE_GUIDE}

Generate a behavioral insight card about this investor's habits.
Focus on the SINGLE most interesting/surprising pattern. Signal identified: "${mostInterestingSignal}"

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
            })}`,
            BehaviorCardSchema
        );

        if (!result) return null;

        return {
            id: 'investment_behavior',
            type: 'behavior',
            sentiment: result.sentiment,
            priority: 10,
            emoji: result.emoji || '🧠',
            title: 'How You Invest',
            headline: result.headline,
            context: result.context,
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

        // Compute projected TER drag for Regular plan holdings
        const regularMV = analysis.activeHoldings.filter(h => h.plan === 'Regular').reduce((sum, h) => sum + h.marketValue, 0);
        const tenYearDragRs = Math.round(regularMV * (Math.pow(1.007, 10) - 1));
        const twentyYearDragRs = Math.round(regularMV * (Math.pow(1.007, 20) - 1));

        const result = await this.callLLMObject(
            SMART_MODEL,
            `${VOICE_GUIDE}

Generate a risk card. Identify the SINGLE biggest risk.

Priority of risks (check in order):
1. regular_plans: if regularCount > half of totalActive
2. concentration: if topFundHouseWeight > 25%
3. holding_concentration: if a single holding > 30%

If the risk is regular_plans: Lead with the 10-year projected drag in ₹. Do NOT use a coffee analogy. Show how much money they'll lose to hidden commissions over 10 years. The drag compounds — make that visceral.

Data: ${JSON.stringify({
                regularCount,
                totalActive,
                estimatedAnnualFeeDragRs,
                regularMarketValueRs: Math.round(regularMV),
                tenYearDragRs,
                twentyYearDragRs,
                topFundHouseName: topFundHouse?.fundHouse,
                topFundHouseWeightPct: topFundHouse?.weight?.toFixed(1),
                topHoldingName: analysis.activeHoldings[0]?.schemeName,
                topHoldingWeightPct: analysis.activeHoldings[0]?.weight?.toFixed(1),
                totalMarketValueRs: Math.round(ps.totalMarketValue),
            })}`,
            RiskCardSchema
        );

        if (!result) return null;

        const learnMap: Record<string, LearnAbout> = {
            regular_plans: LEARN_ABOUT_LIBRARY.regular_vs_direct,
            concentration: LEARN_ABOUT_LIBRARY.diversification,
            holding_concentration: LEARN_ABOUT_LIBRARY.diversification,
        };

        const sentimentMap = { low: 'neutral', medium: 'warning', high: 'warning' } as const;

        return {
            id: 'risk_overview',
            type: 'risk',
            sentiment: sentimentMap[result.riskLevel] ?? 'neutral',
            priority: 7,
            emoji: result.riskLevel === 'high' ? '⚠️' : '🛡️',
            title: result.riskLevel === 'high' ? 'Risk Alert' : 'Risk Check',
            headline: result.headline,
            context: result.context,
            action: result.primaryRisk === 'regular_plans' ? { label: 'See how to switch to Direct', type: 'learn' } : undefined,
            learnAbout: learnMap[result.primaryRisk] ?? LEARN_ABOUT_LIBRARY.diversification,
            tags: [
                { label: 'Regular plans', value: `${regularCount} of ${totalActive}` },
                { label: 'Top fund house', value: `${topFundHouse?.weight?.toFixed(0)}%` },
            ],
        };
    }

    private async generateAnomalyCards(anomalies: DetectedAnomaly[], analysis: PortfolioAnalysis): Promise<InsightCard[]> {
        if (anomalies.length === 0) return [];

        // Skip NO_NOMINEES — it has a dedicated static action card already
        const filtered = anomalies.filter(a => a.id !== 'NO_NOMINEES');

        const critical = filtered.filter(a => a.severity === 'critical').slice(0, 3);
        const warnings = filtered.filter(a => a.severity === 'warning').slice(0, 4);
        const toProcess = [...critical, ...warnings];

        const results = await Promise.all(toProcess.map((anomaly, i) => this.generateSingleAnomalyCard(anomaly, analysis, i)));
        return results.filter((c): c is InsightCard => c !== null);
    }

    private async generateSingleAnomalyCard(
        anomaly: DetectedAnomaly,
        analysis: PortfolioAnalysis,
        index: number
    ): Promise<InsightCard | null> {
        const result = await this.callLLMObject(
            SMART_MODEL,
            `${VOICE_GUIDE}

Generate an anomaly card for a detected portfolio issue.

Data: ${JSON.stringify({
                title: anomaly.title,
                severity: anomaly.severity,
                category: anomaly.category,
                data: anomaly.dataPoints,
                investorFirstName:
                    analysis.investor.name.split(' ')[0].charAt(0).toUpperCase() +
                    analysis.investor.name.split(' ')[0].slice(1).toLowerCase(),
                totalMarketValueRs: Math.round(analysis.portfolioSummary.totalMarketValue),
            })}`,
            AnomalyCardSchema
        );

        if (!result) return null;

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
            emoji: result.emoji || '📌',
            title: anomaly.severity === 'critical' ? 'Action Needed' : 'Heads Up',
            headline: result.headline,
            context: result.context,
            action: {
                label: result.actionLabel || 'Learn more',
                type: anomaly.severity === 'critical' ? 'act_now' : 'review',
                urgent: anomaly.severity === 'critical',
            },
            learnAbout: learnMap[anomaly.category],
        };
    }

    private async generateFunFactCard(analysis: PortfolioAnalysis): Promise<InsightCard | null> {
        const ps = analysis.portfolioSummary;
        const yearsApprox = 3;
        const fdValue = Math.round(ps.totalInvested * Math.pow(1.07, yearsApprox));
        const mfVsFD = Math.round(ps.totalMarketValue - fdValue);

        const result = await this.callLLMObject(
            FAST_MODEL,
            `${VOICE_GUIDE}

Generate a fun fact card comparing MF to bank FD. Make it surprising and relatable.
- headline: Lead with the comparison outcome. Make it feel real (relate to everyday purchases).
- context: Give the FD number for contrast, then a real-world comparison for the difference.

Data: ${JSON.stringify({
                totalInvestedRs: Math.round(ps.totalInvested),
                mfCurrentValueRs: Math.round(ps.totalMarketValue),
                fdValueRs: fdValue,
                differenceRs: mfVsFD,
                differenceIsPositive: mfVsFD > 0,
            })}`,
            HeadlineContextSchema
        );

        if (!result) return null;

        return {
            id: 'fun_fact_fd',
            type: 'fun_fact',
            sentiment: mfVsFD > 0 ? 'positive' : 'curious',
            priority: 12,
            emoji: '🏦',
            title: 'vs. Putting it in the Bank',
            headline: result.headline,
            context: result.context,
            highlightMetric: {
                value: `₹${Math.abs(mfVsFD).toLocaleString('en-IN')}`,
                label: mfVsFD > 0 ? 'more than FD would have given' : 'less than FD would have given',
                trend: mfVsFD > 0 ? 'up' : 'down',
            },
            learnAbout: LEARN_ABOUT_LIBRARY.cagr,
        };
    }

    private generateActionCards(anomalies: DetectedAnomaly[], analysis: PortfolioAnalysis): InsightCard[] {
        const cards: InsightCard[] = [];

        const nomineeAnomaly = anomalies.find(a => a.id === 'NO_NOMINEES');
        if (nomineeAnomaly) {
            const count = (nomineeAnomaly.dataPoints.foliosWithoutNominee as number) ?? (nomineeAnomaly.dataPoints.count as number) ?? 0;
            const totalValue = (nomineeAnomaly.dataPoints.totalValueAtRisk as number) ?? analysis.portfolioSummary.totalMarketValue;
            cards.push({
                id: 'action_nominee',
                type: 'action',
                sentiment: 'warning',
                priority: 2,
                emoji: '👤',
                title: 'Takes 5 Minutes',
                headline: `**${
                    count > 0 ? count : 'Several'
                } of your funds** have no nominee — if something happened to you, your family could wait *months* to access **₹${
                    totalValue >= 100000 ? `${(totalValue / 100000).toFixed(1)}L` : `${Math.round(totalValue / 1000)}K`
                }**.`,
                context: 'Adding a nominee is free, takes 5 minutes on your AMC app, and protects your family *immediately*.',
                action: { label: 'Add nominees now', type: 'act_now', urgent: true },
                learnAbout: LEARN_ABOUT_LIBRARY.nominee,
            });
        }

        return cards;
    }

    // ── Private Helpers ────────────────────────────────────────────────────

    private pickMostInterestingBehaviorSignal(b: BehavioralSignals): string {
        if (b.emotionalSignals.panicSelling.length > 0) return 'panic selling detected';
        if (b.emotionalSignals.fomoChasing.length > 0) return 'FOMO buying detected';
        if (b.investmentCadence.longestGapDays > 180) return `long investment gap of ${b.investmentCadence.longestGapDays} days`;
        if (b.timingSignals.dipBuyerScore > 50) return 'good dip-buying habit';
        if (b.amountPatterns.roundNumberBias > 0.9) return 'high round-number bias (95%+)';
        if (b.investmentCadence.consistencyScore > 70) return 'high consistency score';
        return 'investment cadence and amount patterns';
    }

    private async callLLMText(model: string, prompt: string): Promise<string> {
        try {
            const { text, usage } = await generateText({ model: openai(model), prompt });
            this.trackUsage(model, usage);
            return text.trim();
        } catch (err) {
            console.warn(`[NarrativeGenerator] LLM text call failed (${model}):`, (err as Error).message);
            return '';
        }
    }

    private async callLLMObject<T extends z.ZodType>(model: string, prompt: string, schema: T): Promise<z.infer<T> | null> {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await (generateObject as any)({
                model: openai(model),
                prompt,
                schema,
            });
            this.trackUsage(model, result.usage);
            return result.object as z.infer<T>;
        } catch (err) {
            console.warn(`[NarrativeGenerator] generateObject failed (${model}):`, (err as Error).message);
            return null;
        }
    }

    private async callLLMObjectWithSystem<T extends z.ZodType>(
        model: string,
        system: string,
        prompt: string,
        schema: T
    ): Promise<z.infer<T> | null> {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await (generateObject as any)({
                model: openai(model),
                system,
                prompt,
                schema,
            });
            this.trackUsage(model, result.usage);
            return result.object as z.infer<T>;
        } catch (err) {
            console.warn(`[NarrativeGenerator] generateObject (system) failed (${model}):`, (err as Error).message);
            return null;
        }
    }
}
