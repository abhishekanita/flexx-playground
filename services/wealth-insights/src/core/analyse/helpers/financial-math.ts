/**
 * Financial math utilities: XIRR, XNPV, CAGR, volatility, Sharpe, drawdown.
 *
 * XIRR uses bisection method (same approach as Ashu's Python, lines 507-551).
 * All return values are in percentage (e.g., 12.5 means 12.5%).
 */

const MS_PER_YEAR = 365.2425 * 24 * 60 * 60 * 1000;

export type Cashflow = [Date, number]; // [date, amount]

/**
 * Net Present Value of irregular cashflows at a given annual rate.
 */
export function xnpv(rate: number, cashflows: Cashflow[]): number {
    if (cashflows.length === 0) return 0;

    const t0 = cashflows.reduce(
        (min, [d]) => (d.getTime() < min ? d.getTime() : min),
        cashflows[0][0].getTime(),
    );

    let total = 0;
    for (const [date, amount] of cashflows) {
        const years = (date.getTime() - t0) / MS_PER_YEAR;
        total += amount / Math.pow(1 + rate, years);
    }
    return total;
}

/**
 * Internal Rate of Return for irregular cashflows.
 * Uses bisection method with multiple bracket candidates.
 * Returns rate as a decimal (0.125 = 12.5%). Returns NaN if no solution found.
 */
export function xirr(cashflows: Cashflow[], maxIterations = 200, tolerance = 1e-9): number {
    if (cashflows.length < 2) return NaN;

    // Must have both positive and negative cashflows
    const hasPositive = cashflows.some(([, a]) => a > 0);
    const hasNegative = cashflows.some(([, a]) => a < 0);
    if (!hasPositive || !hasNegative) return NaN;

    const lo = -0.9999;
    const candidates = [0.0, 0.05, 0.1, 0.2, 0.3, 0.5, 0.8, 1.0, 2.0, 4.0, 8.0, 15.0];

    const npvLo = xnpv(lo, cashflows);

    for (const hi of candidates) {
        const npvHi = xnpv(hi, cashflows);

        // Need sign change for bisection to work
        if (npvLo * npvHi > 0) continue;

        let a = lo;
        let b = hi;
        let npvA = npvLo;

        for (let i = 0; i < maxIterations; i++) {
            const mid = (a + b) / 2;
            const npvMid = xnpv(mid, cashflows);

            if (Math.abs(npvMid) < tolerance) return mid;

            if (npvA * npvMid < 0) {
                b = mid;
            } else {
                a = mid;
                npvA = npvMid;
            }

            if (Math.abs(b - a) < tolerance) return (a + b) / 2;
        }

        return (a + b) / 2;
    }

    return NaN;
}

/**
 * Compound Annual Growth Rate.
 * Returns percentage (e.g., 12.5).
 */
export function cagr(startValue: number, endValue: number, years: number): number {
    if (startValue <= 0 || years <= 0) return 0;
    return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
}

/**
 * Annualized volatility from an array of daily returns.
 * Returns percentage (e.g., 15.2).
 */
export function volatility(dailyReturns: number[]): number {
    if (dailyReturns.length < 2) return 0;

    const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
    const variance =
        dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (dailyReturns.length - 1);
    const stdDev = Math.sqrt(variance);

    // Annualize: multiply by sqrt(252 trading days)
    return stdDev * Math.sqrt(252) * 100;
}

/**
 * Max drawdown from a price/NAV series.
 * Returns percentage as a negative number (e.g., -18.5).
 */
export function maxDrawdown(prices: number[]): number {
    if (prices.length < 2) return 0;

    let peak = prices[0];
    let worstDrawdown = 0;

    for (const price of prices) {
        if (price > peak) peak = price;
        const drawdown = (price / peak - 1) * 100;
        if (drawdown < worstDrawdown) worstDrawdown = drawdown;
    }

    return worstDrawdown;
}

/**
 * Max drawdown recovery: days from trough back to previous peak.
 * Returns null if not yet recovered.
 */
export function drawdownRecoveryDays(prices: number[], dates: Date[]): number | null {
    if (prices.length < 2) return null;

    let peak = prices[0];
    let peakIdx = 0;
    let troughIdx = 0;
    let worstDrawdown = 0;

    for (let i = 1; i < prices.length; i++) {
        if (prices[i] > peak) {
            peak = prices[i];
            peakIdx = i;
        }
        const dd = prices[i] / peak - 1;
        if (dd < worstDrawdown) {
            worstDrawdown = dd;
            troughIdx = i;
        }
    }

    // Find recovery point after trough
    for (let i = troughIdx + 1; i < prices.length; i++) {
        if (prices[i] >= prices[peakIdx]) {
            return Math.round(
                (dates[i].getTime() - dates[troughIdx].getTime()) / (24 * 60 * 60 * 1000),
            );
        }
    }

    return null; // not yet recovered
}

/**
 * Sharpe Ratio = (annualized return - risk-free rate) / annualized volatility.
 * All inputs as decimals (0.12 = 12%).
 */
export function sharpeRatio(
    annualizedReturn: number,
    riskFreeRate: number,
    annualizedVolatility: number,
): number {
    if (annualizedVolatility === 0) return 0;
    return (annualizedReturn - riskFreeRate) / annualizedVolatility;
}

/**
 * Sortino Ratio = (annualized return - risk-free rate) / downside deviation.
 * Downside deviation only considers negative daily returns (below target = 0).
 * All inputs as decimals (0.12 = 12%).
 */
export function sortinoRatio(
    annualizedReturn: number,
    riskFreeRate: number,
    dailyReturnsSeries: number[],
): number {
    const negativeReturns = dailyReturnsSeries.filter((r) => r < 0);
    if (negativeReturns.length === 0) return 0;

    const downsideVariance =
        negativeReturns.reduce((s, r) => s + r * r, 0) / dailyReturnsSeries.length;
    const downsideDev = Math.sqrt(downsideVariance) * Math.sqrt(252);

    if (downsideDev === 0) return 0;
    return (annualizedReturn - riskFreeRate) / downsideDev;
}

/**
 * Compute daily returns from a price series.
 */
export function dailyReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
        if (prices[i - 1] !== 0) {
            returns.push(prices[i] / prices[i - 1] - 1);
        }
    }
    return returns;
}

/**
 * Parse ISO date string ("YYYY-MM-DD") to Date object.
 */
export function parseDate(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
}

/**
 * Days between two dates.
 */
export function daysBetween(d1: Date, d2: Date): number {
    return Math.round(Math.abs(d2.getTime() - d1.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Iteratively solve for n months where:
 * PV*(1+r)^n + SIP*((1+r)^n - 1)/r >= target
 * Returns Infinity if not reached within maxMonths.
 */
export function solveMonthsToTarget(
    pv: number,
    sip: number,
    monthlyRate: number,
    target: number,
    maxMonths = 600,
): number {
    for (let n = 1; n <= maxMonths; n++) {
        const growthFactor = Math.pow(1 + monthlyRate, n);
        const fv = pv * growthFactor + sip * (growthFactor - 1) / monthlyRate;
        if (fv >= target) return n;
    }
    return Infinity;
}
