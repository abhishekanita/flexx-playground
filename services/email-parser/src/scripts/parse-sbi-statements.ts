import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.dev') });

const CREDENTIALS_PATH = path.join(process.cwd(), 'abhishek-gmail-integration.json');
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
const userCreds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));

const SBI_PASSWORD = '38083180497'; // last 5 digits of mobile + DOB in DDMMYY

// ── Types ───────────────────────────────────────────────────────────────────

interface Transaction {
    date: string;         // DD-MM-YY
    description: string;  // Full UPI/NEFT/etc description
    referenceNo: string;  // Ref.No./Chq.No.
    credit: number;       // Amount credited
    debit: number;        // Amount debited
    balance: number;      // Running balance
    // Parsed fields
    type: 'debit' | 'credit';
    amount: number;
    channel: string;      // UPI, NEFT, IMPS, ATM, etc.
    merchant: string;     // Extracted merchant/payee name
    upiId?: string;       // UPI VPA if available
    category?: string;    // Auto-categorized
}

interface StatementData {
    bank: 'SBI';
    accountNumber: string;
    accountHolder: string;
    statementPeriod: string;
    openingBalance: number;
    closingBalance: number;
    transactions: Transaction[];
    emailDate: string;
    sourceFile: string;
}

// ── Gmail Auth ──────────────────────────────────────────────────────────────

async function getGmailService() {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_CLIENT_SECRET!,
    );
    oauth2Client.setCredentials({
        access_token: userCreds.accessToken,
        refresh_token: userCreds.refreshToken,
    });
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
    return google.gmail({ version: 'v1', auth: oauth2Client });
}

// ── Attachment helpers ──────────────────────────────────────────────────────

function findAttachments(parts: any[]): any[] {
    const attachments: any[] = [];
    if (!parts) return attachments;
    for (const part of parts) {
        if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
            attachments.push({
                filename: part.filename,
                mimeType: part.mimeType || '',
                attachmentId: part.body.attachmentId,
            });
        }
        if (part.parts) attachments.push(...findAttachments(part.parts));
    }
    return attachments;
}

// ── SBI Statement Parser ────────────────────────────────────────────────────

function parseSbiStatement(rawText: string, emailDate: string, sourceFile: string): StatementData {
    const lines = rawText.split('\n');

    // Extract account info
    const accountNumber = rawText.match(/XXXXXXX\d{4}/)?.[0] || '';
    const accountHolder = rawText.match(/(?:Welcome\s+)?(?:Mr\.|Mrs\.|Ms\.)\s+([A-Z\s]+)/)?.[1]?.trim() || '';

    const transactions: Transaction[] = [];

    // Parse opening/closing balance from -layout output
    // Format: "Balance on DD-MM-YY:   425558.97   null ..."
    const openingMatch = rawText.match(/Balance\s+on\s+(\d{2}-\d{2}-\d{2}):\s+([\d,]+\.\d{2})/);
    const closingMatch = rawText.match(/Closing\s+Balance\s+on\s+(\d{2}-\d{2}-\d{2}):\s+([\d,]+\.\d{2})/);

    const openingBalance = openingMatch ? parseFloat(openingMatch[2].replace(/,/g, '')) : 0;
    const closingBalance = closingMatch ? parseFloat(closingMatch[2].replace(/,/g, '')) : 0;

    const statementPeriod = openingMatch && closingMatch
        ? `${openingMatch[1]} to ${closingMatch[1]}`
        : emailDate;

    // With -layout flag, each transaction is on one line:
    // DD-MM-YY    Description    -    Credit    Debit    Balance
    // Credit/Debit can be a number, '0', or '-'
    const txnLineRegex = /^\s*(\d{2}-\d{2}-\d{2})\s{2,}(.+?)\s{2,}-\s{2,}([\d,]+\.\d{2}|-|0)\s{2,}([\d,]+\.\d{2}|-|0)\s{2,}([\d,]+\.\d{2})\s*$/;

    for (const line of lines) {
        const match = line.match(txnLineRegex);
        if (!match) continue;

        const [, date, rawDesc, creditStr, debitStr, balanceStr] = match;
        const description = rawDesc.trim();

        const credit = (creditStr === '-' || creditStr === '0')
            ? 0 : parseFloat(creditStr.replace(/,/g, ''));
        const debit = (debitStr === '-' || debitStr === '0')
            ? 0 : parseFloat(debitStr.replace(/,/g, ''));
        const balance = parseFloat(balanceStr.replace(/,/g, ''));

        const parsed = parseDescription(description);

        transactions.push({
            date,
            description,
            referenceNo: '',
            credit,
            debit,
            balance,
            type: credit > 0 ? 'credit' : 'debit',
            amount: credit > 0 ? credit : debit,
            channel: parsed.channel,
            merchant: parsed.merchant,
            upiId: parsed.upiId,
            category: parsed.category,
        });
    }

    return {
        bank: 'SBI',
        accountNumber,
        accountHolder,
        statementPeriod,
        openingBalance,
        closingBalance,
        transactions,
        emailDate,
        sourceFile,
    };
}

// ── Description Parser ──────────────────────────────────────────────────────

function parseDescription(desc: string): {
    channel: string;
    merchant: string;
    upiId?: string;
    category?: string;
} {
    const d = desc.trim();

    // UPI transaction
    const upiMatch = d.match(/^UPI\/(DR|CR)\/(\d+)\/(.+?)\/([A-Z]{4})\/(.+?)\/(.+)$/);
    if (upiMatch) {
        const [, type, ref, merchantName, bankCode, upiId, purpose] = upiMatch;
        return {
            channel: 'UPI',
            merchant: merchantName.trim(),
            upiId: upiId.trim(),
            category: categorize(merchantName, purpose),
        };
    }

    // UPI LITE
    if (d.includes('UPILITE')) {
        return { channel: 'UPI LITE', merchant: 'UPI Lite Top-up', category: 'UPI Lite' };
    }

    // NEFT
    if (d.startsWith('NEFT')) {
        const neftMatch = d.match(/NEFT\/(.+?)\/(.+)/);
        return {
            channel: 'NEFT',
            merchant: neftMatch ? neftMatch[2].trim() : d,
            category: 'Transfer',
        };
    }

    // IMPS
    if (d.startsWith('IMPS')) {
        return { channel: 'IMPS', merchant: d, category: 'Transfer' };
    }

    // ATM
    if (d.includes('ATM') || d.includes('CASH WITHDRAWAL')) {
        return { channel: 'ATM', merchant: 'ATM Withdrawal', category: 'Cash' };
    }

    // Interest
    if (d.includes('INT.PD') || d.includes('INTEREST')) {
        return { channel: 'BANK', merchant: 'Interest', category: 'Interest' };
    }

    return { channel: 'OTHER', merchant: d, category: 'Other' };
}

// ── Category ────────────────────────────────────────────────────────────────

function categorize(merchant: string, purpose: string): string {
    const m = (merchant + ' ' + purpose).toLowerCase();

    if (m.includes('swiggy') || m.includes('zomato') || m.includes('bistro') || m.includes('kfc') || m.includes('yum yum'))
        return 'Food & Dining';
    if (m.includes('blinkit') || m.includes('bigbasket') || m.includes('1mg') || m.includes('tata'))
        return 'Groceries & Essentials';
    if (m.includes('amazon') || m.includes('flipkart') || m.includes('myntra'))
        return 'Shopping';
    if (m.includes('netflix') || m.includes('spotify') || m.includes('apple') || m.includes('youtube') || m.includes('hotstar'))
        return 'Subscriptions';
    if (m.includes('airtel') || m.includes('jio') || m.includes('vodafone') || m.includes('prepaid') || m.includes('bill'))
        return 'Bills & Recharges';
    if (m.includes('uber') || m.includes('ola') || m.includes('rapido') || m.includes('metro'))
        return 'Transport';
    if (m.includes('refund') || m.includes('cashback'))
        return 'Refund';
    if (m.includes('payment') || m.includes('transfer'))
        return 'Transfer';

    return 'Other';
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  SBI Bank Statement Parser');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

    const gmail = await getGmailService();

    // Fetch SBI statement emails
    const queries = [
        'from:cbssbi.cas@alerts.sbi.co.in has:attachment',
        'from:cbssbi.cas@alerts.sbi.bank.in has:attachment',
    ];

    const allStatements: StatementData[] = [];
    const processedIds = new Set<string>();

    for (const query of queries) {
        const listRes = await gmail.users.messages.list({
            userId: 'me', q: query, maxResults: 10,
        });

        const messages = listRes.data.messages || [];

        for (const msg of messages) {
            if (processedIds.has(msg.id)) continue;
            processedIds.add(msg.id);

            const detail = await gmail.users.messages.get({
                userId: 'me', id: msg.id, format: 'full',
            });

            const headers = detail.data.payload?.headers || [];
            const date = headers.find((h: any) => h.name === 'Date')?.value || '';

            const parts = detail.data.payload?.parts || [];
            const attachments = findAttachments(parts);
            const pdfAttachments = attachments.filter(
                (a: any) => a.filename.toLowerCase().endsWith('.pdf'),
            );

            for (const att of pdfAttachments) {
                try {
                    // Download
                    const response = await gmail.users.messages.attachments.get({
                        userId: 'me', messageId: msg.id, id: att.attachmentId,
                    });
                    const buffer = Buffer.from(response.data.data, 'base64');
                    const filename = `sbi_${att.filename}`.replace(/[^a-zA-Z0-9._-]/g, '_');
                    const filePath = path.join(DOWNLOADS_DIR, filename);
                    fs.writeFileSync(filePath, buffer);

                    // Decrypt
                    const decryptedPath = filePath.replace(/\.pdf$/i, '_decrypted.pdf');
                    try {
                        execSync(`qpdf --password="${SBI_PASSWORD}" --decrypt "${filePath}" "${decryptedPath}" 2>&1`);
                    } catch {
                        console.log(`  ⚠️  Could not decrypt ${filename}`);
                        continue;
                    }

                    // Extract text with pdftotext -layout to preserve column alignment
                    const rawText = execSync(`pdftotext -layout "${decryptedPath}" -`).toString();

                    // Parse
                    const statement = parseSbiStatement(rawText, date, filename);
                    allStatements.push(statement);

                    console.log(`\n📄 ${filename}`);
                    console.log(`   Period: ${statement.statementPeriod}`);
                    console.log(`   Account: ${statement.accountNumber}`);
                    console.log(`   Opening: ₹${statement.openingBalance.toLocaleString()}`);
                    console.log(`   Closing: ₹${statement.closingBalance.toLocaleString()}`);
                    console.log(`   Transactions: ${statement.transactions.length}`);

                    // Print transaction table
                    if (statement.transactions.length > 0) {
                        console.log(`\n   ${'Date'.padEnd(10)} ${'Type'.padEnd(7)} ${'Amount'.padStart(10)} ${'Channel'.padEnd(10)} ${'Merchant'.padEnd(25)} ${'Category'.padEnd(20)}`);
                        console.log(`   ${'-'.repeat(90)}`);
                        for (const txn of statement.transactions) {
                            console.log(
                                `   ${txn.date.padEnd(10)} ${txn.type.padEnd(7)} ${('₹' + txn.amount.toLocaleString()).padStart(10)} ${txn.channel.padEnd(10)} ${txn.merchant.substring(0, 25).padEnd(25)} ${(txn.category || '').padEnd(20)}`,
                            );
                        }

                        // Summary
                        const totalDebit = statement.transactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
                        const totalCredit = statement.transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
                        console.log(`\n   Total Debits:  ₹${totalDebit.toLocaleString()}`);
                        console.log(`   Total Credits: ₹${totalCredit.toLocaleString()}`);

                        // Category breakdown
                        const categoryMap = new Map<string, number>();
                        for (const txn of statement.transactions.filter(t => t.type === 'debit')) {
                            const cat = txn.category || 'Other';
                            categoryMap.set(cat, (categoryMap.get(cat) || 0) + txn.amount);
                        }
                        console.log(`\n   📊 Spending by Category:`);
                        const sorted = [...categoryMap.entries()].sort((a, b) => b[1] - a[1]);
                        for (const [cat, amount] of sorted) {
                            console.log(`      ${cat.padEnd(25)} ₹${amount.toLocaleString()}`);
                        }
                    }
                } catch (err: any) {
                    console.log(`  ❌ Error: ${err.message}`);
                }
            }
        }
    }

    // Save all parsed data
    const outputPath = path.join(DOWNLOADS_DIR, 'sbi-statements-parsed.json');
    fs.writeFileSync(outputPath, JSON.stringify(allStatements, null, 2));

    console.log(`\n\n═══════════════════════════════════════════════════════════`);
    console.log(`  Total statements parsed: ${allStatements.length}`);
    console.log(`  Output: ${outputPath}`);
    console.log('═══════════════════════════════════════════════════════════');
}

main().catch(console.error);
