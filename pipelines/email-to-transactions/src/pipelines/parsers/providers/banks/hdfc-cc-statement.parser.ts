// =============================================================================
// HDFC Bank Credit Card Statement — PDF Text Parser
// Handles two formats:
//   Old (pre-Aug 2025): "Regalia Mastercard" — tabular layout
//   New (Aug 2025+):    "Regalia" — visual/card-style layout
// =============================================================================

export interface HdfcCcTransaction {
    index: number;
    date: string; // YYYY-MM-DD
    time: string | null; // HH:MM or HH:MM:SS
    description: string;
    refNumber: string;
    rewardPoints: number | null;
    amount: number;
    isCredit: boolean;
    isInternational: boolean;
    foreignCurrency: string | null; // USD, EUR, etc.
    foreignAmount: number | null;
}

export interface HdfcCcEmiLoan {
    loanNumber: string;
    bookedDate: string; // YYYY-MM-DD
    loanAmount: number;
    tenure: number; // months
    interestRate: number; // %
    balancePrincipal: number;
    balanceInterest: number;
    balanceTenure: number; // months remaining
}

export interface HdfcCcStatement {
    cardHolder: string;
    cardNumber: string; // masked
    alternateAccountNumber: string;
    statementDate: string; // YYYY-MM-DD
    billingPeriod: { from: string; to: string };
    paymentDueDate: string; // YYYY-MM-DD
    totalDues: number;
    minimumDue: number;
    creditLimit: number;
    availableCreditLimit: number;
    availableCashLimit: number;
    accountSummary: {
        openingBalance: number;
        paymentsCredits: number;
        purchasesDebits: number;
        financeCharges: number;
    };
    gstSummary: {
        igst: number;
        cgst: number;
        sgst: number;
        reversal: number;
        total: number;
    } | null;
    domesticTransactions: HdfcCcTransaction[];
    internationalTransactions: HdfcCcTransaction[];
    emiLoans: HdfcCcEmiLoan[];
    format: 'old' | 'new';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseAmount(str: string): number {
    return parseFloat(str.replace(/,/g, '').replace(/^C/, ''));
}

function parseDateDDMMYYYY(str: string): string {
    const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return '';
}

const MONTH_MAP: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

function parseDateText(str: string): string {
    // "23 Aug, 2025" or "23 Dec, 2025"
    const m = str.match(/(\d{1,2})\s+(\w{3}),?\s+(\d{4})/);
    if (m) return `${m[3]}-${MONTH_MAP[m[2]] || '01'}-${m[1].padStart(2, '0')}`;
    return '';
}

function parseBillingPeriod(str: string): { from: string; to: string } {
    // "24 Jul, 2025 - 23 Aug, 2025" or "24/03/2025 to 23/04/2025"
    const textMatch = str.match(/(\d{1,2}\s+\w{3},?\s+\d{4})\s*-\s*(\d{1,2}\s+\w{3},?\s+\d{4})/);
    if (textMatch) return { from: parseDateText(textMatch[1]), to: parseDateText(textMatch[2]) };
    return { from: '', to: '' };
}

function extractRef(desc: string): { description: string; refNumber: string } {
    const refMatch = desc.match(/\(Ref#\s*([^)]+)\)/);
    if (refMatch) {
        const cleanDesc = desc.replace(/\(Ref#\s*[^)]+\)/, '').trim();
        return { description: cleanDesc, refNumber: refMatch[1].trim() };
    }
    return { description: desc, refNumber: '' };
}

function detectFormat(text: string): 'old' | 'new' {
    // New format has "DATE & TIME" header and amounts prefixed with C
    if (text.includes('DATE & TIME TRANSACTION DESCRIPTION REWARDS AMOUNT PI')) return 'new';
    if (text.includes('Date Transaction Description Feature Reward')) return 'old';
    // Fallback: check for C-prefixed amounts
    if (/C\s*[\d,]+\.\d{2}\s+l/.test(text)) return 'new';
    return 'old';
}

// ---------------------------------------------------------------------------
// OLD format parser (March-July 2025 style)
// ---------------------------------------------------------------------------

// Old format transaction: DD/MM/YYYY [HH:MM:SS] DESCRIPTION [REWARD_PTS] AMOUNT [Cr]
const OLD_TXN_RE = /^(\d{2}\/\d{2}\/\d{4})\s+(?:(\d{2}:\d{2}:\d{2})\s+)?(.+)$/;

function parseOldTransactions(lines: string[], startIdx: number, endIdx: number, isIntl: boolean): HdfcCcTransaction[] {
    const txns: HdfcCcTransaction[] = [];
    let idx = startIdx;

    while (idx < endIdx) {
        let line = lines[idx].trim();
        idx++;

        // Handle "null" prefix on some lines (PDF extraction artifact)
        line = line.replace(/^null\s+/, '');

        const match = line.match(OLD_TXN_RE);
        if (!match) continue;

        const dateStr = match[1];
        const time = match[2] || null;
        let rest = match[3].trim();

        // Check for continuation line (Ref# on next line)
        while (idx < endIdx && lines[idx]?.trim() && !lines[idx].trim().replace(/^null\s+/, '').match(/^\d{2}\/\d{2}\/\d{4}/) &&
               !lines[idx].trim().match(/^(Reward Points|Page \d|Regalia|HDFC Bank|-- \d|$)/)) {
            rest += ' ' + lines[idx].trim();
            idx++;
        }

        const isCredit = rest.endsWith('Cr');
        if (isCredit) rest = rest.replace(/\s*Cr\s*$/, '').trim();

        // Extract amount (last number), then reward points (second to last if exists)
        // For international: ... USD 20.00 44 1,720.74
        let amount = 0;
        let rewardPoints: number | null = null;
        let foreignCurrency: string | null = null;
        let foreignAmount: number | null = null;
        let description = rest;

        if (isIntl) {
            // Pattern: DESCRIPTION CITY CURRENCY AMOUNT REWARD_PTS INR_AMOUNT
            const intlMatch = rest.match(/^(.+?)\s+(USD|EUR|GBP|AED|SGD|JPY|CAD|AUD)\s+([\d,.]+)\s+(\d+)\s+([\d,]+\.\d{2})$/);
            if (intlMatch) {
                description = intlMatch[1].trim();
                foreignCurrency = intlMatch[2];
                foreignAmount = parseFloat(intlMatch[3].replace(/,/g, ''));
                rewardPoints = parseInt(intlMatch[4]);
                amount = parseAmount(intlMatch[5]);
            } else {
                // Fallback: just grab the last amount
                const amtMatch = rest.match(/([\d,]+\.\d{2})\s*$/);
                if (amtMatch) {
                    amount = parseAmount(amtMatch[1]);
                    description = rest.substring(0, amtMatch.index!).trim();
                }
            }
        } else {
            // Domestic: DESCRIPTION [- REWARD_PTS] AMOUNT
            // The reward points can be negative (prefixed with -) or positive
            const amtMatch = rest.match(/([\d,]+\.\d{2})\s*$/);
            if (amtMatch) {
                amount = parseAmount(amtMatch[1]);
                let beforeAmt = rest.substring(0, amtMatch.index!).trim();

                // Check for reward points before the amount
                const rpMatch = beforeAmt.match(/(-?\s*\d+)\s*$/);
                if (rpMatch) {
                    const rpStr = rpMatch[1].replace(/\s/g, '');
                    const rp = parseInt(rpStr);
                    if (!isNaN(rp) && Math.abs(rp) < 100000) {
                        rewardPoints = rp;
                        beforeAmt = beforeAmt.substring(0, rpMatch.index!).trim();
                    }
                }
                description = beforeAmt;
            }
        }

        const { description: cleanDesc, refNumber } = extractRef(description);

        txns.push({
            index: txns.length + 1,
            date: parseDateDDMMYYYY(dateStr),
            time,
            description: cleanDesc.replace(/\s+/g, ' ').trim(),
            refNumber,
            rewardPoints,
            amount,
            isCredit,
            isInternational: isIntl,
            foreignCurrency,
            foreignAmount,
        });
    }

    return txns;
}

// ---------------------------------------------------------------------------
// NEW format parser (August 2025+ style)
// ---------------------------------------------------------------------------

// New format transaction: DD/MM/YYYY| HH:MM DESCRIPTION [+ REWARD_PTS] C AMOUNT l
// Or multi-line with Ref# on next line
const NEW_TXN_RE = /^(\d{2}\/\d{2}\/\d{4})\|\s*(\d{2}:\d{2})\s+(.+)$/;
// Some new format lines have space instead of pipe: DD/MM/YYYY | HH:MM
const NEW_TXN_RE2 = /^(\d{2}\/\d{2}\/\d{4})\s+\|\s+(\d{2}:\d{2})\s+(.+)$/;
// Some new format GST/EMI lines have no time: DD/MM/YYYY| 00:00 or just DD/MM/YYYY|
const NEW_TXN_RE3 = /^(\d{2}\/\d{2}\/\d{4})\|\s*(?:(\d{2}:\d{2})\s+)?(.+)$/;

function parseNewTransactions(lines: string[], startIdx: number, endIdx: number, isIntl: boolean): HdfcCcTransaction[] {
    const txns: HdfcCcTransaction[] = [];
    let idx = startIdx;

    while (idx < endIdx) {
        const line = lines[idx].trim();
        idx++;

        const match = line.match(NEW_TXN_RE) || line.match(NEW_TXN_RE2) || line.match(NEW_TXN_RE3);
        if (!match) continue;

        const dateStr = match[1];
        const time = match[2] || null;
        let rest = match[3].trim();

        // Check continuation lines
        while (idx < endIdx) {
            const nextLine = lines[idx]?.trim();
            if (!nextLine || nextLine.match(/^\d{2}\/\d{2}\/\d{4}/) ||
                nextLine.match(/^\*/) ||
                nextLine.match(/^(Page \d|Regalia|HDFC Bank|-- \d|International|Domestic|Smart EMI|GST Summary|Reward|Eligible|Benefits|Past Dues|PREVIOUS|TOTAL CREDIT|Important)/)) break;
            rest += ' ' + nextLine;
            idx++;
        }

        // Parse amount: C AMOUNT l at the end
        let amount = 0;
        let rewardPoints: number | null = null;
        let isCredit = false;
        let foreignCurrency: string | null = null;
        let foreignAmount: number | null = null;

        // Remove trailing `l` (PI marker)
        rest = rest.replace(/\s+l\s*$/, '').trim();

        // Extract C AMOUNT at the end
        const amtMatch = rest.match(/C\s*([\d,]+\.\d{2})\s*$/);
        if (amtMatch) {
            amount = parseAmount(amtMatch[1]);
            let beforeAmt = rest.substring(0, amtMatch.index!).trim();

            // Check for + before the amount (credit indicator or reward + amount)
            // Pattern: "DESCRIPTION + C AMOUNT" (credit) or "DESCRIPTION + N C AMOUNT" (reward pts)
            const creditMatch = beforeAmt.match(/\+\s*$/);
            const rewardMatch = beforeAmt.match(/\+\s+(\d+)\s*$/);

            if (rewardMatch) {
                rewardPoints = parseInt(rewardMatch[1]);
                beforeAmt = beforeAmt.substring(0, rewardMatch.index!).trim();
            } else if (creditMatch) {
                isCredit = true;
                beforeAmt = beforeAmt.substring(0, creditMatch.index!).trim();
            }

            // International: check for currency amount
            if (isIntl) {
                const fxMatch = beforeAmt.match(/\s+(USD|EUR|GBP|AED|SGD|JPY|CAD|AUD)\s+([\d,.]+)\s*$/);
                if (fxMatch) {
                    foreignCurrency = fxMatch[1];
                    foreignAmount = parseFloat(fxMatch[2].replace(/,/g, ''));
                    beforeAmt = beforeAmt.substring(0, fxMatch.index!).trim();
                }
            }

            rest = beforeAmt;
        }

        // Detect credits from description keywords
        if (rest.match(/\bCREDIT\b|\bCC PAYMENT\b|\bREFUND\b/i)) {
            isCredit = true;
        }

        const { description, refNumber } = extractRef(rest);

        txns.push({
            index: txns.length + 1,
            date: parseDateDDMMYYYY(dateStr),
            time,
            description: description.replace(/\s+/g, ' ').trim(),
            refNumber,
            rewardPoints,
            amount,
            isCredit,
            isInternational: isIntl,
            foreignCurrency,
            foreignAmount,
        });
    }

    return txns;
}

// ---------------------------------------------------------------------------
// EMI Loan parser (shared between formats)
// ---------------------------------------------------------------------------

function parseEmiLoans(text: string): HdfcCcEmiLoan[] {
    const loans: HdfcCcEmiLoan[] = [];

    // Pattern: LOAN_NUM DD/MM/YYYY [C]AMOUNT TENURE [Months] RATE [%] [C]BALANCE_PRIN [C]BALANCE_INT BALANCE_TENURE [Months]
    const loanLines = text.match(/(\d{9,})\s+(\d{2}\/\d{2}\/\d{4})\s+C?([\d,]+\.\d{2})\s+(\d+)\s*(?:Months?)?\s+([\d.]+)\s*%?\s+C?([\d,]+\.\d{2})\s+C?([\d,]+\.\d{2})\s+(\d+)\s*(?:Months?)?/g);

    if (loanLines) {
        for (const line of loanLines) {
            const m = line.match(/(\d{9,})\s+(\d{2}\/\d{2}\/\d{4})\s+C?([\d,]+\.\d{2})\s+(\d+)\s*(?:Months?)?\s+([\d.]+)\s*%?\s+C?([\d,]+\.\d{2})\s+C?([\d,]+\.\d{2})\s+(\d+)/);
            if (m) {
                loans.push({
                    loanNumber: m[1],
                    bookedDate: parseDateDDMMYYYY(m[2]),
                    loanAmount: parseAmount(m[3]),
                    tenure: parseInt(m[4]),
                    interestRate: parseFloat(m[5]),
                    balancePrincipal: parseAmount(m[6]),
                    balanceInterest: parseAmount(m[7]),
                    balanceTenure: parseInt(m[8]),
                });
            }
        }
    }

    return loans;
}

// ---------------------------------------------------------------------------
// GST Summary parser
// ---------------------------------------------------------------------------

function parseGstSummary(text: string): HdfcCcStatement['gstSummary'] {
    // New format: CIGST CCGST CSGST CREVERSAL CTOTAL
    const newMatch = text.match(/GST Summary[\s\S]*?C([\d,.]+)\s+C([\d,.]+)\s+C([\d,.]+)\s+C([\d,.]+)\s+C([\d,.]+)/);
    if (newMatch) {
        return {
            igst: parseAmount(newMatch[1]),
            cgst: parseAmount(newMatch[2]),
            sgst: parseAmount(newMatch[3]),
            reversal: parseAmount(newMatch[4]),
            total: parseAmount(newMatch[5]),
        };
    }

    // Old format: header line "IGST CGST SGST Reversal Total GST\t226.42"
    // then data line "226.42 0.00 0.00 0.00 226.42"
    // Match data line: 5 numbers on their own line after the header
    const oldMatch = text.match(/IGST\s+CGST\s+SGST\s+Reversal\s+Total GST[\s\S]*?\n([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)/);
    if (oldMatch) {
        return {
            igst: parseAmount(oldMatch[1]),
            cgst: parseAmount(oldMatch[2]),
            sgst: parseAmount(oldMatch[3]),
            reversal: parseAmount(oldMatch[4]),
            total: parseAmount(oldMatch[5]),
        };
    }

    return null;
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function parseHdfcCcStatement(text: string): HdfcCcStatement {
    const format = detectFormat(text);
    const lines = text.split('\n');

    // --- Card details ---
    let cardHolder = '';
    let cardNumber = '';
    let alternateAccountNumber = '';
    let statementDate = '';
    let billingPeriod = { from: '', to: '' };
    let paymentDueDate = '';
    let totalDues = 0;
    let minimumDue = 0;
    let creditLimit = 0;
    let availableCreditLimit = 0;
    let availableCashLimit = 0;
    let openingBalance = 0;
    let paymentsCredits = 0;
    let purchasesDebits = 0;
    let financeCharges = 0;

    if (format === 'old') {
        // Old format: structured header
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line.startsWith('Name :')) {
                cardHolder = line.replace('Name :', '').trim();
            }

            const stmtDateMatch = line.match(/Statement Date:\s*(\d{2}\/\d{2}\/\d{4})/);
            if (stmtDateMatch) statementDate = parseDateDDMMYYYY(stmtDateMatch[1]);

            const cardNoMatch = line.match(/Card No:\s*([\dX\s]+)/);
            if (cardNoMatch) cardNumber = cardNoMatch[1].replace(/\s+/g, '');

            if (line.startsWith('AAN :')) {
                alternateAccountNumber = line.replace('AAN :', '').trim();
            }

            // Payment Due Date Total Dues Minimum Amount Due
            // DD/MM/YYYY AMOUNT AMOUNT
            if (line.match(/^Payment Due Date\s+Total Dues/)) {
                const nextLine = lines[i + 1]?.trim();
                if (nextLine) {
                    const parts = nextLine.match(/([\d/]+)\s+([\d,.]+)\s+([\d,.]+)/);
                    if (parts) {
                        paymentDueDate = parseDateDDMMYYYY(parts[1]);
                        totalDues = parseAmount(parts[2]);
                        minimumDue = parseAmount(parts[3]);
                    }
                }
            }

            // Credit Limit Available Credit Limit Available Cash Limit
            if (line.match(/^Credit Limit\s+Available Credit/)) {
                const nextLine = lines[i + 1]?.trim();
                if (nextLine) {
                    const parts = nextLine.match(/([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)/);
                    if (parts) {
                        creditLimit = parseAmount(parts[1]);
                        availableCreditLimit = parseAmount(parts[2]);
                        availableCashLimit = parseAmount(parts[3]);
                    }
                }
            }

            // Account Summary values on line after headers
            if (line.match(/^[\d,.]+\s+[\d,.]+\s+[\d,.]+\s+[\d,.]+\s+[\d,.]+$/) && i > 20) {
                const prevLine = lines[i - 1]?.trim();
                if (prevLine?.match(/Charges\s+Total Dues/)) {
                    const parts = line.match(/([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)/);
                    if (parts) {
                        openingBalance = parseAmount(parts[1]);
                        paymentsCredits = parseAmount(parts[2]);
                        purchasesDebits = parseAmount(parts[3]);
                        financeCharges = parseAmount(parts[4]);
                    }
                }
            }
        }
    } else {
        // New format: card-style layout
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Card holder from name line before address
            if (line === 'ASHUTOSH DHEWAL' || line.match(/^[A-Z\s]{5,}$/) && !line.match(/^(TOTAL|MINIMUM|PREVIOUS|DOMESTIC|INTERNATIONAL|IMPORTANT|DISABLED|ENABLED)/)) {
                if (lines[i + 1]?.trim().match(/H NO|FLAT|BLOCK|ENCLAVE|VIHAR/i)) {
                    cardHolder = line;
                }
            }

            // TOTAL AMOUNT DUE C15,347.00
            const totalDueMatch = line.match(/^C([\d,]+\.\d{2})$/);
            if (totalDueMatch && lines[i - 1]?.trim() === 'TOTAL AMOUNT DUE') {
                totalDues = parseAmount(totalDueMatch[1]);
            }

            // MINIMUM DUE C5,726.00
            if (totalDueMatch && lines[i - 1]?.trim() === 'MINIMUM DUE') {
                minimumDue = parseAmount(totalDueMatch[1]);
            }

            // DUE DATE 12 Sep, 2025
            if (line.match(/^\d{1,2}\s+\w{3},\s+\d{4}$/) && lines[i - 1]?.trim() === 'DUE DATE') {
                paymentDueDate = parseDateText(line);
            }

            // Card number: 552260XXXXXX1281
            if (line.match(/^\d{6}X+\d{4}$/)) {
                cardNumber = line;
            }

            // Alternate Account Number (line after card number)
            if (line.match(/^\d{16,}$/) && lines[i - 1]?.trim().match(/^\d{6}X+\d{4}$/)) {
                alternateAccountNumber = line;
            }

            // Statement Date: "23 Aug, 2025"
            // In new format, labels stack (Credit Card No. / AAN / Statement Date / Billing Period)
            // then values stack below them. So Statement Date label may be 4 lines before value.
            const stmtMatch = line.match(/^(\d{1,2}\s+\w{3},\s+\d{4})$/);
            if (stmtMatch && !statementDate) {
                for (let lookback = 1; lookback <= 6; lookback++) {
                    if (lines[i - lookback]?.trim() === 'Statement Date') {
                        statementDate = parseDateText(stmtMatch[1]);
                        break;
                    }
                }
            }

            // Billing Period
            if (line.match(/^\d{1,2}\s+\w{3},\s+\d{4}\s*-\s*\d{1,2}\s+\w{3},\s+\d{4}$/)) {
                billingPeriod = parseBillingPeriod(line);
            }

            // Credit limits: CTOTAL C AVAILABLE CCASH
            if (line.match(/^C[\d,]+\s+C[\d,]+\s+C[\d,]+$/)) {
                const parts = line.match(/C([\d,]+)\s+C([\d,]+)\s+C([\d,]+)/);
                if (parts) {
                    creditLimit = parseAmount(parts[1]);
                    availableCreditLimit = parseAmount(parts[2]);
                    availableCashLimit = parseAmount(parts[3]);
                }
            }

            // Account summary: CPREV CPAYMENTS CPURCHASES CFINANCE
            // Labels span multiple lines (PREVIOUS STATEMENT DUES / PAYMENTS/CREDITS / RECEIVED / PURCHASES/DEBIT / ...)
            // so check up to 6 lines back for PREVIOUS STATEMENT
            if (line.match(/^C[\d,]+\.\d{2}\s+C[\d,]+\.\d{2}\s+C[\d,]+\.\d{2}\s+C[\d,]+\.\d{2}$/)) {
                let isAccountSummary = false;
                for (let lookback = 1; lookback <= 6; lookback++) {
                    if (lines[i - lookback]?.trim().match(/PREVIOUS STATEMENT/)) {
                        isAccountSummary = true;
                        break;
                    }
                }
                if (isAccountSummary) {
                    const parts = line.match(/C([\d,]+\.\d{2})\s+C([\d,]+\.\d{2})\s+C([\d,]+\.\d{2})\s+C([\d,]+\.\d{2})/);
                    if (parts) {
                        openingBalance = parseAmount(parts[1]);
                        paymentsCredits = parseAmount(parts[2]);
                        purchasesDebits = parseAmount(parts[3]);
                        financeCharges = parseAmount(parts[4]);
                    }
                }
            }
        }
    }

    // Infer billing period from statement date for old format (no explicit billing period line)
    if (format === 'old' && statementDate && !billingPeriod.from) {
        // HDFC CC billing: from 24th of previous month to statement date (typically 23rd)
        const stmtParts = statementDate.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (stmtParts) {
            const stmtDateObj = new Date(parseInt(stmtParts[1]), parseInt(stmtParts[2]) - 1, parseInt(stmtParts[3]));
            const fromDate = new Date(stmtDateObj);
            fromDate.setMonth(fromDate.getMonth() - 1);
            fromDate.setDate(24);
            billingPeriod = {
                from: `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-${String(fromDate.getDate()).padStart(2, '0')}`,
                to: statementDate,
            };
        }
    }

    // --- Find transaction sections ---
    const domesticTxns: HdfcCcTransaction[] = [];
    const internationalTxns: HdfcCcTransaction[] = [];

    const domesticStarts: number[] = [];
    const internationalStarts: number[] = [];
    const sectionEnds: number[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === 'Domestic Transactions') domesticStarts.push(i);
        if (line === 'International Transactions') internationalStarts.push(i);
        if (line.match(/^(Reward Points Summary|Rewards Program|Page \d+ of \d+|Smart EMI|GST Summary|Past Dues|Eligible for EMI|Benefits on your card)/)) {
            sectionEnds.push(i);
        }
    }

    const parseFn = format === 'old' ? parseOldTransactions : parseNewTransactions;

    // Parse all domestic sections
    for (const start of domesticStarts) {
        // Find the header line after "Domestic Transactions"
        let headerIdx = start + 1;
        while (headerIdx < lines.length && !lines[headerIdx].trim().match(/^(Date |DATE &)/)) headerIdx++;
        const txnStart = headerIdx + 1;

        // Skip cardholder name line
        let actualStart = txnStart;
        while (actualStart < lines.length && lines[actualStart].trim().match(/^[A-Z\s]{5,}$/) && !lines[actualStart].trim().match(/^\d{2}\//)) {
            actualStart++;
        }

        // Find end of this section
        let end = lines.length;
        for (const e of [...internationalStarts, ...sectionEnds]) {
            if (e > start && e < end) end = e;
        }

        domesticTxns.push(...parseFn(lines, actualStart, end, false));
    }

    // Parse all international sections
    for (const start of internationalStarts) {
        let headerIdx = start + 1;
        while (headerIdx < lines.length && !lines[headerIdx].trim().match(/^(Date |DATE &)/)) headerIdx++;
        const txnStart = headerIdx + 1;

        let actualStart = txnStart;
        while (actualStart < lines.length && lines[actualStart].trim().match(/^[A-Z\s]{5,}$/) && !lines[actualStart].trim().match(/^\d{2}\//)) {
            actualStart++;
        }

        let end = lines.length;
        for (const e of sectionEnds) {
            if (e > start && e < end) end = e;
        }

        internationalTxns.push(...parseFn(lines, actualStart, end, true));
    }

    // Re-index all transactions
    let idx = 1;
    for (const t of domesticTxns) t.index = idx++;
    for (const t of internationalTxns) t.index = idx++;

    // --- EMI loans ---
    const emiLoans = parseEmiLoans(text);

    // --- GST ---
    const gstSummary = parseGstSummary(text);

    return {
        cardHolder,
        cardNumber,
        alternateAccountNumber,
        statementDate,
        billingPeriod,
        paymentDueDate,
        totalDues,
        minimumDue,
        creditLimit,
        availableCreditLimit,
        availableCashLimit,
        accountSummary: {
            openingBalance,
            paymentsCredits,
            purchasesDebits,
            financeCharges,
        },
        gstSummary,
        domesticTransactions: domesticTxns,
        internationalTransactions: internationalTxns,
        emiLoans,
        format,
    };
}
