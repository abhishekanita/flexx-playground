export interface MFUserSnapshot {
    pan: string;
    investor: {
        name: string;
        email: string;
        pan: string;
    };
    statementPeriod: { from: string; to: string };
    summary: {
        totalCostValue: number;
        totalMarketValue: number;
        totalUnrealisedGain: number;
        totalUnrealisedGainPct: number;
        activeFolioCount: number;
        closedFolioCount: number;
        totalInvested: number;
        totalWithdrawn: number;
        lifetimePnL: number;
        lifetimePnLPct: number;
    };
    holdings: SnapshotHolding[];
    fundHouseSummary: SnapshotFundHouse[];
    lastSyncedAt: Date;
    syncCount: number;
}

export interface SnapshotHolding {
    folioNumber: string;
    fundHouse: string;
    schemeName: string;
    isin: string;
    plan: 'Direct' | 'Regular';
    nav: number;
    navDate: string;
    units: number;
    costValue: number;
    marketValue: number;
    unrealisedGain: number;
    unrealisedGainPct: number;
    weight: number;
    firstTransactionDate: string;
    lastTransactionDate: string;
    holdingDays: number;
    hasNominee: boolean;
}

export interface SnapshotFundHouse {
    fundHouse: string;
    costValue: number;
    marketValue: number;
    gain: number;
    gainPct: number;
    weight: number;
}
