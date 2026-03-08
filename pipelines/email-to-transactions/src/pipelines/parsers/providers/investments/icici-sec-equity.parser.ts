// ICICI Securities Equity Transaction Statement PDF parser
// Extracts: equity buy/sell trades with full details

export interface IciciSecTrade {
    contractNumber: string;
    settlementNo: string;
    exchange: string;
    tradeNo: string;
    orderDate: string; // YYYY-MM-DD
    orderTime: string;
    tradeDate: string; // YYYY-MM-DD
    tradeTime: string;
    settlementDate: string; // YYYY-MM-DD
    security: string;
    isin: string;
    buySell: 'B' | 'S';
    quantity: number;
    total: number;           // Total amount incl. brokerage+GST
    brokerage: number;       // Brokerage (total)
    grossAmount: number;     // Gross Rate * Quantity
    gst: number;             // GST on brokerage
    ratePerSecurity: number; // Price per unit
}

export interface IciciSecSummary {
    contractNumber: string;
    contractDate: string; // YYYY-MM-DD
    settlementNo: string;
    settlementDate: string; // YYYY-MM-DD
    stt: number;
    transactionCharges: number;
    stampDuty: number;
    netDescription: string;
    netTotal: number;
}

export interface IciciSecStatement {
    clientCode: string;
    tradingCode: string;
    pan: string;
    statementPeriod: string;
    trades: IciciSecTrade[];
    summary: IciciSecSummary[];
}

function parseDate(s: string): string {
    const m = s.match(/(\d{2})-(\d{2})-(\d{4})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return s;
}

function parseAmount(s: string): number {
    return parseFloat(s.replace(/[,\s]/g, '')) || 0;
}

export function parseIciciSecEquity(text: string): IciciSecStatement {
    const result: IciciSecStatement = {
        clientCode: '',
        tradingCode: '',
        pan: '',
        statementPeriod: '',
        trades: [],
        summary: [],
    };

    // Client code - appears after "UNIQUE CLIENT CODE :" followed by the number
    const clientMatch = text.match(/UNIQUE CLIENT CODE\s*:\s*\n?\s*(?:TRADING CODE NO\s*:\s*\n?\s*(?:PAN\s*:\s*\n?\s*)?)?([\d]+)/);
    if (clientMatch) result.clientCode = clientMatch[1];
    // Fallback
    if (!result.clientCode) {
        const cm = text.match(/(\d{10})\n\1/);
        if (cm) result.clientCode = cm[1];
    }

    // PAN
    const panMatch = text.match(/([A-Z]{5}\d{4}[A-Z])/);
    if (panMatch) result.pan = panMatch[1];

    // Statement period
    const periodMatch = text.match(/Equity Transaction Statement from\s+(.+)/);
    if (periodMatch) result.statementPeriod = periodMatch[1].trim();

    // Parse trades - line-by-line approach — handles multi-line security names
    {
        const lines = text.split('\n');
        let i = 0;
        while (i < lines.length) {
            const line = lines[i];
            if (!line.startsWith('ISEC/')) { i++; continue; }

            // Collect lines until we see an ISIN at the end of a tab-separated line
            let block = line;
            let j = i + 1;
            while (j < lines.length && !block.match(/IN[EF]\w+\s*$/)) {
                block += '\n' + lines[j];
                j++;
                if (j - i > 8) break; // Safety limit
            }

            // Parse: look for key components
            const isinMatch = block.match(/(IN[EF]\w+)\s*$/);
            const dateMatch = block.match(/(\d{2}-\d{2}-\d{4})\s*\n?\s*\d{2}:\d{2}:\d{2}/);
            const tradeDateMatch = block.match(/\d+\s+(\d{2}-\d{2}-\d{4})\s*\n?\s*(\d{2}:\d{2})\s+(\d{2}-\d{2}-\d{4})/);
            const bsMatch = block.match(/\b(B|S)\s+(\d+)\s+([\d.]+)\t([\d.]+)\t([\d.]+)\s+([\d.]+)\t([\d.]+)/);

            // Security name: between the 3rd date (settlement date) and B/S
            let security = '';
            const flatBlock = block.replace(/\n/g, ' ');
            // Match: ...HH:MM DD-MM-YYYY SECURITY_NAME B/S qty
            const secMatch = flatBlock.match(/\d{2}:\d{2}\s+\d{2}-\d{2}-\d{4}\s+(.+?)\s+(?:B|S)\s+\d+/);
            if (secMatch) security = secMatch[1].replace(/\s+/g, ' ').trim();

            if (isinMatch && bsMatch) {
                result.trades.push({
                    contractNumber: line.match(/ISEC\/\S+/)?.[0] || '',
                    settlementNo: '',
                    exchange: block.match(/\b(NSE|BSE)\b/)?.[1] || '',
                    tradeNo: '',
                    orderDate: dateMatch ? parseDate(dateMatch[1]) : '',
                    orderTime: '',
                    tradeDate: tradeDateMatch ? parseDate(tradeDateMatch[1]) : '',
                    tradeTime: tradeDateMatch?.[2] || '',
                    settlementDate: tradeDateMatch ? parseDate(tradeDateMatch[3]) : '',
                    security,
                    isin: isinMatch[1],
                    buySell: bsMatch[1] as 'B' | 'S',
                    quantity: parseInt(bsMatch[2]),
                    total: parseAmount(bsMatch[3]),
                    brokerage: parseAmount(bsMatch[4]),
                    grossAmount: parseAmount(bsMatch[5]),
                    gst: parseAmount(bsMatch[6]),
                    ratePerSecurity: parseAmount(bsMatch[7]),
                });
            }

            i = j;
        }
    }

    // Parse summary section
    const summaryRegex = /(\d{2}-\d{2}-\d{4})\s+(ISEC\/\S+)\s+(\d+)\s+(\d{2}-\d{2}-\d{4})\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+(.+?Rs\.\s*[\d,.]+)/g;
    let sumMatch;
    while ((sumMatch = summaryRegex.exec(text)) !== null) {
        const netMatch = sumMatch[8].match(/Rs\.\s*([\d,.]+)/);
        result.summary.push({
            contractDate: parseDate(sumMatch[1]),
            contractNumber: sumMatch[2],
            settlementNo: sumMatch[3],
            settlementDate: parseDate(sumMatch[4]),
            stt: parseAmount(sumMatch[5]),
            transactionCharges: parseAmount(sumMatch[6]),
            stampDuty: parseAmount(sumMatch[7]),
            netDescription: sumMatch[8].replace(/Rs\.\s*[\d,.]+/, '').trim(),
            netTotal: netMatch ? parseAmount(netMatch[1]) : 0,
        });
    }

    return result;
}
