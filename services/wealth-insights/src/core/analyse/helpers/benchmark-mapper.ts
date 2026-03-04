/**
 * Maps mutual fund scheme names/categories to appropriate benchmark indices.
 * Uses scheme category from AMFI data + scheme name keywords.
 */

export interface BenchmarkMapping {
    ticker: string;
    name: string;
}

// AMFI category → benchmark mappings
const CATEGORY_BENCHMARKS: Record<string, BenchmarkMapping> = {
    // Equity - Large Cap
    'large cap': { ticker: '^NSEI', name: 'Nifty 50' },
    'large cap fund': { ticker: '^NSEI', name: 'Nifty 50' },

    // Equity - Large & Mid Cap
    'large & mid cap': { ticker: '^CRSLDX', name: 'Nifty 500' },
    'large and mid cap': { ticker: '^CRSLDX', name: 'Nifty 500' },

    // Equity - Mid Cap
    'mid cap': { ticker: '0P0000XVKP.BO', name: 'Nifty Midcap 150' },
    'mid cap fund': { ticker: '0P0000XVKP.BO', name: 'Nifty Midcap 150' },

    // Equity - Small Cap
    'small cap': { ticker: '0P0001BAV4.BO', name: 'Nifty Smallcap 250' },
    'small cap fund': { ticker: '0P0001BAV4.BO', name: 'Nifty Smallcap 250' },

    // Equity - Multi Cap / Flexi Cap
    'multi cap': { ticker: '^CRSLDX', name: 'Nifty 500' },
    'flexi cap': { ticker: '^CRSLDX', name: 'Nifty 500' },

    // Equity - ELSS / Tax Saver
    'elss': { ticker: '^NSEI', name: 'Nifty 50' },

    // Equity - Sectoral/Thematic
    'sectoral': { ticker: '^NSEI', name: 'Nifty 50' },
    'thematic': { ticker: '^NSEI', name: 'Nifty 50' },

    // Equity - Index Fund
    'index': { ticker: '^NSEI', name: 'Nifty 50' },

    // Equity - Value / Contra / Focused
    'value': { ticker: '^CRSLDX', name: 'Nifty 500' },
    'contra': { ticker: '^CRSLDX', name: 'Nifty 500' },
    'focused': { ticker: '^NSEI', name: 'Nifty 50' },

    // Hybrid
    'aggressive hybrid': { ticker: '^NSEI', name: 'Nifty 50' },
    'balanced advantage': { ticker: '^NSEI', name: 'Nifty 50' },
    'equity savings': { ticker: '^NSEI', name: 'Nifty 50' },

    // Default equity
    'equity': { ticker: '^CRSLDX', name: 'Nifty 500' },
};

// Scheme name keyword → benchmark overrides
// ORDER MATTERS: more specific rules must come before general ones.
// E.g., "large and midcap" must appear BEFORE "midcap" to prevent
// "Motilal Oswal Large and Midcap Fund" from matching the midcap rule.
const NAME_KEYWORD_BENCHMARKS: { keywords: string[]; benchmark: BenchmarkMapping }[] = [
    // ── Specific index funds (match first) ──
    {
        keywords: ['nifty next 50', 'nifty next50'],
        benchmark: { ticker: '^NSMIDCP', name: 'Nifty Next 50' },
    },
    {
        keywords: ['nifty 50', 'nifty50'],
        benchmark: { ticker: '^NSEI', name: 'Nifty 50' },
    },
    {
        keywords: ['nifty 500'],
        benchmark: { ticker: '^CRSLDX', name: 'Nifty 500' },
    },
    {
        keywords: ['sensex', 'bse 30'],
        benchmark: { ticker: '^BSESN', name: 'BSE Sensex' },
    },
    {
        keywords: ['s&p 500', 's and p 500', 'sp500'],
        benchmark: { ticker: '^GSPC', name: 'S&P 500' },
    },
    {
        keywords: ['nasdaq'],
        benchmark: { ticker: '^IXIC', name: 'NASDAQ Composite' },
    },

    // ── Multi-word cap categories (before individual cap keywords) ──
    {
        keywords: ['large and midcap', 'large & midcap', 'large and mid cap', 'large & mid cap'],
        benchmark: { ticker: '^CRSLDX', name: 'Nifty 500' },
    },

    // ── Single cap categories ──
    {
        keywords: ['midcap', 'mid cap', 'mid-cap'],
        benchmark: { ticker: '0P0000XVKP.BO', name: 'Nifty Midcap 150' },
    },
    {
        keywords: ['smallcap', 'small cap', 'small-cap'],
        benchmark: { ticker: '0P0001BAV4.BO', name: 'Nifty Smallcap 250' },
    },

    // ── Sectoral / Thematic ──
    {
        keywords: ['infrastructure', 'infra'],
        benchmark: { ticker: '^CNXINFRA', name: 'Nifty Infrastructure' },
    },
    {
        keywords: ['banking', 'bank', 'financial'],
        benchmark: { ticker: '^NSEBANK', name: 'Nifty Bank' },
    },
    {
        keywords: ['pharma', 'healthcare'],
        benchmark: { ticker: '^CNXPHARMA', name: 'Nifty Pharma' },
    },
    {
        keywords: ['technology', 'it ', 'digital'],
        benchmark: { ticker: '^CNXIT', name: 'Nifty IT' },
    },
    {
        keywords: ['commodit'],
        benchmark: { ticker: '^NSEI', name: 'Nifty 50' },
    },

    // ── Asset class ──
    {
        keywords: ['gold', 'gold etf'],
        benchmark: { ticker: 'GC=F', name: 'Gold Futures' },
    },
    {
        keywords: ['international', 'global', 'us equity'],
        benchmark: { ticker: '^GSPC', name: 'S&P 500' },
    },
];

/**
 * Map a scheme to its most appropriate benchmark.
 * Priority: scheme name keywords > AMFI category > fallback (Nifty 500).
 */
export function mapSchemeToBenchmark(
    schemeName: string,
    category?: string,
): BenchmarkMapping {
    const lowerName = schemeName.toLowerCase();

    // 1. Check scheme name keywords first (most specific)
    for (const rule of NAME_KEYWORD_BENCHMARKS) {
        if (rule.keywords.some((kw) => lowerName.includes(kw))) {
            return rule.benchmark;
        }
    }

    // 2. Check AMFI category
    if (category) {
        const lowerCat = category.toLowerCase();
        for (const [key, benchmark] of Object.entries(CATEGORY_BENCHMARKS)) {
            if (lowerCat.includes(key)) {
                return benchmark;
            }
        }
    }

    // 3. Fallback to Nifty 500
    return { ticker: '^CRSLDX', name: 'Nifty 500' };
}

/**
 * Get all unique benchmark tickers needed for a set of scheme mappings.
 */
export function getUniqueBenchmarkTickers(
    mappings: BenchmarkMapping[],
): BenchmarkMapping[] {
    const seen = new Set<string>();
    const unique: BenchmarkMapping[] = [];
    for (const m of mappings) {
        if (!seen.has(m.ticker)) {
            seen.add(m.ticker);
            unique.push(m);
        }
    }
    return unique;
}
