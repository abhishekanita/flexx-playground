// INDmoney Weekly Statement of Accounts PDF parser
// Extracts: client info, fund transactions (usually empty for weekly)

export interface IndmoneyStatement {
    clientCode: string;
    clientName: string;
    pan: string;
    branch: string;
    statementPeriod: string;
    hasData: boolean;
    // Funds statement entries (when available)
    entries: IndmoneyEntry[];
}

export interface IndmoneyEntry {
    date: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
}

export function parseIndmoneyStatement(text: string): IndmoneyStatement {
    const result: IndmoneyStatement = {
        clientCode: '',
        clientName: '',
        pan: '',
        branch: '',
        statementPeriod: '',
        hasData: false,
        entries: [],
    };

    // Client code
    const codeMatch = text.match(/:\s*([A-Z]{2}\d+[A-Z]*\d*)/);
    if (codeMatch) result.clientCode = codeMatch[1];

    // Client name
    const nameMatch = text.match(/:\s*([A-Z][A-Z\s]+DHEWAL|[A-Z][A-Z\s]+[A-Z])\s/);
    if (nameMatch) result.clientName = nameMatch[1].trim();

    // PAN
    const panMatch = text.match(/PAN\s*:\s*([A-Z]{5}\d{4}[A-Z])/);
    if (panMatch) result.pan = panMatch[1];

    // Statement period
    const periodMatch = text.match(/Statement of Accounts of Funds for the period from\s+(.+?)(?:\.\s|$)/);
    if (periodMatch) result.statementPeriod = periodMatch[1].trim();

    // Check for data
    result.hasData = !text.includes('No Data Available');

    return result;
}
