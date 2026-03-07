// =============================================================================
// PhonePe Transaction Statement — Encrypted PDF Parser
// =============================================================================
// Parses transaction statement PDFs from noreply@phonepe.com
// PDF is password-protected (phone number).
// Each transaction block:
//   Date line:  "Apr 14, 2023"
//   Time line:  "10:32 PM"
//   Payee:      "Paid to WAJID" or "Received from ..."
//   Txn ID:     "Transaction ID : T2304142232310070984529"
//   UTR:        "UTR No : 310471833499"
//   Account:    "Paid by XX4051" or "Credited to XX4051"
//   Type:       "Debit" or "Credit"
//   Amount:     "INR 1500.00"

export interface PhonePeTransaction {
    date: string;           // "Apr 14, 2023"
    time: string;           // "10:32 PM"
    payee: string;          // "WAJID", "Swiggy", etc.
    direction: 'paid' | 'received';
    transactionId: string;
    utrNo: string;
    account: string;        // "XX4051", "XX9778"
    type: 'Debit' | 'Credit';
    amount: number;
}

export interface PhonePeStatement {
    phone: string;
    period: string;         // "Apr 01, 2023 - Mar 31, 2024"
    transactions: PhonePeTransaction[];
    totalPages: number;
}

export function parsePhonePeStatement(text: string): PhonePeStatement {
    // Header: "Transaction Statement for +917838237658"
    const phoneMatch = text.match(/Transaction Statement for \+91(\d+)/);
    const phone = phoneMatch?.[1] || '';

    // Period: "Apr 01, 2023 - Mar 31, 2024"
    const periodMatch = text.match(/(\w{3} \d{2}, \d{4}) - (\w{3} \d{2}, \d{4})/);
    const period = periodMatch ? `${periodMatch[1]} - ${periodMatch[2]}` : '';

    // Count pages
    const pageMatches = text.match(/Page \d+ of (\d+)/g);
    const totalPages = pageMatches ? parseInt(pageMatches[0].match(/of (\d+)/)?.[1] || '0') : 0;

    const transactions: PhonePeTransaction[] = [];

    // Split into transaction blocks using the date pattern
    // Each transaction starts with a date like "Apr 14, 2023" followed by time on next line
    const txnPattern = /([A-Z][a-z]{2} \d{1,2}, \d{4})\s+(\d{1,2}:\d{2} [AP]M)\s+(Paid to|Received from)\s+(.+?)\s+Transaction ID : (\S+)\s+UTR No : (\S+)\s+(Paid by|Credited to) (XX\d+)\s+(Debit|Credit)\s+INR\s*([\d,.]+)/g;

    let match;
    while ((match = txnPattern.exec(text)) !== null) {
        transactions.push({
            date: match[1],
            time: match[2],
            direction: match[3].startsWith('Paid') ? 'paid' : 'received',
            payee: match[4].trim(),
            transactionId: match[5],
            utrNo: match[6],
            account: match[8],
            type: match[9] as 'Debit' | 'Credit',
            amount: parseFloat(match[10].replace(/,/g, '')) || 0,
        });
    }

    return { phone, period, transactions, totalPages };
}
