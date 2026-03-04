// ─── Fund Holdings (from AMC portfolio disclosures) ─────────────────────────

export interface FundHolding {
    sourceKey: string;
    section: 'equity' | 'debt' | 'others';
    instrument: string;
    isin: string;
    industry: string;
    pctOfNAV: number;
    marketValueLakhs: number | null;
}

export interface FundHoldingsSource {
    sourceKey: string;
    amc: string;
    schemeName: string;
    schemeKeywords: string[];
    holdings: FundHolding[];
    assetTotals: { equity: number; debt: number; others: number };
    fetchedAt: Date;
}

// ─── Market Cap Lookup ──────────────────────────────────────────────────────

export interface MarketCapLookup {
    isin: string;
    instrument: string;
    yahooSymbol: string | null;
    marketCap: number | null;
    country: string | null;
    bucket: 'Large Cap' | 'Mid Cap' | 'Small Cap' | 'Global Equity' | 'Unclassified';
    resolvedAt: Date;
}

// ─── Benchmark Data ─────────────────────────────────────────────────────────

export interface BenchmarkDataPoint {
    date: string;
    close: number;
}

export interface BenchmarkStats {
    ticker: string;
    name: string;
    startDate: string;
    endDate: string;
    totalReturn: number;
    cagr: number;
    volatility: number;
    maxDrawdown: number;
    prices: BenchmarkDataPoint[];
}

// ─── NAV History ────────────────────────────────────────────────────────────

export interface NAVDataPoint {
    date: string; // "DD-MM-YYYY" from mfapi.in
    nav: number;
}

export interface SchemeNAVHistory {
    schemeCode: number;
    schemeName: string;
    isinGrowth: string;         // from meta.isin_growth
    isinDivReinvestment: string; // from meta.isin_div_reinvestment
    fundHouse: string;
    schemeType: string;          // "Open Ended Schemes"
    schemeCategory: string;      // "Debt Scheme - Banking and PSU Fund"
    navHistory: NAVDataPoint[];
    fetchedAt: Date;
}

// ─── Fund Metadata (from mf.captnemo.in / Kuvera) ──────────────────────────
// Actual Kuvera API response fields based on real data

export interface FundMetadata {
    code: string;                        // e.g. "BS297GZ-GR"
    isin: string;                        // e.g. "INF209K01WS3"
    name: string;                        // Full name: "Aditya Birla Sun Life International Equity Growth Direct Plan"
    shortName: string;                   // e.g. "ABSL International Equity"
    fundHouse: string;                   // e.g. "Aditya Birla Sun Life Mutual Fund" (from fund_name)
    fundHouseCode: string;               // e.g. "BirlaSunLifeMutualFund_MF" (from fund_house)
    category: string;                    // High-level: "Equity", "Debt", "Hybrid"
    fundCategory: string;                // Specific: "Fund of Funds", "Large Cap Fund", etc.
    fundType: string;                    // e.g. "Others", "Equity"
    plan: string;                        // "GROWTH" | "DIVIDEND" | "IDCW" (NOT Direct/Regular)
    isDirect: boolean;                   // from direct field: "Y" → true
    expenseRatio: number | null;         // e.g. 2.06 (parsed from string "2.06")
    expenseRatioDate: string | null;     // e.g. "2026-01-31"
    fundManager: string | null;          // e.g. "Dhaval Joshi"
    crisilRating: string | null;         // Text: "Very High Risk", NOT a number
    investmentObjective: string | null;
    portfolioTurnover: number | null;    // e.g. 1.48
    maturityType: string | null;         // "Open Ended" | "Close Ended"
    aum: number | null;                  // in lakhs (e.g. 3032 = 30.32 Cr)
    nav: { nav: number; date: string } | null; // Latest NAV
    returns: {
        week1?: number;                  // "week_1" from API
        year1?: number;                  // "year_1"
        year3?: number;                  // "year_3"
        year5?: number;                  // "year_5"
        inception?: number;              // "inception"
    };
    volatility: number | null;           // e.g. 14.4457
    lockInPeriod: number | null;         // days (0 for no lock-in)
    taxPeriod: number | null;            // days for LTCG classification (365 for equity)
    sipMin: number | null;
    sipMax: number | null;
    lumpMin: number | null;
    lumpMax: number | null;
    startDate: string | null;            // Fund inception date "YYYY-MM-DD"
    tags: string[];                      // e.g. ["international_funds"]
    switchAllowed: boolean;
    stpAllowed: boolean;
    swpAllowed: boolean;
    redemptionAllowed: boolean;
    comparison: FundComparison[];        // Peer comparison data
    fetchedAt: Date;
}

export interface FundComparison {
    name: string;
    shortName: string;
    code: string;
    year1: number | null;
    year3: number | null;
    year5: number | null;
    inception: number | null;
    volatility: number | null;
    expenseRatio: number | null;
    aum: number | null;
    infoRatio: number | null;            // Information ratio
}

// ─── Macro / Inflation Data ─────────────────────────────────────────────────

export interface MacroData {
    cpiInflationAnnual: number; // latest annual CPI %
    tBill91DayYield: number; // risk-free rate proxy
    rbiRepoRate: number;
    asOfDate: string;
    fetchedAt: Date;
}

// ─── AMFI Master Data ───────────────────────────────────────────────────────

export interface AMFIScheme {
    schemeCode: number;
    isinDivPayoutOrGrowth: string;  // Col 2: "ISIN Div Payout/ ISIN Growth" (or "-" if absent)
    isinDivReinvestment: string;     // Col 3: "ISIN Div Reinvestment" (or "-" if absent)
    schemeName: string;              // Col 4
    nav: number;                     // Col 5
    navDate: string;                 // Col 6: "DD-MMM-YYYY" format e.g. "27-Feb-2026"
    schemeType: string;              // Section header: "Open Ended Schemes"
    schemeCategory: string;          // Parenthetical: "Debt Scheme - Banking and PSU Fund"
    fundHouse: string;               // AMC name line
}
