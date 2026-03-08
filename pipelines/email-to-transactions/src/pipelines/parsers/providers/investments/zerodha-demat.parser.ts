// Zerodha Transaction with Holding Statement PDF parser
// Extracts: demat holdings (MF units with ISIN, balance, rate, value), transactions

export interface ZerodhaDematHolding {
    isin: string;
    companyName: string;
    currentBalance: number;
    freeBalance: number;
    pledgeBalance: number;
    earmarkBalance: number;
    rate: number;
    value: number;
}

export interface ZerodhaDematTransaction {
    date: string; // YYYY-MM-DD
    description: string;
    buyCr: number;
    sellDr: number;
    balance: number;
}

export interface ZerodhaDematStatement {
    dpId: string;
    clientId: string;
    tradingId: string;
    pan: string;
    holderName: string;
    statementPeriod: string;
    holdings: ZerodhaDematHolding[];
    transactions: ZerodhaDematTransaction[];
    holdingsTotal: number;
}

function parseAmount(s: string): number {
    return parseFloat(s.replace(/[,\s]/g, '')) || 0;
}

export function parseZerodhaDematStatement(text: string): ZerodhaDematStatement {
    const result: ZerodhaDematStatement = {
        dpId: '',
        clientId: '',
        tradingId: '',
        pan: '',
        holderName: '',
        statementPeriod: '',
        holdings: [],
        transactions: [],
        holdingsTotal: 0,
    };

    // Header fields
    const dpMatch = text.match(/DP ID\s*:\s*(\d+)/);
    if (dpMatch) result.dpId = dpMatch[1];

    const clientMatch = text.match(/Client ID\s*:\s*(\d+)/);
    if (clientMatch) result.clientId = clientMatch[1];

    const tradingMatch = text.match(/Trading ID\s*:\s*(\w+)/);
    if (tradingMatch) result.tradingId = tradingMatch[1];

    const panMatch = text.match(/PAN No\s*:\s*([A-Z]{5}\d{4}[A-Z])/);
    if (panMatch) result.pan = panMatch[1];

    const nameMatch = text.match(/^To,\s*\n(.+)/m);
    if (nameMatch) result.holderName = nameMatch[1].trim();

    const periodMatch = text.match(/Statement of Account from\s+(.+?):/);
    if (periodMatch) result.statementPeriod = periodMatch[1].trim();

    // Parse holdings table
    // Format: ISIN \t COMPANY NAME \t CurrBal \t FreeBal \t PldgBal \t EarmarkBal \t Demat \t Remat \t Lockin \t Rate \t Value
    const holdingsSection = text.match(/Holdings as on[\s\S]*?(?=Total:|Note:|Messages:|\*\s*System)/);
    if (holdingsSection) {
        const lines = holdingsSection[0].split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const isinMatch = line.match(/^(IN[EF]\w+)/);
            if (!isinMatch) continue;

            // Holdings line may span multiple lines if company name wraps
            let fullLine = line;
            let j = i + 1;
            while (j < lines.length && !lines[j].match(/^IN[EF]\w+/) && !lines[j].match(/^Total:/) && lines[j].trim()) {
                fullLine += ' ' + lines[j].trim();
                j++;
            }

            // Extract tab-separated or space-separated values
            const parts = fullLine.split('\t').map(s => s.trim());
            if (parts.length >= 2) {
                // First part has ISIN + company name
                const firstPart = parts[0];
                const isin = firstPart.match(/^(IN[EF]\w+)/)?.[1] || '';
                const companyName = firstPart.replace(/^IN[EF]\w+\s*/, '').trim();

                // Remaining parts are numbers
                const nums = parts.slice(1).join(' ').match(/[\d.]+/g) || [];
                if (nums.length >= 2) {
                    result.holdings.push({
                        isin,
                        companyName,
                        currentBalance: parseFloat(nums[0]) || 0,
                        freeBalance: parseFloat(nums[1]) || 0,
                        pledgeBalance: parseFloat(nums[2]) || 0,
                        earmarkBalance: parseFloat(nums[3]) || 0,
                        rate: parseFloat(nums[nums.length - 2]) || 0,
                        value: parseFloat(nums[nums.length - 1]) || 0,
                    });
                }
            } else {
                // Space-separated - extract all numbers from the line
                const nums = fullLine.match(/[\d]+\.[\d]+/g) || [];
                const isin = fullLine.match(/^(IN[EF]\w+)/)?.[1] || '';
                const companyName = fullLine.replace(/^IN[EF]\w+\s*/, '').replace(/[\d.]+.*/g, '').trim();
                if (nums.length >= 2) {
                    result.holdings.push({
                        isin,
                        companyName,
                        currentBalance: parseFloat(nums[0]) || 0,
                        freeBalance: parseFloat(nums[1]) || 0,
                        pledgeBalance: parseFloat(nums[2]) || 0,
                        earmarkBalance: parseFloat(nums[3]) || 0,
                        rate: parseFloat(nums[nums.length - 2]) || 0,
                        value: parseFloat(nums[nums.length - 1]) || 0,
                    });
                }
            }
        }
    }

    // Holdings total
    const totalMatch = text.match(/Total:\s*[\d.]+\s+[\d.]+[\s\S]*?([\d]+\.[\d]+)\s*$/m);
    if (totalMatch) result.holdingsTotal = parseFloat(totalMatch[1]);
    // Fallback
    if (!result.holdingsTotal) {
        const tm = text.match(/Total:[\s\S]*?([\d]+\.[\d]{3})\s*$/m);
        if (tm) result.holdingsTotal = parseFloat(tm[1]);
    }

    // Parse transactions
    const txnSection = text.match(/Statement of Account from[\s\S]*?(?=Holdings as on)/);
    if (txnSection) {
        const txnRegex = /(\d{4}-\d{2}-\d{2})\s+(.+?)\s+(\d[\d,.]*)\s+(\d[\d,.]*)\s+(\d[\d,.]*)/g;
        let txnMatch;
        while ((txnMatch = txnRegex.exec(txnSection[0])) !== null) {
            result.transactions.push({
                date: txnMatch[1],
                description: txnMatch[2].trim(),
                buyCr: parseAmount(txnMatch[3]),
                sellDr: parseAmount(txnMatch[4]),
                balance: parseAmount(txnMatch[5]),
            });
        }
    }

    return result;
}
