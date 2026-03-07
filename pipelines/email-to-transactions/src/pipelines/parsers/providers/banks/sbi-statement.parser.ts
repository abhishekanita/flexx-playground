// =============================================================================
// SBI e-Account Statement — PDF Text Parser
// =============================================================================
// SBI statements contain multiple savings accounts in one PDF.
// Each account has its own transaction section.
// Dates are DD-MM-YY format. Amounts have no commas.

export interface SbiTransaction {
    date: string; // YYYY-MM-DD
    description: string;
    credit: number | null;
    debit: number | null;
    balance: number;
}

export interface SbiAccount {
    accountNumber: string; // masked: XXXXXXX4051
    branchName: string;
    branchCode: string;
    ifscCode: string;
    micrCode: string;
    openingBalance: number;
    closingBalance: number;
    transactions: SbiTransaction[];
}

export interface SbiStatement {
    accountHolder: string;
    customerId: string; // masked: XXXXXXX0428
    statementDate: string; // YYYY-MM-DD (the "As on" date)
    accounts: SbiAccount[];
}

// DD-MM-YY → YYYY-MM-DD (assumes 2000s)
function parseDate(dateStr: string): string {
    const [dd, mm, yy] = dateStr.split('-');
    return `20${yy}-${mm}-${dd}`;
}

// Transaction line: "01-12-25 UPI/DR/... - - 463.06 593598.61"
// Credit line:      "03-11-25 NEFT*... - 318979.00 - 790734.21"
const TXN_RE = /^(\d{2}-\d{2}-\d{2})\s+(.*?)\s+-\s+([\d.]+|-)\s+([\d.]+|-)\s+([\d.]+)\s*$/;

const OPENING_RE = /Your Opening Balance on (\d{2}-\d{2}-\d{2}):\s*([\d.]+)/;
const CLOSING_RE = /Your Closing Balance on (\d{2}-\d{2}-\d{2}):\s*([\d.]+)/;

export function parseSbiStatement(text: string): SbiStatement {
    const lines = text.split('\n');

    // --- Top-level info ---
    let accountHolder = '';
    let customerId = '';
    let statementDate = '';

    for (const line of lines.slice(0, 40)) {
        const nameMatch = line.match(/Welcome (?:Mr\.|Mrs\.|Ms\.)?\s*(.+)/);
        if (nameMatch && !accountHolder) accountHolder = nameMatch[1].trim();

        const cidMatch = line.match(/^(XXXXXXX\w+)\s/);
        if (cidMatch && !customerId) customerId = cidMatch[1];

        const asOnMatch = line.match(/As on (\d{2}-\d{2}-\d{2})/);
        if (asOnMatch && !statementDate) statementDate = parseDate(asOnMatch[1]);
    }

    // --- Parse accounts ---
    // Split into account sections by "TRANSACTION DETAILS" + "SAVING ACCOUNT"
    const accounts: SbiAccount[] = [];
    let i = 0;

    while (i < lines.length) {
        if (lines[i].trim() === 'TRANSACTION DETAILS' && lines[i + 1]?.trim() === 'SAVING ACCOUNT') {
            const account = parseAccountSection(lines, i);
            if (account) accounts.push(account);
            i = account ? account._endIdx : i + 1;
        } else {
            i++;
        }
    }

    return { accountHolder, customerId, statementDate, accounts };
}

interface AccountParseResult extends SbiAccount {
    _endIdx: number;
}

function parseAccountSection(lines: string[], startIdx: number): AccountParseResult | null {
    // Lines after "TRANSACTION DETAILS" / "SAVING ACCOUNT":
    // XXXXXXX4051
    // Nominee Registered ...
    // Available Balance ...
    // ... header info ...
    // Date Transaction Reference Ref.No./Chq.No. Credit Debit Balance
    // null null null null null null
    // <transactions>
    // TRANSACTION OVERVIEW
    // Your Opening Balance on ...
    // Your Closing Balance on ...

    let accountNumber = '';
    let branchName = '';
    let branchCode = '';
    let ifscCode = '';
    let micrCode = '';
    let openingBalance = 0;
    let closingBalance = 0;
    let availableBalance = 0;
    const transactions: SbiTransaction[] = [];

    let i = startIdx + 2; // skip "TRANSACTION DETAILS" and "SAVING ACCOUNT"

    // Account number is the next non-empty line
    while (i < lines.length && !lines[i].trim()) i++;
    if (i < lines.length) {
        accountNumber = lines[i].trim();
        i++;
    }

    // Parse header fields and transactions
    let inTxnSection = false;

    for (; i < lines.length; i++) {
        const line = lines[i];

        // Detect next account section — stop here
        if (line.trim() === 'TRANSACTION DETAILS' && lines[i + 1]?.trim() === 'SAVING ACCOUNT') {
            break;
        }

        // Header fields
        const branchMatch = line.match(/Branch Name\s+(.+)/);
        if (branchMatch) branchName = branchMatch[1].trim();

        const bcMatch = line.match(/^(\d{4,5})\s+Branch Code/);
        if (bcMatch) branchCode = bcMatch[1];

        const micrMatch = line.match(/MICR Code\s+(\d+)/);
        if (micrMatch) micrCode = micrMatch[1];

        const ifscMatch = line.match(/^(\w+)\s+IFSC Code/);
        if (ifscMatch) ifscCode = ifscMatch[1];

        const availMatch = line.match(/Available Balance\s+([\d.]+)/);
        if (availMatch) availableBalance = parseFloat(availMatch[1]);

        // Transaction table start
        if (line.includes('Date Transaction Reference Ref.No')) {
            inTxnSection = true;
            continue;
        }

        // Skip null header row
        if (inTxnSection && line.trim() === 'null null null null null null') continue;

        // Transaction overview / end of section
        if (line.includes('TRANSACTION OVERVIEW') || line.includes('Contents of this statement')) {
            inTxnSection = false;
        }

        // Opening/closing balance
        const openMatch = line.match(OPENING_RE);
        if (openMatch) openingBalance = parseFloat(openMatch[2]);

        const closeMatch = line.match(CLOSING_RE);
        if (closeMatch) closingBalance = parseFloat(closeMatch[2]);

        // Parse transaction line
        if (inTxnSection && line.startsWith('*')) continue; // skip footnotes

        if (inTxnSection) {
            const txnMatch = line.match(TXN_RE);
            if (txnMatch) {
                transactions.push({
                    date: parseDate(txnMatch[1]),
                    description: txnMatch[2].trim(),
                    credit: txnMatch[3] === '-' ? null : parseFloat(txnMatch[3]),
                    debit: txnMatch[4] === '-' ? null : parseFloat(txnMatch[4]),
                    balance: parseFloat(txnMatch[5]),
                });
            }
        }

        // Page footer — stop parsing transactions but don't break (more pages may follow)
        if (line.includes('Visit https://sbi.co.in')) {
            inTxnSection = false;
        }
    }

    // Fallback: if no opening/closing from TRANSACTION OVERVIEW, use available balance
    if (!closingBalance && availableBalance) closingBalance = availableBalance;
    if (!openingBalance && !transactions.length && availableBalance) openingBalance = availableBalance;

    return {
        accountNumber,
        branchName,
        branchCode,
        ifscCode,
        micrCode,
        openingBalance,
        closingBalance,
        transactions,
        _endIdx: i,
    };
}
