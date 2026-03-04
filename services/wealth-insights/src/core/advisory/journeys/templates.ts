import { JourneyTemplate, JourneyCard } from '@/types/advisory/card-journey.type';
import { InsightKey } from '@/types/advisory/insight-state.type';

// ── Helpers ─────────────────────────────────────────────────────────────────

function card(slot: JourneyCard['slot'], title: string, body: string, extras?: Partial<JourneyCard>): JourneyCard {
    return { slot, title, body, ...extras };
}

function pl(n: number, singular: string, plural?: string): string {
    return n === 1 ? `1 ${singular}` : `${n} ${plural ?? singular + 's'}`;
}

// ── Templates ───────────────────────────────────────────────────────────────

const regularPlanCost: JourneyTemplate = {
    insightKey: 'regular_plan_cost',
    build: (v) => ({
        cards: [
            card('answer', 'You\'re paying hidden commissions', `{{regularCount}} of your funds are Regular plans. Distributors earn a commission from your returns every year.`),
            card('education', 'Regular vs Direct plans', 'Mutual funds come in two versions: Regular (with distributor commission baked into the TER) and Direct (lower TER, you keep the difference). Over 10+ years, the difference compounds significantly.'),
            card('your_data', 'Your commission leak', `Your Regular plan funds have a combined value of {{totalRegularMV}}. Switching to Direct could save you ~{{annualSavings}} per year in fees.`, {
                highlightValue: '{{annualSavings}}',
                highlightLabel: 'potential annual savings',
            }),
            card('impact', '10-year compounding effect', 'That annual savings, reinvested over 10 years at your portfolio\'s XIRR, would grow to a significant amount. The longer you wait, the more you lose to compounding drag.'),
            card('action', 'Switch to Direct plans', 'You can switch each fund from Regular to Direct through your AMC\'s website or apps like Kuvera, Groww, or Coin. The switch is a redemption + re-purchase — check for exit load and tax impact first.'),
        ],
        snapshotValues: { regularCount: v.regularCount, totalRegularMV: v.totalRegularMV, annualSavings: v.annualSavings },
    }),
};

const overlapWarning: JourneyTemplate = {
    insightKey: 'overlap_warning',
    build: (v) => ({
        cards: [
            card('answer', 'Your funds are buying the same stocks', `${pl(v.highOverlapPairs, 'fund pair')} with over 40% overlap — you\'re paying multiple expense ratios for nearly identical exposure.`),
            card('education', 'What is fund overlap?', 'Fund overlap means two or more of your funds hold the same underlying stocks. High overlap (>40%) means you\'re not getting true diversification — just paying extra fees for similar portfolios.'),
            card('your_data', 'Overlapping pairs', `We found ${pl(v.highOverlapPairs, 'pair')} with significant overlap in your portfolio. These funds share many of the same top holdings.`, {
                highlightValue: '{{highOverlapPairs}}',
                highlightLabel: 'overlapping pairs',
            }),
            card('impact', 'Hidden cost of overlap', 'Holding overlapping funds increases your effective expense ratio without adding diversification. Consolidating could reduce fees and simplify your portfolio.'),
            card('action', 'Consolidate overlapping funds', 'Consider keeping the fund with better performance and lower TER from each overlapping pair. Redeem the weaker one and redirect that SIP.'),
        ],
        snapshotValues: { highOverlapPairs: v.highOverlapPairs, warnings: v.warnings },
    }),
};

const fundHouseConcentration: JourneyTemplate = {
    insightKey: 'fund_house_concentration',
    build: (v) => ({
        cards: [
            card('answer', 'Too much in one fund house', `{{fundHouse}} controls {{weight}}% of your portfolio. That\'s a concentration risk if the AMC faces regulatory or operational issues.`),
            card('education', 'AMC concentration risk', 'While your money is held by custodians (not the AMC), operational disruptions, key-person departures, or regulatory actions against a single AMC can affect fund performance and redemption timelines.'),
            card('your_data', 'Your concentration', `{{weight}}% of your portfolio is with {{fundHouse}}. Ideally, no single AMC should control more than 40-50% of your investments.`, {
                highlightValue: '{{weight}}%',
                highlightLabel: 'in one fund house',
            }),
            card('impact', 'Diversification benefit', 'Spreading across 2-3 reputed AMCs reduces single-entity risk while maintaining portfolio quality.'),
            card('action', 'Diversify across AMCs', 'For new SIPs or lump sum investments, consider funds from other top AMCs. No need to redeem existing holdings unless there are performance concerns.'),
        ],
        snapshotValues: { fundHouse: v.fundHouse, weight: v.weight },
    }),
};

const noNominees: JourneyTemplate = {
    insightKey: 'no_nominees',
    build: (v) => ({
        cards: [
            card('answer', 'Some folios have no nominee', `{{count}} of your folios don\'t have a nominee registered. This can cause major issues for your family during emergencies.`),
            card('education', 'Why nominees matter', 'Without a nominee, your family would need to go through a lengthy legal process to claim your mutual fund investments. SEBI has made nomination mandatory for new folios.'),
            card('your_data', 'Folios without nominees', `${pl(v.count, 'folio')} missing nominee details. This is a critical gap in your financial planning.`, {
                highlightValue: '{{count}}',
                highlightLabel: 'folios without nominee',
            }),
            card('impact', 'What happens without a nominee', 'Claims without a nominee require succession certificates, legal heir certificates, or probate — a process that can take 6-12 months and involve legal costs.'),
            card('action', 'Add nominees now', 'Log into your AMC websites or visit a CAMS/KFintech service centre. You can also update nominees through MFCentral.com. It\'s a one-time 5-minute process per folio.'),
        ],
        snapshotValues: { count: v.count },
    }),
};

const fundManagerChange: JourneyTemplate = {
    insightKey: 'fund_manager_change',
    build: (v) => ({
        cards: [
            card('answer', 'Fund manager changed', 'A fund you own has a new fund manager. This may affect the investment style and performance going forward.'),
            card('education', 'Does the fund manager matter?', 'Active fund performance depends significantly on the fund manager\'s skill. A change can shift strategy, risk appetite, and stock selection. It\'s worth monitoring for 2-3 quarters.'),
            card('your_data', 'Affected fund', `The fund manager change was detected in your portfolio. Watch for style drift in the next few months.`),
            card('impact', 'Historical impact', 'Studies show fund manager changes can lead to short-term underperformance as the new manager adjusts the portfolio to their style.'),
            card('action', 'Monitor for 2 quarters', 'Don\'t react immediately. Watch the fund\'s next 2 quarterly factsheets. If style drift or underperformance persists, consider alternatives.'),
        ],
        snapshotValues: v ?? {},
    }),
};

const benchmarkWeekly: JourneyTemplate = {
    insightKey: 'benchmark_weekly',
    build: (v) => ({
        cards: [
            card('answer', 'Your weekly benchmark check', `Your portfolio XIRR is {{portfolioXirr}}%. Here\'s how you compare to major indices this week.`),
            card('education', 'XIRR vs CAGR', 'Your portfolio XIRR accounts for the timing and size of each investment. CAGR is a simpler measure for lump sum returns. XIRR is more accurate for SIP investors.'),
            card('your_data', 'Portfolio vs benchmarks', `Your portfolio is delivering {{portfolioXirr}}% XIRR. Compare this against the benchmark returns to gauge your performance.`, {
                highlightValue: '{{portfolioXirr}}%',
                highlightLabel: 'your portfolio XIRR',
            }),
            card('impact', 'What this means', 'Beating the benchmark consistently suggests your fund selection is adding value. Trailing it may mean index funds could do better for less cost.'),
            card('action', 'Review underperformers', 'If your portfolio trails the benchmark, identify which funds are dragging performance. Consider switching persistent underperformers.'),
        ],
        snapshotValues: { portfolioXirr: v.portfolioXirr },
    }),
};

const bestWorstFundWeekly: JourneyTemplate = {
    insightKey: 'best_worst_fund_weekly',
    build: (v) => ({
        cards: [
            card('answer', 'Your best & worst this week', `Best: ${v.best?.schemeName ?? 'N/A'} at {{bestGain}}%. Worst: ${v.worst?.schemeName ?? 'N/A'} at {{worstGain}}%.`),
            card('education', 'Short-term vs long-term', 'Weekly performance is noise. Don\'t make buy/sell decisions based on one week. Look at rolling 1-year and 3-year returns for meaningful signals.'),
            card('your_data', 'Performance spread', `The gap between your best and worst fund is {{spreadPct}} percentage points. A wide spread isn\'t necessarily bad — it can mean genuine diversification.`, {
                highlightValue: '{{spreadPct}}pp',
                highlightLabel: 'performance spread',
            }),
            card('impact', 'Why both matter', 'Your best fund drives returns, your worst teaches you about risk tolerance. Both are important for portfolio design.'),
            card('action', 'Check trailing 1Y return', 'If a fund has been your worst performer for 4+ consecutive quarters, it might be worth reviewing its fundamentals.'),
        ],
        snapshotValues: {
            bestGain: v.best?.gainPct ?? 0,
            worstGain: v.worst?.gainPct ?? 0,
            spreadPct: ((v.best?.gainPct ?? 0) - (v.worst?.gainPct ?? 0)).toFixed(1),
        },
    }),
};

const riskRewardMonthly: JourneyTemplate = {
    insightKey: 'risk_reward_monthly',
    build: (v) => ({
        cards: [
            card('answer', 'Your risk-reward profile this month', `Sharpe ratio: {{sharpeRatio}}. Max drawdown: {{maxDrawdown}}%. Your portfolio\'s risk-adjusted returns at a glance.`),
            card('education', 'Understanding Sharpe ratio', 'The Sharpe ratio measures return per unit of risk. Above 1.0 is good, above 2.0 is excellent. A negative Sharpe means you\'d have been better off in a savings account.'),
            card('your_data', 'Your risk numbers', `Volatility: {{volatility}}%, Max drawdown: {{maxDrawdown}}%, Sharpe: {{sharpeRatio}}`, {
                highlightValue: '{{sharpeRatio}}',
                highlightLabel: 'Sharpe ratio',
            }),
            card('impact', 'What this means for you', 'A good Sharpe ratio means your returns are compensating you fairly for the risk taken. Low Sharpe with high volatility suggests you could get better risk-adjusted returns elsewhere.'),
            card('action', 'Optimize risk-reward', 'If your Sharpe ratio is below 1, consider whether lower-volatility alternatives (like index funds or balanced funds) could deliver similar returns with less risk.'),
        ],
        snapshotValues: { sharpeRatio: v.sharpeRatio, maxDrawdown: v.maxDrawdown, volatility: v.volatility },
    }),
};

const assetAllocationDrift: JourneyTemplate = {
    insightKey: 'asset_allocation_drift',
    build: (v) => ({
        cards: [
            card('answer', 'Your asset allocation has drifted', `Your portfolio has drifted {{drift}}% from its initial allocation. This changes your risk profile without you realizing it.`),
            card('education', 'What is allocation drift?', 'As different asset classes grow at different rates, your portfolio mix changes. A 60:40 equity:debt split can become 75:25 after a bull run, exposing you to more risk than intended.'),
            card('your_data', 'Current drift', `Your portfolio drift is {{drift}}%. Rebalancing may be needed to restore your target allocation.`, {
                highlightValue: '{{drift}}%',
                highlightLabel: 'allocation drift',
            }),
            card('impact', 'Risk of not rebalancing', 'Unchecked drift means your portfolio risk keeps increasing in bull markets and decreasing in bear markets — the opposite of what you want.'),
            card('action', 'Rebalance your portfolio', 'The simplest approach: redirect new SIPs to the underweight asset class. For larger drifts, consider a one-time rebalance via redemption and reinvestment.'),
        ],
        snapshotValues: { drift: v.drift, needsRebalancing: v.needsRebalancing },
    }),
};

const ltcgBoundary30d: JourneyTemplate = {
    insightKey: 'ltcg_boundary_30d',
    build: (v) => ({
        cards: [
            card('answer', 'STCG → LTCG conversion coming', `${pl(Array.isArray(v) ? v.length : 0, 'holding')} will convert from STCG to LTCG within 30 days. This can significantly reduce your tax.`),
            card('education', 'STCG vs LTCG in mutual funds', 'Equity funds held >12 months qualify for LTCG tax at 12.5% (above ₹1.25L exemption). STCG is taxed at 20%. Waiting a few weeks could save you meaningful tax.'),
            card('your_data', 'Holdings approaching LTCG', `These holdings are days away from the LTCG threshold. Consider waiting before redeeming.`),
            card('impact', 'Tax savings potential', 'The difference between STCG (20%) and LTCG (12.5% with ₹1.25L exemption) can save you thousands — or lakhs on larger holdings.'),
            card('action', 'Wait before redeeming', 'If you were planning to redeem these funds, waiting a few more days could qualify them for the lower LTCG rate.'),
        ],
        snapshotValues: { holdings: v },
    }),
};

const ltcgExemption80pct: JourneyTemplate = {
    insightKey: 'ltcg_exemption_80pct',
    build: (v) => ({
        cards: [
            card('answer', 'LTCG exemption nearly exhausted', `If you redeemed today, ₹{{ltcgUsed}} of your ₹1.25L annual LTCG exemption would be consumed. Only ₹{{remaining}} would remain tax-free.`),
            card('education', 'LTCG exemption explained', 'Each financial year, you get ₹1.25L of LTCG completely tax-free on redemption. Any LTCG above this is taxed at 12.5%. Planning redemptions across FY boundaries can maximize this benefit.'),
            card('your_data', 'Your unrealised LTCG status', `Your unrealised long-term gains would consume ₹{{ltcgUsed}} of the ₹1.25L exemption if booked now. Plan any redemptions carefully.`, {
                highlightValue: '₹{{remaining}}',
                highlightLabel: 'exemption remaining',
            }),
            card('impact', 'Plan across financial years', 'If you need to redeem more, consider splitting: redeem some now and the rest after April 1 to get a fresh ₹1.25L exemption.'),
            card('action', 'Defer large redemptions', 'If your redemption can wait, booking the remaining gains after the FY resets your exemption limit.'),
        ],
        snapshotValues: { ltcgUsed: v.ltcgUsed, remaining: v.remaining },
    }),
};

const taxHarvestSeasonal: JourneyTemplate = {
    insightKey: 'tax_harvest_seasonal',
    build: (v) => ({
        cards: [
            card('answer', 'Tax harvesting season is here', `It\'s Jan-Mar — the perfect window to book LTCG up to your remaining ₹{{remaining}} exemption and reinvest immediately.`),
            card('education', 'What is tax harvesting?', 'Tax harvesting means booking gains within your LTCG exemption limit and reinvesting immediately. You "reset" your purchase price higher while paying zero tax.'),
            card('your_data', 'Your harvesting opportunity', `You have ₹{{remaining}} of unused LTCG exemption this FY. Book gains up to this amount tax-free before March 31.`, {
                highlightValue: '₹{{remaining}}',
                highlightLabel: 'can be harvested tax-free',
            }),
            card('impact', 'Why this matters', 'Tax harvesting every year reduces your future tax liability. Over 10 years, annual harvesting can save you lakhs in taxes.'),
            card('action', 'Harvest before March 31', 'Redeem units with LTCG up to your remaining exemption, then reinvest the proceeds. This resets your cost basis without any tax impact.'),
        ],
        snapshotValues: { remaining: v.remaining, month: v.month },
    }),
};

const elssUnlock30d: JourneyTemplate = {
    insightKey: 'elss_unlock_30d',
    build: (v) => ({
        cards: [
            card('answer', 'ELSS units unlocking soon', `${pl(Array.isArray(v) ? v.length : 0, 'ELSS holding')} with oldest units completing the 3-year lock-in within 30 days. Note: each SIP installment has its own 3-year lock.`),
            card('education', 'ELSS lock-in period', 'ELSS has a mandatory 3-year lock-in per installment. If you invest via SIP, each month\'s units unlock 3 years from their purchase date — not all at once.'),
            card('your_data', 'Unlocking soon', 'The oldest units in your ELSS investments are about to complete their lock-in period. Newer SIP installments may still be locked.'),
            card('impact', 'Redeem or hold?', 'If the fund is a consistent performer, holding beyond lock-in is often wise. If underperforming, you can switch to a better ELSS (for next year\'s 80C) or a non-ELSS fund.'),
            card('action', 'Review performance at unlock', 'Compare your ELSS fund\'s 3-year return against its benchmark and category average. Decide based on performance, not just because the lock-in ended.'),
        ],
        snapshotValues: { holdings: v },
    }),
};

const investorProfile: JourneyTemplate = {
    insightKey: 'investor_profile',
    build: (_v) => ({
        cards: [
            card('answer', 'Your investor profile', 'Based on your transaction history, we\'ve identified your investing personality. This helps us personalize your insights.'),
            card('education', 'Investor archetypes', 'Every investor has patterns — SIP discipline, reaction to market drops, holding period tendencies. Understanding yours helps you make better decisions.'),
            card('your_data', 'Your pattern', `We analyzed your transaction history to identify your investing behavior. Your profile will be refined as we observe more data.`),
            card('impact', 'Self-awareness edge', 'Investors who understand their own behavioral biases tend to make 2-3% better annual returns by avoiding emotional decisions.'),
            card('action', 'Lean into your strengths', 'Your investor type comes with natural strengths. We\'ll tailor future insights to reinforce your good habits and gently flag risky ones.'),
        ],
        snapshotValues: {},
    }),
};

const marketCrashBehavioral: JourneyTemplate = {
    insightKey: 'market_crash_behavioral',
    build: (v) => ({
        cards: [
            card('answer', 'Market is dropping — stay calm', 'Significant market decline detected. History shows that staying invested through drops leads to better long-term outcomes.'),
            card('education', 'Markets always recover', 'Every major crash (2008, 2020, 2022) was followed by a recovery. Selling during a crash locks in losses. Continuing SIPs during drops means buying at lower prices.'),
            card('your_data', 'Your portfolio impact', `The benchmark has dropped significantly. Your portfolio may show temporary losses, but your underlying holdings remain the same.`),
            card('impact', 'Cost of panic selling', 'Investors who sold during the 2020 crash missed a 100%+ recovery within 18 months. Staying invested was worth lakhs.'),
            card('action', 'Continue your SIPs', 'Don\'t stop your SIPs. In fact, market drops are SIP investors\' best friends — you\'re buying more units at lower prices.'),
        ],
        snapshotValues: v ?? {},
    }),
};

const sipMissed: JourneyTemplate = {
    insightKey: 'sip_missed',
    build: (v) => ({
        cards: [
            card('answer', 'SIP installments missed', `${pl(Array.isArray(v) ? v.length : 0, 'fund')} with missed SIP installments. Irregular SIPs reduce the benefit of rupee cost averaging.`),
            card('education', 'Why SIP consistency matters', 'SIPs work through rupee cost averaging — buying more units when prices are low and fewer when high. Missing installments, especially during market dips, defeats this purpose.'),
            card('your_data', 'Missed SIPs', 'Some of your SIP schemes have irregular patterns. This reduces the compounding benefit of disciplined investing.'),
            card('impact', 'Cost of missed SIPs', 'Missing even 2-3 SIP installments during a market dip can reduce your 10-year wealth by 5-8%. Consistency beats timing.'),
            card('action', 'Ensure SIP mandates are active', 'Check your bank mandates for these funds. Set up auto-debit with sufficient balance. Consider a backup bank account for SIP debits.'),
        ],
        snapshotValues: { schemes: v },
    }),
};

const portfolioNeglect: JourneyTemplate = {
    insightKey: 'portfolio_neglect',
    build: (v) => ({
        cards: [
            card('answer', 'Some funds haven\'t been reviewed in a year', `${pl(Array.isArray(v) ? v.length : 0, 'fund')} with no activity for over a year. An annual review ensures your portfolio stays aligned with your goals.`),
            card('education', 'Annual portfolio review', 'Even buy-and-hold portfolios need an annual check. Fund performance can deteriorate, categories can change, and your goals may evolve. A quick review prevents silent underperformance.'),
            card('your_data', 'Holdings due for review', 'These funds have had no transactions in over a year. This doesn\'t mean they\'re bad — but they deserve a performance check.'),
            card('impact', 'Silent underperformance', 'Funds that underperform their benchmark for 4+ quarters rarely recover. Early detection saves your returns.'),
            card('action', 'Review dormant funds', 'Check each fund\'s rolling 1-year return vs its benchmark. If it consistently trails, consider switching to a better alternative in the same category.'),
        ],
        snapshotValues: { holdings: v },
    }),
};

const tooManyFunds: JourneyTemplate = {
    insightKey: 'too_many_funds',
    build: (v) => ({
        cards: [
            card('answer', 'You own too many funds', `{{activeFolioCount}} active funds is more than you need. Research shows 5-7 well-chosen funds provide optimal diversification.`),
            card('education', 'Diminishing diversification', 'Beyond 7-8 funds, additional funds rarely add diversification. Instead, they increase overlap, complexity, and tracking burden.'),
            card('your_data', 'Your fund count', `You have {{activeFolioCount}} active funds. Some likely overlap significantly, diluting your returns and making tracking harder.`, {
                highlightValue: '{{activeFolioCount}}',
                highlightLabel: 'active funds',
            }),
            card('impact', 'Portfolio simplification', 'Fewer, well-chosen funds typically outperform bloated portfolios. Less overlap means lower effective expense ratios.'),
            card('action', 'Consolidate to 5-7 funds', 'Identify overlapping or underperforming funds. Keep the best in each category and redirect SIPs. Use our overlap analysis to guide consolidation.'),
        ],
        snapshotValues: { activeFolioCount: v.activeFolioCount },
    }),
};

// ── Template Registry ───────────────────────────────────────────────────────

export const JOURNEY_TEMPLATES: Record<InsightKey, JourneyTemplate> = {
    regular_plan_cost: regularPlanCost,
    overlap_warning: overlapWarning,
    fund_house_concentration: fundHouseConcentration,
    no_nominees: noNominees,
    fund_manager_change: fundManagerChange,
    benchmark_weekly: benchmarkWeekly,
    best_worst_fund_weekly: bestWorstFundWeekly,
    risk_reward_monthly: riskRewardMonthly,
    asset_allocation_drift: assetAllocationDrift,
    ltcg_boundary_30d: ltcgBoundary30d,
    ltcg_exemption_80pct: ltcgExemption80pct,
    tax_harvest_seasonal: taxHarvestSeasonal,
    elss_unlock_30d: elssUnlock30d,
    investor_profile: investorProfile,
    market_crash_behavioral: marketCrashBehavioral,
    sip_missed: sipMissed,
    portfolio_neglect: portfolioNeglect,
    too_many_funds: tooManyFunds,
};
