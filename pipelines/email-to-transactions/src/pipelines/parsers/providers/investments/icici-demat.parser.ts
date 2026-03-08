// ICICI Bank Demat Statement PDF parser (stub — format TBD after PDF extraction)

export interface IciciDematStatement {
    dpId: string;
    clientId: string;
    statementPeriod: string;
    holdings: Array<{
        isin: string;
        name: string;
        quantity: number;
    }>;
    transactions: Array<{
        date: string;
        description: string;
        isin: string;
        debit: number;
        credit: number;
        balance: number;
    }>;
}

export function parseIciciDematStatement(text: string): IciciDematStatement {
    const result: IciciDematStatement = {
        dpId: '',
        clientId: '',
        statementPeriod: '',
        holdings: [],
        transactions: [],
    };

    const dpMatch = text.match(/DP\s*(?:ID|Id)\s*:?\s*(IN\d+)/);
    if (dpMatch) result.dpId = dpMatch[1];

    const clientMatch = text.match(/Client\s*(?:ID|Id)\s*:?\s*(\d+)/);
    if (clientMatch) result.clientId = clientMatch[1];

    const periodMatch = text.match(/(?:Statement|Period).*?(\w+\s+\d{4})/i);
    if (periodMatch) result.statementPeriod = periodMatch[1];

    return result;
}
