// =============================================================================
// Paytm Statement — Excel (XLSX) Parser
// =============================================================================
// Parses monthly statement emails from no-reply@paytm.com
// Uses the "Passbook Payment History" sheet which has individual transactions.
// Columns: Date, Time, Transaction Details, Other Transaction Details (UPI ID),
//          Your Account, Amount, UPI Ref No., Order ID, Remarks, Tags, Comment

import * as XLSX from 'xlsx';

export interface PaytmTransaction {
    date: string;           // "21/02/2026"
    time: string;           // "16:43:58"
    description: string;
    counterparty: string;   // UPI ID or A/c No
    account: string;        // "State Bank Of India - 51"
    amount: number;         // negative = paid, positive = received
    upiRefNo: string;
    orderId: string;
    remarks: string;
    tags: string;
}

export interface PaytmStatement {
    period: string;         // "1 FEB'26 - 28 FEB'26"
    accountHolder: string;
    phone: string;
    email: string;
    totalPaid: number;
    totalReceived: number;
    paidCount: number;
    receivedCount: number;
    transactions: PaytmTransaction[];
}

function parseAmount(str: string): number {
    if (!str) return 0;
    const cleaned = String(str).replace(/[₹,\s]/g, '');
    return parseFloat(cleaned) || 0;
}

export function parsePaytmStatement(buffer: Buffer): PaytmStatement {
    const wb = XLSX.read(buffer, { type: 'buffer' });

    // Summary sheet
    const summary = XLSX.utils.sheet_to_json<any[]>(wb.Sheets['Summary'], { header: 1 });
    const accountHolder = String(summary[4]?.[0] || '').trim();
    const phone = String(summary[5]?.[0] || '').trim();
    const email = String(summary[6]?.[0] || '').trim();
    const period = String(summary[8]?.[1] || '').trim();
    const totalPaid = parseAmount(summary[9]?.[1]);
    const paidCount = parseInt(summary[10]?.[1]) || 0;
    const totalReceived = parseAmount(summary[11]?.[1]);
    const receivedCount = parseInt(summary[12]?.[1]) || 0;

    // Passbook Payment History sheet
    const passbook = XLSX.utils.sheet_to_json<any[]>(wb.Sheets['Passbook Payment History'], { header: 1 });
    const transactions: PaytmTransaction[] = [];

    // Row 0 is header, data starts from row 1
    for (let i = 1; i < passbook.length; i++) {
        const row = passbook[i];
        if (!row || !row[0]) continue;

        transactions.push({
            date: String(row[0] || ''),
            time: String(row[1] || ''),
            description: String(row[2] || ''),
            counterparty: String(row[3] || ''),
            account: String(row[4] || ''),
            amount: parseAmount(row[5]),
            upiRefNo: String(row[6] || ''),
            orderId: String(row[7] || ''),
            remarks: String(row[8] || ''),
            tags: String(row[9] || ''),
        });
    }

    return {
        period,
        accountHolder,
        phone,
        email,
        totalPaid,
        totalReceived,
        paidCount,
        receivedCount,
        transactions,
    };
}
