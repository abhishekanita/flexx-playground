// =============================================================================
// Kotak Bank Savings Account Statement — PDF Text Parser
// =============================================================================

export interface KotakTransaction {
    index: number;
    date: string; // YYYY-MM-DD
    description: string;
    refNumber: string;
    withdrawal: number | null;
    deposit: number | null;
    balance: number;
}

export interface KotakStatement {
    accountHolder: string;
    accountNumber: string;
    ifscCode: string;
    branch: string;
    statementPeriod: { from: string; to: string };
    openingBalance: number;
    closingBalance: number;
    transactions: KotakTransaction[];
    summary: {
        savingsOpening: number;
        savingsClosing: number;
        activMoneyOpening: number;
        activMoneyClosing: number;
        totalOpening: number;
        totalClosing: number;
    } | null;
}

const MONTH_MAP: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

function parseDate(dateStr: string): string {
    const [day, mon, year] = dateStr.split(' ');
    return `${year}-${MONTH_MAP[mon]}-${day.padStart(2, '0')}`;
}

function parseAmount(str: string): number {
    return parseFloat(str.replace(/,/g, ''));
}

const AMOUNT_RE = /-?[\d,]+\.\d{2}/g;
const TXN_START_RE = /^(\d+)\s+(\d{2}\s+[A-Z][a-z]{2}\s+\d{4})\s+/;
const OPENING_BAL_RE = /^-\s+-\s+Opening Balance\s+-\s+-\s+-\s+([\d,]+\.\d{2})/;

// Ref extraction patterns, tried in order of specificity
const REF_PATTERNS: Array<{ regex: RegExp; merge?: boolean }> = [
    // UPI-xxx, IMPS-xxx
    { regex: /\s+(UPI-\S+|IMPS-\S+)\s*$/ },
    // NACHDR/NCRCTS refs with optional trailing digit fragment from line break
    { regex: /\s+(\S*(?:NACHDR|NCRCTS_)\S+(?:\s+\d{1,6})?)\s*$/, merge: true },
    // FD ref: 10-digit number followed by TO
    { regex: /\s+(\d{10}TO)\s*$/ },
    // Standalone 12+ digit ref (NEFT, PCI/PCD, CLG refs)
    { regex: /\s+(\d{12,})\s*$/ },
];

function extractRef(descPart: string): { description: string; refNumber: string } {
    for (const { regex, merge } of REF_PATTERNS) {
        const match = descPart.match(regex);
        if (match) {
            const ref = merge ? match[1].replace(/\s+/g, '') : match[1];
            const description = descPart.substring(0, match.index!).trim();
            return { description, refNumber: ref };
        }
    }
    return { description: descPart, refNumber: '' };
}

export function parseKotakStatement(text: string): KotakStatement {
    const lines = text.split('\n');

    // --- Header extraction ---
    const accountHolder = lines[2]?.trim() || '';

    let accountNumber = '';
    let ifscCode = '';
    let branch = '';
    let periodFrom = '';
    let periodTo = '';

    for (const line of lines.slice(0, 20)) {
        const accMatch = line.match(/Account No\.\s*(\d+)/);
        if (accMatch) accountNumber = accMatch[1];

        const ifscMatch = line.match(/IFSC Code\s+(\w+)/);
        if (ifscMatch) ifscCode = ifscMatch[1];

        const branchMatch = line.match(/Branch\s+(.+)/);
        if (branchMatch) branch = branchMatch[1].trim();

        const periodMatch = line.match(/^(\d{2}\s+\w{3}\s+\d{4})\s*-\s*(\d{2}\s+\w{3}\s+\d{4})$/);
        if (periodMatch) {
            periodFrom = parseDate(periodMatch[1]);
            periodTo = parseDate(periodMatch[2]);
        }
    }

    // --- Transaction extraction ---
    const txnLines: string[] = [];
    let inTxnSection = false;

    for (const line of lines) {
        if (line.includes('# Date Description Chq/Ref')) {
            inTxnSection = true;
            continue;
        }
        if (inTxnSection && (line.startsWith('End of Statement') || line.startsWith('Statement Generated'))) {
            inTxnSection = false;
            continue;
        }
        if (line.includes('Savings Account Transactions')) {
            inTxnSection = false;
            continue;
        }
        if (inTxnSection && line.trim()) {
            txnLines.push(line);
        }
    }

    // --- Group multi-line transactions ---
    const txnBlocks: string[] = [];

    for (const line of txnLines) {
        if (TXN_START_RE.test(line) || OPENING_BAL_RE.test(line)) {
            txnBlocks.push(line);
        } else if (txnBlocks.length > 0) {
            txnBlocks[txnBlocks.length - 1] += ' ' + line.trim();
        }
    }

    // --- Parse each transaction block ---
    let openingBalance = 0;
    const transactions: KotakTransaction[] = [];
    let prevBalance = 0;

    for (const block of txnBlocks) {
        const openMatch = block.match(/Opening Balance.*?([\d,]+\.\d{2})\s*$/);
        if (openMatch) {
            openingBalance = parseAmount(openMatch[1]);
            prevBalance = openingBalance;
            continue;
        }

        const startMatch = block.match(TXN_START_RE);
        if (!startMatch) continue;

        const index = parseInt(startMatch[1]);
        const date = parseDate(startMatch[2]);

        const amounts = [...block.matchAll(AMOUNT_RE)].map(m => m[0]);
        if (amounts.length < 2) continue;

        const balance = parseAmount(amounts[amounts.length - 1]);
        const txnAmount = parseAmount(amounts[amounts.length - 2]);

        const diff = balance - prevBalance;
        let withdrawal: number | null = null;
        let deposit: number | null = null;

        if (Math.abs(diff + txnAmount) < 0.01) {
            withdrawal = txnAmount;
        } else if (Math.abs(diff - txnAmount) < 0.01) {
            deposit = txnAmount;
        } else {
            if (diff < 0) {
                withdrawal = Math.abs(txnAmount);
            } else {
                deposit = txnAmount;
            }
        }

        const afterDate = block.substring(startMatch[0].length);
        const lastAmountIdx = afterDate.lastIndexOf(amounts[amounts.length - 2]);
        const descPart = afterDate.substring(0, lastAmountIdx).trim();

        const { description, refNumber } = extractRef(descPart);

        transactions.push({ index, date, description, refNumber, withdrawal, deposit, balance });
        prevBalance = balance;
    }

    const closingBalance = transactions.length > 0
        ? transactions[transactions.length - 1].balance
        : openingBalance;

    // --- Account summary ---
    let summary: KotakStatement['summary'] = null;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Particulars Opening Balance Closing Balance')) {
            const saLine = lines[i + 1] || '';
            const amLine = lines[i + 2] || '';
            const totalLine = lines[i + 3] || '';

            const saAmounts = [...saLine.matchAll(AMOUNT_RE)].map(m => parseAmount(m[0]));
            const amAmounts = [...amLine.matchAll(AMOUNT_RE)].map(m => parseAmount(m[0]));
            const totalAmounts = [...totalLine.matchAll(AMOUNT_RE)].map(m => parseAmount(m[0]));

            if (saAmounts.length >= 2 && amAmounts.length >= 2 && totalAmounts.length >= 2) {
                summary = {
                    savingsOpening: saAmounts[0],
                    savingsClosing: saAmounts[1],
                    activMoneyOpening: amAmounts[0],
                    activMoneyClosing: amAmounts[1],
                    totalOpening: totalAmounts[0],
                    totalClosing: totalAmounts[1],
                };
            }
            break;
        }
    }

    return {
        accountHolder,
        accountNumber,
        ifscCode,
        branch,
        statementPeriod: { from: periodFrom, to: periodTo },
        openingBalance,
        closingBalance,
        transactions,
        summary,
    };
}
