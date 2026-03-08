// Zerodha Weekly Securities Statement PDF parser
// Extracts: ledger code, period, security transactions (delivered/received/balance)

export interface ZerodhaEquityTransaction {
    transactionDate: string;
    executionDate: string;
    segment: string;
    clientName: string;
    clientPan: string;
    dematAccountNo: string;
    settlementNo: string;
    isin: string;
    scripName: string;
    qtyDelivered: number;
    qtyReceived: number;
    balance: number;
    transactionType: string;
    purpose: string;
}

export interface ZerodhaEquityStatement {
    ledgerCode: string;
    fromDate: string;
    toDate: string;
    transactions: ZerodhaEquityTransaction[];
    pendingObligations: ZerodhaEquityTransaction[];
    hasData: boolean;
}

export function parseZerodhaEquityStatement(text: string): ZerodhaEquityStatement {
    const result: ZerodhaEquityStatement = {
        ledgerCode: '',
        fromDate: '',
        toDate: '',
        transactions: [],
        pendingObligations: [],
        hasData: false,
    };

    const ledgerMatch = text.match(/Ledger Code:\s*(\w+)/);
    if (ledgerMatch) result.ledgerCode = ledgerMatch[1];

    const fromMatch = text.match(/From Date:\s*(\d{4}-\d{2}-\d{2})/);
    if (fromMatch) result.fromDate = fromMatch[1];

    const toMatch = text.match(/To Date:\s*(\d{4}-\d{2}-\d{2})/);
    if (toMatch) result.toDate = toMatch[1];

    // Check if statement has actual data or just "NA" rows
    result.hasData = !text.includes('NA \tNA \tNA \tNA NA NA NA');

    return result;
}
