/**
 * Sector classifier: maps AMC-reported industry names to 11 broad sectors.
 * Uses keyword matching similar to Ashu's Python approach.
 */

export type BroadSector =
    | 'Financial Services'
    | 'Industrials'
    | 'Technology'
    | 'Consumer Discretionary'
    | 'Consumer Staples'
    | 'Healthcare'
    | 'Energy'
    | 'Materials'
    | 'Utilities'
    | 'Communication'
    | 'Real Estate'
    | 'Others';

const SECTOR_KEYWORDS: Record<BroadSector, string[]> = {
    'Financial Services': [
        'bank', 'finance', 'financial', 'insurance', 'nbfc', 'credit', 'lending',
        'housing finance', 'capital market', 'brokerage', 'asset management',
        'wealth management', 'microfinance', 'fintech', 'payment',
    ],
    'Technology': [
        'software', 'it ', 'information technology', 'tech', 'computer',
        'digital', 'cloud', 'saas', 'internet', 'e-commerce', 'ecommerce',
        'artificial intelligence', 'semiconductor', 'data processing',
    ],
    'Consumer Discretionary': [
        'auto', 'automobile', 'consumer durable', 'retail', 'textile',
        'apparel', 'hotel', 'hospitality', 'leisure', 'entertainment',
        'media', 'restaurant', 'jewellery', 'luxury', 'travel', 'tourism',
        'e-commerce', 'discretionary',
    ],
    'Consumer Staples': [
        'fmcg', 'food', 'beverage', 'personal care', 'household',
        'consumer non-durable', 'staple', 'dairy', 'tobacco', 'agri',
        'agriculture', 'edible oil', 'packaged',
    ],
    'Healthcare': [
        'pharma', 'pharmaceutical', 'healthcare', 'hospital', 'diagnostic',
        'medical', 'biotech', 'drug', 'health', 'api', 'formulation',
    ],
    'Industrials': [
        'industrial', 'capital goods', 'engineering', 'construction',
        'infrastructure', 'defence', 'defense', 'aerospace', 'manufacturing',
        'machinery', 'equipment', 'logistics', 'transport', 'shipping',
        'port', 'railway', 'road', 'cement', 'building material',
    ],
    'Energy': [
        'oil', 'gas', 'petroleum', 'energy', 'power', 'electricity',
        'renewable', 'solar', 'wind', 'refinery', 'fuel', 'coal', 'mining',
    ],
    'Materials': [
        'metal', 'steel', 'aluminium', 'copper', 'iron', 'chemical',
        'material', 'paper', 'packaging', 'plastic', 'glass', 'mineral',
        'fertilizer', 'pigment', 'specialty chemical',
    ],
    'Utilities': [
        'utility', 'water', 'waste', 'sanitation', 'municipal',
        'electric utility', 'gas distribution',
    ],
    'Communication': [
        'telecom', 'communication', 'broadcasting', 'cable', 'satellite',
        'tower', 'network', 'spectrum',
    ],
    'Real Estate': [
        'real estate', 'realty', 'property', 'housing', 'reit',
        'construction material',
    ],
    'Others': [],
};

// Pre-compute a lookup array for efficiency
const SECTOR_RULES: { sector: BroadSector; keywords: string[] }[] = Object.entries(SECTOR_KEYWORDS)
    .filter(([sector]) => sector !== 'Others')
    .map(([sector, keywords]) => ({
        sector: sector as BroadSector,
        keywords,
    }));

/**
 * Classify an industry string into one of 11 broad sectors.
 */
export function classifySector(industry: string): BroadSector {
    if (!industry) return 'Others';

    const lower = industry.toLowerCase().trim();

    for (const rule of SECTOR_RULES) {
        for (const keyword of rule.keywords) {
            if (lower.includes(keyword)) {
                return rule.sector;
            }
        }
    }

    return 'Others';
}

/**
 * Get all broad sector names.
 */
export function getAllSectors(): BroadSector[] {
    return Object.keys(SECTOR_KEYWORDS) as BroadSector[];
}
