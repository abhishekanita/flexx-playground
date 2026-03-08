// BSE Funds Balance PDF parser
// Extracts: client code, fund balance, securities summary

export interface BseFundsBalance {
    clientCode: string;
    broker: string;
    reportDate: string; // DD/MM/YYYY
    fundsBalance: number;
    totalIsins: number;
    totalSecurityQuantity: number;
    totalCommodities: number;
    securities: BseSecurityDetail[];
}

export interface BseSecurityDetail {
    clientCode: string;
    isin: string;
    securityName: string;
    quantity: number;
}

function parseAmount(s: string): number {
    return parseFloat(s.replace(/[,\s]/g, '')) || 0;
}

export function parseBseFundsBalance(text: string): BseFundsBalance {
    const result: BseFundsBalance = {
        clientCode: '',
        broker: '',
        reportDate: '',
        fundsBalance: 0,
        totalIsins: 0,
        totalSecurityQuantity: 0,
        totalCommodities: 0,
        securities: [],
    };

    // Broker
    const brokerMatch = text.match(/Stock Broker\s+(.+?)\s+has reported/);
    if (brokerMatch) result.broker = brokerMatch[1].trim();

    // Report date
    const dateMatch = text.match(/as on\s+(\d{2}\/\d{2}\/\d{4})/);
    if (dateMatch) result.reportDate = dateMatch[1];

    // Summary row: clientCode fundsBalance totalIsins totalQty totalCommodities
    const summaryRegex = /(\d{10})\s+([-\d,.]+)\s+(\d+)\s+(\d+)\s+(\d+)/;
    const sumMatch = text.match(summaryRegex);
    if (sumMatch) {
        result.clientCode = sumMatch[1];
        result.fundsBalance = parseAmount(sumMatch[2]);
        result.totalIsins = parseInt(sumMatch[3]);
        result.totalSecurityQuantity = parseInt(sumMatch[4]);
        result.totalCommodities = parseInt(sumMatch[5]);
    }

    // Securities details (if present)
    const secRegex = /(\d{10})\s+(IN[EF]\w+)\s+(.+?)\s+(\d+)/g;
    let secMatch;
    while ((secMatch = secRegex.exec(text)) !== null) {
        if (secMatch[2] === result.clientCode) continue; // Skip if it's the summary row
        result.securities.push({
            clientCode: secMatch[1],
            isin: secMatch[2],
            securityName: secMatch[3].trim(),
            quantity: parseInt(secMatch[4]),
        });
    }

    return result;
}
