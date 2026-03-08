// =============================================================================
// SBI Card (Paytm SBI Card) Credit Card Statement — PDF Text Parser
// Format: "Your Paytm SBI Card Monthly Statement"
// =============================================================================

export interface SbiCardTransaction {
    index: number;
    date: string; // YYYY-MM-DD
    description: string;
    amount: number;
    isCredit: boolean;
    foreignCurrency: string | null;
    foreignAmount: number | null;
}

export interface SbiCardRewardPoints {
    previousBalance: number;
    earned: number;
    redeemedExpired: number;
    closingBalance: number;
}

export interface SbiCardStatement {
    cardHolder: string;
    cardNumber: string; // masked: XXXX XXXX XXXX XX35
    statementNumber: string;
    placeOfSupply: string;
    statementDate: string; // YYYY-MM-DD
    paymentDueDate: string; // YYYY-MM-DD
    billingPeriod: { from: string; to: string };
    totalAmountDue: number;
    minimumAmountDue: number;
    creditLimit: number;
    cashLimit: number;
    availableCreditLimit: number;
    availableCashLimit: number;
    previousBalance: number;
    paymentsCredits: number;
    feeTaxesInterest: number;
    totalOutstanding: number;
    transactions: SbiCardTransaction[];
    rewardPoints: SbiCardRewardPoints | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_MAP: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

function parseAmount(str: string): number {
    return parseFloat(str.replace(/,/g, ''));
}

function parseDateDDMMMYY(str: string): string {
    // "15 Oct 25" → "2025-10-15"
    const m = str.match(/(\d{1,2})\s+(\w{3})\s+(\d{2})/);
    if (m) {
        const year = parseInt(m[3]) < 50 ? `20${m[3]}` : `19${m[3]}`;
        return `${year}-${MONTH_MAP[m[2]] || '01'}-${m[1].padStart(2, '0')}`;
    }
    return '';
}

function parseDateDDMMMYYYY(str: string): string {
    // "17 Nov 2025" → "2025-11-17"
    const m = str.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/);
    if (m) return `${m[3]}-${MONTH_MAP[m[2]] || '01'}-${m[1].padStart(2, '0')}`;
    return '';
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function parseSbiCardCcStatement(text: string): SbiCardStatement {
    const lines = text.split('\n');

    let cardHolder = '';
    let cardNumber = '';
    let statementNumber = '';
    let placeOfSupply = '';
    let statementDate = '';
    let paymentDueDate = '';
    let billingPeriod = { from: '', to: '' };
    let totalAmountDue = 0;
    let minimumAmountDue = 0;
    let creditLimit = 0;
    let cashLimit = 0;
    let availableCreditLimit = 0;
    let availableCashLimit = 0;
    let previousBalance = 0;
    let paymentsCredits = 0;
    let feeTaxesInterest = 0;
    let totalOutstanding = 0;
    let rewardPoints: SbiCardRewardPoints | null = null;

    // --- Extract billing period ---
    const periodMatch = text.match(/Statement Period:\s*(\d{1,2}\s+\w{3}\s+\d{2})\s+to\s+(\d{1,2}\s+\w{3}\s+\d{2})/);
    if (periodMatch) {
        billingPeriod = {
            from: parseDateDDMMMYY(periodMatch[1]),
            to: parseDateDDMMMYY(periodMatch[2]),
        };
    }

    // --- Parse header fields ---
    // First pass: scan up to the first transaction for card details
    for (let i = 0; i < Math.min(lines.length, 80); i++) {
        const line = lines[i].trim();

        // Card number: XXXX XXXX XXXX XX35
        if (line.match(/^XXXX\s+XXXX\s+XXXX\s+XX\d{2}$/)) {
            cardNumber = line;
        }

        // Card holder: line before card number
        if (lines[i + 1]?.trim().match(/^XXXX\s+XXXX\s+XXXX\s+XX\d{2}$/)) {
            cardHolder = line;
        }

        // Statement number
        const stmtNoMatch = line.match(/:\s*(A\d{11,})/);
        if (stmtNoMatch) statementNumber = stmtNoMatch[1];

        // Place of supply
        const posMatch = line.match(/^(DEL\/\d+\/\w+|[A-Z]{2,}\/\d+\/[A-Z]+)$/);
        if (posMatch) placeOfSupply = posMatch[1];

        // Statement date and payment due date: full-year dates like "17 Nov 2025"
        // These appear as standalone lines in the header area
        const fullDateMatch = line.match(/^(\d{1,2}\s+\w{3}\s+\d{4})$/);
        if (fullDateMatch) {
            const parsed = parseDateDDMMMYYYY(fullDateMatch[1]);
            if (!statementDate) {
                statementDate = parsed;
            } else if (!paymentDueDate && parsed !== statementDate) {
                paymentDueDate = parsed;
            }
        }

        // Stop scanning after the first transaction line
        if (line.match(/^\d{2}\s+\w{3}\s+\d{2}\s+/)) break;
    }

    // --- Extract financial amounts from the header area ---
    // After the CKYC line, look for the amounts block
    // Pattern: TAD on one line, Min Due on next, then limits, summary, dates
    const ckycIdx = lines.findIndex(l => l.trim().match(/^CKYC No\./));
    if (ckycIdx > 0) {
        // Scan lines after CKYC for amounts
        const amountLines: { line: string; amounts: number[] }[] = [];
        for (let i = ckycIdx + 1; i < Math.min(ckycIdx + 15, lines.length); i++) {
            const line = lines[i].trim();
            const amounts = line.match(/[\d,]+\.\d{2}/g);
            if (amounts && amounts.length > 0) {
                amountLines.push({ line, amounts: amounts.map(parseAmount) });
            }
        }

        // Expected pattern:
        // Line 0: TAD (1 amount)
        // Line 1: Min Due (1 amount)
        // Line 2: Credit Limit + Cash Limit (2 amounts)
        // Line 3: Available Credit + Available Cash (2 amounts)
        // Line 4: Previous Balance + Payments + Fee/Taxes (3 amounts)
        if (amountLines.length >= 1) totalAmountDue = amountLines[0].amounts[0];
        if (amountLines.length >= 2) minimumAmountDue = amountLines[1].amounts[0];
        if (amountLines.length >= 3 && amountLines[2].amounts.length >= 2) {
            creditLimit = amountLines[2].amounts[0];
            cashLimit = amountLines[2].amounts[1];
        }
        if (amountLines.length >= 4 && amountLines[3].amounts.length >= 2) {
            availableCreditLimit = amountLines[3].amounts[0];
            availableCashLimit = amountLines[3].amounts[1];
        }
        if (amountLines.length >= 5 && amountLines[4].amounts.length >= 3) {
            previousBalance = amountLines[4].amounts[0];
            paymentsCredits = amountLines[4].amounts[1];
            feeTaxesInterest = amountLines[4].amounts[2];
        }
        // TAD + Total Outstanding on a tab-separated line
        if (amountLines.length >= 7 && amountLines[6].amounts.length >= 2) {
            totalOutstanding = amountLines[6].amounts[1];
        } else if (amountLines.length >= 6 && amountLines[5].amounts.length >= 2) {
            totalOutstanding = amountLines[5].amounts[1];
        }
    }

    // --- Parse transactions ---
    const transactions: SbiCardTransaction[] = [];

    // Transaction patterns:
    // Dated: DD MMM YY DESCRIPTION AMOUNT C/D
    // Dated international: DD MMM YY DESCRIPTION FOREIGN_AMT CURRENCY INR_AMT C/D
    // Fee (no date): DESCRIPTION AMOUNT D
    const TXN_DATE_RE = /^(\d{2}\s+\w{3}\s+\d{2})\s+(.+)\s+([\d,]+\.\d{2})\s+(C|D)\s*$/;
    const TXN_INTL_RE = /^(\d{2}\s+\w{3}\s+\d{2})\s+(.+?)\s+([\d,]+\.\d{2})\s+(USD|EUR|GBP|AED|SGD|JPY|CAD|AUD)\s+([\d,]+\.\d{2})\s+(C|D)\s*$/;
    const TXN_FEE_RE = /^(FORGN CURR MARKUP|IGST DB|REPLACEMENT FEE|SERVICE TAX|CGST|SGST|LATE PAYMENT|OVERLIMIT|ANNUAL FEE|RENEWAL FEE|FINANCE CHARGE).*?([\d,]+\.\d{2})\s+(C|D)\s*$/;

    // Lines to skip
    const SKIP_RE = /^(Date\s+|for Statement Period|GSTIN|Transactions highlighted|ORIGINAL FOR|C=Credit|Pay Now|STMT No|PLACE OF SUPPLY|CKYC|--\s+\d|Previous Balance|\/Forfeited|NONE|SAVINGS AND|For this|Cash Back|Petrol Surcharge|Reward Point|Important|Schedule of|BILLING|Version|\*|W\.e\.f|Minimum Amount|Credit Card Number|\*Total|Statement Date|Available|Payment|Additions|Purchases|Fee,|Interest|Important|Log onto|SBI Card|Kindly|All transaction|Post completion|By Phone|By E-mail|By Web|By Letter|For All|CUSTOMER|Simply|SMS|Let|Authorized|Declaration|\( `|#|$)/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (SKIP_RE.test(line)) continue;

        // Section headers to skip
        if (line === 'TRANSACTIONS FOR ' + cardHolder) continue;
        if (line.match(/^TRANSACTIONS FOR /)) continue;

        // Try international transaction first (more specific)
        const intlMatch = line.match(TXN_INTL_RE);
        if (intlMatch) {
            transactions.push({
                index: transactions.length + 1,
                date: parseDateDDMMMYY(intlMatch[1]),
                description: intlMatch[2].trim(),
                amount: parseAmount(intlMatch[5]),
                isCredit: intlMatch[6] === 'C',
                foreignCurrency: intlMatch[4],
                foreignAmount: parseAmount(intlMatch[3]),
            });
            continue;
        }

        // Try dated domestic transaction
        const txnMatch = line.match(TXN_DATE_RE);
        if (txnMatch) {
            transactions.push({
                index: transactions.length + 1,
                date: parseDateDDMMMYY(txnMatch[1]),
                description: txnMatch[2].trim(),
                amount: parseAmount(txnMatch[3]),
                isCredit: txnMatch[4] === 'C',
                foreignCurrency: null,
                foreignAmount: null,
            });
            continue;
        }

        // Try fee/charge line (no date)
        const feeMatch = line.match(TXN_FEE_RE);
        if (feeMatch) {
            // Use billing period end date as the fee date
            transactions.push({
                index: transactions.length + 1,
                date: billingPeriod.to || statementDate,
                description: line.replace(/\s+[\d,]+\.\d{2}\s+[CD]\s*$/, '').trim(),
                amount: parseAmount(feeMatch[2]),
                isCredit: feeMatch[3] === 'C',
                foreignCurrency: null,
                foreignAmount: null,
            });
            continue;
        }
    }

    // --- Parse reward points ---
    // Pattern: 4 numbers on one line before "Previous Balance Earned Redeemed"
    for (let i = 0; i < lines.length; i++) {
        if (lines[i + 1]?.trim().match(/^Previous Balance\s+Earned/)) {
            const nums = lines[i].trim().match(/^([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)$/);
            if (nums) {
                rewardPoints = {
                    previousBalance: parseInt(nums[1].replace(/,/g, '')),
                    earned: parseInt(nums[2].replace(/,/g, '')),
                    redeemedExpired: parseInt(nums[3].replace(/,/g, '')),
                    closingBalance: parseInt(nums[4].replace(/,/g, '')),
                };
            }
        }
    }

    return {
        cardHolder,
        cardNumber,
        statementNumber,
        placeOfSupply,
        statementDate,
        paymentDueDate,
        billingPeriod,
        totalAmountDue,
        minimumAmountDue,
        creditLimit,
        cashLimit,
        availableCreditLimit,
        availableCashLimit,
        previousBalance,
        paymentsCredits,
        feeTaxesInterest,
        totalOutstanding,
        transactions,
        rewardPoints,
    };
}
