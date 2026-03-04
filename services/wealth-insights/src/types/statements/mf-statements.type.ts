import { MFStatementCategory } from './mf-statements.enum';

type TransactionType =
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

type TransactionChannel = 'BSE' | 'NSE' | 'AMC Direct' | 'RTA' | 'Online' | 'Demat' | string;

export interface MFDetailedStatementData {
    documentId: string;
    version: string;
    statementPeriod: { from: string; to: string };
    investor: {
        name: string;
        email: string;
        address: string;
        mobile: string;
        pan: string;
        guardianName?: string;
    };
    portfolioSummary: {
        fundHouse: string;
        costValue: number;
        marketValue: number;
    }[];
    totalCostValue: number;
    totalMarketValue: number;
    folios: {
        fundHouse: string;
        folioNumber: string;
        scheme: {
            schemeName: string;
            scheme_code: string; // e.g. "P8042"
            isin: string; // e.g. "INF109K016L0"
            current_name: string;
            plan: 'Direct' | 'Regular';
            option: 'Growth' | 'Dividend - Payout' | 'Dividend - Reinvestment' | 'IDCW - Payout' | 'IDCW - Reinvestment';
            dematStatus: 'Demat' | 'Non-Demat';
            registrar: 'CAMS' | 'KFINTECH';
            loadDetails: string | null;
            advisor: string;
        };
        investor: {
            holderName: string;
            pan: string;
            nominees: string[];
            kycOk: boolean;
            panOk: boolean;
        };
        openingUnitBalance: number;
        closingUnitBalance: number;
        snapshot: {
            navDate: string;
            nav: number;
            totalCostValue: number;
            marketValue: number;
        };
        transactions: {
            date: string; // ISO date string "YYYY-MM-DD"
            type: TransactionType;
            channel?: TransactionChannel | null; // e.g. "BSE", "NSE"
            advisorCode?: string | null; // e.g. "INZ000208032"
            amount: number | null; // in INR; null for unit-only txns
            nav: number | null; // NAV at transaction date
            units: number; // positive = credit, negative = debit
            unitBalanceAfter: number; // running balance after this txn
            stampDuty: number | null; // absorbed from the
        }[];
        stampDutyTotal: number;
        loadInfo: string;
    }[];
}
