// NSE Funds & Securities Balance PDF parser
// Same format as BSE — reuses similar structure

export interface NseFundsBalance {
    clientCode: string;
    broker: string;
    reportDate: string;
    fundsBalance: number;
    securitiesCount: number;
    securitiesQty: number;
    securities: Array<{ isin: string; name: string; quantity: number }>;
}

function parseAmount(s: string): number {
    return parseFloat(s.replace(/[,\s]/g, '')) || 0;
}

export function parseNseFundsBalance(text: string): NseFundsBalance {
    const result: NseFundsBalance = {
        clientCode: '',
        broker: '',
        reportDate: '',
        fundsBalance: 0,
        securitiesCount: 0,
        securitiesQty: 0,
        securities: [],
    };

    const brokerMatch = text.match(/Trading Member\s+(.+?)\s+has reported/i);
    if (brokerMatch) result.broker = brokerMatch[1].trim();

    const dateMatch = text.match(/as on\s+(\d{2}\/\d{2}\/\d{4})/);
    if (dateMatch) result.reportDate = dateMatch[1];

    // Summary row: clientCode fundsBalance totalIsins totalQty
    const summaryRegex = /([A-Z0-9]{5,})\s+([-\d,.]+)\s+(\d+)\s+(\d+)/;
    const sumMatch = text.match(summaryRegex);
    if (sumMatch) {
        result.clientCode = sumMatch[1];
        result.fundsBalance = parseAmount(sumMatch[2]);
        result.securitiesCount = parseInt(sumMatch[3]);
        result.securitiesQty = parseInt(sumMatch[4]);
    }

    // Securities details
    const secRegex = /([A-Z0-9]{5,})\s+(IN[EF]\w+)\s+(.+?)\s+(\d+)/g;
    let secMatch;
    while ((secMatch = secRegex.exec(text)) !== null) {
        result.securities.push({
            isin: secMatch[2],
            name: secMatch[3].trim(),
            quantity: parseInt(secMatch[4]),
        });
    }

    return result;
}
