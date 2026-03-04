export interface MFUserFolio {
    pan: string;
    email: string;
    folioNumber: string;
    fundHouse: string;
    scheme: {
        schemeName: string;
        schemeCode: string;
        isin: string;
        currentName: string;
        plan: 'Direct' | 'Regular';
        option: string;
        dematStatus: string;
        registrar: 'CAMS' | 'KFINTECH';
        advisor: string;
    };
    investor: {
        holderName: string;
        nominees: string[];
        kycOk: boolean;
        panOk: boolean;
    };
    openingUnitBalance: number;
    closingUnitBalance: number;
    snapshot: {
        navDate: string;
        nav: number;
        costValue: number;
        marketValue: number;
    };
    status: 'active' | 'closed';
    stampDutyTotal: number;
    transactionCount: number;
    firstTransactionDate: string;
    lastTransactionDate: string;
    lastSyncedAt: Date;
}
