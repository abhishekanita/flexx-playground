export interface ShadowIndexResult {
    niftyRate: number; // CAGR used
    portfolioLevel: {
        actualValue: number;
        shadowValue: number;
        totalRedemptions: number;
        alpha: number; // actualValue + totalRedemptions - shadowValue
    };
    fundBreakdown: ShadowFund[];
    topAlphaGenerators: ShadowFund[]; // top 3 by alpha
    bottomAlphaGenerators: ShadowFund[]; // bottom 3 by alpha
}

export interface ShadowFund {
    schemeName: string;
    shortName: string;
    actualValue: number;
    shadowValue: number;
    alpha: number;
}
