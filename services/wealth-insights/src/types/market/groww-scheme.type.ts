export interface GrowwSchemeReturns {
	ret1d?: number;
	ret1w?: number;
	ret1m?: number;
	ret3m?: number;
	ret6m?: number;
	ret1y?: number;
	ret3y?: number;
	ret5y?: number;
	ret7y?: number;
	ret10y?: number;
	retSinceCreated?: number;
}

export interface GrowwSIPReturns {
	sip3m?: number;
	sip6m?: number;
	sip1y?: number;
	sip3y?: number;
	sip5y?: number;
	sip10y?: number;
}

export interface GrowwRiskStats {
	sharpe?: number;
	beta?: number;
	stdDev?: number;
	alpha?: number;
	sortino?: number;
	infoRatio?: number;
	meanReturn?: number;
}

export interface GrowwHolding {
	company?: string;
	sector?: string;
	instrument?: string;
	rating?: string;
	corpusPer?: number;
	marketValue?: number;
}

export interface GrowwFundManager {
	name?: string;
	education?: string;
	experience?: string;
	dateFrom?: string;
}

export interface GrowwCategoryRank {
	category?: string;
	rank?: number;
	totalFunds?: number;
}

export interface GrowwCategoryAvgReturn {
	period?: string;
	categoryAvg?: number;
	schemeReturn?: number;
}

export interface GrowwExpenseHistoryEntry {
	date?: string;
	expenseRatio?: number;
}

export interface GrowwScheme {
	// Core identifiers (from light sync)
	searchId: string;
	schemeName: string;
	fundHouse: string;
	category?: string;
	subCategory?: string;
	schemeType?: string;
	plan?: string;
	logoUrl?: string;

	// NAV and AUM (from light sync)
	nav?: number;
	navDate?: string;
	aum?: number;

	// Returns (from light sync, enriched by deep sync)
	returns?: GrowwSchemeReturns;

	// Rating
	growwRating?: number;
	crisilRating?: number;

	// Minimum investment
	minSipAmount?: number;
	minLumpsum?: number;

	// Deep sync fields (nullable until deep-synced)
	isin?: string | null;
	benchmarkName?: string | null;
	exitLoad?: string | null;
	stampDuty?: string | null;
	expenseRatio?: number | null;
	fundManagerDetails?: GrowwFundManager[] | null;
	holdings?: GrowwHolding[] | null;
	riskStats?: GrowwRiskStats | null;
	sipReturns?: GrowwSIPReturns | null;
	categoryRank?: GrowwCategoryRank | null;
	categoryAvgReturns?: GrowwCategoryAvgReturn[] | null;
	expenseHistory?: GrowwExpenseHistoryEntry[] | null;
	launchDate?: string | null;
	lockInPeriod?: string | null;

	// Sync metadata
	lastLightSyncAt?: Date;
	lastDeepSyncAt?: Date | null;
	deepSyncFailed?: boolean;
	deepSyncError?: string | null;
}
