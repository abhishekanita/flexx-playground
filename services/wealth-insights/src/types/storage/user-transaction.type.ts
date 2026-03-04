export type TransactionType =
    | 'Purchase'
    | 'Redemption'
    | 'SIP'
    | 'SIP Redemption'
    | 'Switch In'
    | 'Switch Out'
    | 'STP In'
    | 'STP Out'
    | 'SWP'
    | 'Dividend Reinvestment'
    | 'Dividend Payout'
    | 'NFO Allotment'
    | 'Bonus'
    | 'Merger'
    | 'Stamp Duty';

export interface MFUserTransaction {
    pan: string;
    email: string;
    folioNumber: string;
    schemeName: string;
    isin: string;
    date: string;
    type: TransactionType;
    channel: string | null;
    advisorCode: string | null;
    amount: number | null;
    nav: number | null;
    units: number;
    unitBalanceAfter: number;
    stampDuty: number | null;
    dedupKey: string;
}
