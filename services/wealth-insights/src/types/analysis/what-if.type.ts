export interface WhatIfResult {
    scenarios: WhatIfScenario[];
}

export interface WhatIfScenario {
    id: string;
    name: string;
    description: string;
    relevanceScore: number; // 0-100

    actual: {
        totalInvested: number;
        currentValue: number;
        xirr: number;
    };

    hypothetical: {
        totalInvested: number;
        hypotheticalValue: number;
        hypotheticalXirr: number;
    };

    difference: {
        absoluteAmount: number;
        percentageDifference: number;
        userDidBetter: boolean;
    };

    dataPointsForNarrative: Record<string, string | number>;
}

export type WhatIfScenarioId =
    | 'SIP_VS_LUMPSUM'
    | 'DIRECT_VS_REGULAR'
    | 'INDEX_FUND_ALT'
    | 'TOP_FUND_IN_CATEGORY'
    | 'WORST_FUND_REMOVED'
    | 'STARTED_EARLIER'
    | 'IF_REBALANCED'
    | 'IF_BOUGHT_STOCKS'
    | 'FD_VS_MF'
    | 'INFLATION_ADJUSTED'
    | 'COFFEE_MONEY_SIP'
    | 'CROREPATI_COUNTDOWN'
    | 'INFLATION_EROSION'
    | 'PPF_COMPARISON'
    | 'EMI_REDIRECT';
