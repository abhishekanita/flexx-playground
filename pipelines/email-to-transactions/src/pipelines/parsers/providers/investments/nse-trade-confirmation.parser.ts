// NSE Trade Confirmation PDF parser (stub — format TBD after PDF extraction)

export interface NseTradeConfirmation {
    pan: string;
    tradeDate: string;
    trades: Array<{
        symbol: string;
        buySell: string;
        quantity: number;
        price: number;
        value: number;
    }>;
}

export function parseNseTradeConfirmation(text: string): NseTradeConfirmation {
    const result: NseTradeConfirmation = {
        pan: '',
        tradeDate: '',
        trades: [],
    };

    const panMatch = text.match(/([A-Z]{5}\d{4}[A-Z])/);
    if (panMatch) result.pan = panMatch[1];

    const dateMatch = text.match(/(\d{2}-\w{3}-\d{4}|\d{2}\/\d{2}\/\d{4})/);
    if (dateMatch) result.tradeDate = dateMatch[1];

    // Trade rows — format will be refined after seeing actual PDF text
    const tradeRegex = /(\w+)\s+(BUY|SELL|B|S)\s+(\d+)\s+([\d,.]+)\s+([\d,.]+)/gi;
    let m;
    while ((m = tradeRegex.exec(text)) !== null) {
        result.trades.push({
            symbol: m[1],
            buySell: m[2],
            quantity: parseInt(m[3]),
            price: parseFloat(m[4].replace(/,/g, '')) || 0,
            value: parseFloat(m[5].replace(/,/g, '')) || 0,
        });
    }

    return result;
}
