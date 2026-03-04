import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.dev') });

const CREDENTIALS_PATH = path.join(process.cwd(), 'abhishek-gmail-integration.json');
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
const userCreds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));

// Kotak passwords: newer PDFs use name+DOB, older use CRN
const KOTAK_PASSWORDS = ['abhi1804', '662665214', 'ABHI1804', 'Abhi1804'];

// ── Types ───────────────────────────────────────────────────────────────────

interface Transaction {
    date: string;
    description: string;
    credit: number;
    debit: number;
    balance: number;
    type: 'debit' | 'credit';
    amount: number;
    channel: string;
    merchant: string;
    upiId?: string;
    category?: string;
}

interface StatementData {
    bank: 'KOTAK';
    accountNumber: string;
    accountHolder: string;
    statementPeriod: string;
    openingBalance: number;
    closingBalance: number;
    transactions: Transaction[];
    emailDate: string;
    emailSubject: string;
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

// ── Kotak CRN-format Parser (kotak.com PDFs with +/- amounts) ───────────────

function parseKotakCRNFormat(rawText: string, emailDate: string, emailSubject: string, sourceFile: string): StatementData {
    const accountNumber = rawText.match(/Account\s*#\s*(\d+)/)?.[1] || '';
    const accountHolder = rawText.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+)/m)?.[0] || '';

    const periodMatch = rawText.match(/(\d{2}\s+\w{3},\s+\d{4})\s*-\s*(\d{2}\s+\w{3},\s+\d{4})/);
    const statementPeriod = periodMatch ? `${periodMatch[1]} - ${periodMatch[2]}` : emailDate;

    let openingBalance = 0;
    let closingBalance = 0;
    const transactions: Transaction[] = [];

    const lines = rawText.split('\n');

    // CRN format: "DD Mon, YYYY  Description  Ref  -debit/+credit  balance"
    // Date: "02 Nov, 2025"
    const txnRegex = /^(\d{2}\s+\w{3},\s+\d{4})\s+(.+)$/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(txnRegex);
        if (!match) continue;

        const date = match[1];
        let rest = match[2];

        // Check for continuation on next line
        if (i + 1 < lines.length && lines[i + 1].match(/^\s{10,}\S/)) {
            rest += ' ' + lines[i + 1].trim();
            i++;
        }

        // Opening balance special case
        if (rest.includes('OPENING BALANCE')) {
            const balMatch = rest.match(/\+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/);
            if (balMatch) openingBalance = parseFloat(balMatch[2].replace(/,/g, ''));
            continue;
        }

        // Extract amounts: look for -amount or +amount patterns
        const debitMatch = rest.match(/-([\d,]+\.\d{2})/);
        const creditMatch = rest.match(/\+([\d,]+\.\d{2})/);
        const balanceMatch = [...rest.matchAll(/([\d,]+\.\d{2})/g)];

        const debit = debitMatch ? parseFloat(debitMatch[1].replace(/,/g, '')) : 0;
        const credit = creditMatch ? parseFloat(creditMatch[1].replace(/,/g, '')) : 0;
        const balance = balanceMatch.length > 0
            ? parseFloat(balanceMatch[balanceMatch.length - 1][1].replace(/,/g, ''))
            : 0;

        if (debit === 0 && credit === 0) continue;

        // Clean description - remove amounts and ref numbers
        let cleanDesc = rest
            .replace(/[-+][\d,]+\.\d{2}/g, '')
            .replace(/\s*(UPI|IMPS|NEFT|NACH|NACHDR)[-][\w]+/gi, '')
            .replace(/\s*\d{10,}TO?\s*/g, ' ')
            .replace(/\s+/g, ' ').trim();

        // Remove trailing balance number
        cleanDesc = cleanDesc.replace(/\s+[\d,]+\.\d{2}\s*$/, '').trim();

        const parsed = parseKotakDescription(cleanDesc);

        transactions.push({
            date,
            description: cleanDesc,
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

    // Extract closing balance from summary
    const closingFromSummary = rawText.match(/Closing\s+balance\s+([\d,]+\.\d{2})/);
    if (closingFromSummary) closingBalance = parseFloat(closingFromSummary[1].replace(/,/g, ''));
    else if (transactions.length > 0) closingBalance = transactions[transactions.length - 1].balance;

    return {
        bank: 'KOTAK', accountNumber, accountHolder, statementPeriod,
        openingBalance, closingBalance, transactions,
        emailDate, emailSubject, sourceFile,
    };
}

// ── Kotak Statement Parser (layout-based, newer bank.in format) ─────────────

function parseKotakStatement(rawText: string, emailDate: string, emailSubject: string, sourceFile: string): StatementData {
    // Detect format: CRN format has "+/-" signs on amounts
    if (rawText.includes('OPENING BALANCE') && rawText.match(/[-+][\d,]+\.\d{2}/)) {
        return parseKotakCRNFormat(rawText, emailDate, emailSubject, sourceFile);
    }

    // Extract account info
    const accountNumber = rawText.match(/Account\s*No\.\s*(\d+)/)?.[1] || '';
    const accountHolder = rawText.match(/^([A-Z][a-z]+\s+[A-Z][a-z]+)/m)?.[0] || '';

    const periodMatch = emailSubject.match(/Your\s+(\w+\s+\d{4})\s+statement/i);
    const statementPeriod = periodMatch ? periodMatch[1] : emailDate;

    const transactions: Transaction[] = [];
    let openingBalance = 0;
    let closingBalance = 0;

    // Use pdftotext -layout format which preserves columns
    // Columns: #  Date  Description  Chq/Ref  Withdrawal(Dr.)  Deposit(Cr.)  Balance
    const lines = rawText.split('\n');

    // Parse opening balance
    const openingLine = rawText.match(/Opening\s+Balance.*?([\d,]+\.\d{2})\s*$/m);
    if (openingLine) openingBalance = parseFloat(openingLine[1].replace(/,/g, ''));

    // Parse closing balance from account summary
    const closingSummary = rawText.match(/Closing\s+Balance\s*\n.*?Savings.*?([\d,]+\.\d{2})/s);
    if (closingSummary) closingBalance = parseFloat(closingSummary[1].replace(/,/g, ''));

    // Transaction line pattern: starts with a number (row #), then date
    // e.g., "1           01 Feb 2026   UPI/MR AKSHIT..."
    const txnLineRegex = /^\s*(\d+)\s+(\d{2}\s+\w{3}\s+\d{4})\s+(.+)$/;
    // Continuation line (indented description)
    const continuationRegex = /^\s{20,}(\S.+)$/;

    let currentTxn: {
        rowNum: number; date: string; descLines: string[]; fullLine: string;
    } | null = null;

    const parsedRows: {
        rowNum: number; date: string; description: string; fullLine: string;
    }[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const txnMatch = line.match(txnLineRegex);

        if (txnMatch) {
            // Save previous transaction
            if (currentTxn) {
                parsedRows.push({
                    rowNum: currentTxn.rowNum,
                    date: currentTxn.date,
                    description: currentTxn.descLines.join(' '),
                    fullLine: currentTxn.fullLine,
                });
            }
            currentTxn = {
                rowNum: parseInt(txnMatch[1]),
                date: txnMatch[2],
                descLines: [txnMatch[3]],
                fullLine: line,
            };
        } else if (currentTxn) {
            const contMatch = line.match(continuationRegex);
            if (contMatch) {
                currentTxn.descLines.push(contMatch[1]);
            } else if (line.trim() === '' || line.match(/^\s*(Statement Generated|Page \d|Account Statement|Savings Account|#|Date|-)/)) {
                // End of current transaction block
                parsedRows.push({
                    rowNum: currentTxn.rowNum,
                    date: currentTxn.date,
                    description: currentTxn.descLines.join(' '),
                    fullLine: currentTxn.fullLine,
                });
                currentTxn = null;
            }
        }
    }
    // Don't forget the last transaction
    if (currentTxn) {
        parsedRows.push({
            rowNum: currentTxn.rowNum,
            date: currentTxn.date,
            description: currentTxn.descLines.join(' '),
            fullLine: currentTxn.fullLine,
        });
    }

    // Now parse amounts from each row's full line
    // The layout has fixed columns - amounts appear at specific positions
    for (const row of parsedRows) {
        const fullText = row.description;

        // Extract all amounts from the line
        const amounts = [...fullText.matchAll(/([\d,]+\.\d{2})/g)].map(m => parseFloat(m[1].replace(/,/g, '')));

        if (amounts.length === 0) continue;

        // Last amount is always balance
        const balance = amounts[amounts.length - 1];
        let debit = 0, credit = 0;

        // Determine debit vs credit based on position in the fixed-width layout
        // Withdrawal column is roughly at position 60-75, Deposit at 80-95
        // But we can use a simpler heuristic: look at column positions in fullLine
        const withdrawalCol = row.fullLine.indexOf('Withdrawal') >= 0 ? row.fullLine.indexOf('Withdrawal') : -1;

        if (amounts.length >= 3) {
            // debit, credit, balance
            debit = amounts[amounts.length - 3];
            credit = amounts[amounts.length - 2];
        } else if (amounts.length === 2) {
            // Either debit+balance or credit+balance
            const amt = amounts[0];
            // Check which column the amount appears in using the original full line
            // Look for the amount string and its position
            const amtStr = amounts[0].toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            const amtStrNoComma = amounts[0].toFixed(2);

            // Find position of first amount in the full line
            const fullLine = row.fullLine;
            let amtPos = -1;
            // Try with comma formatting
            for (const fmt of [amtStr, amtStrNoComma]) {
                const pos = fullLine.lastIndexOf(fmt);
                if (pos > 0 && pos !== fullLine.lastIndexOf(balance.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','))) {
                    amtPos = pos;
                    break;
                }
            }

            // Rough heuristic: if amount position is before ~col 85, it's withdrawal
            // Actually, simpler: check description context
            const desc = fullText.toLowerCase();
            const isCreditTxn = desc.includes('sweep trf from') || desc.includes('fd premat') ||
                desc.includes('deposit') || desc.includes('proceeds') ||
                desc.includes('int.pd') || desc.includes('interest') ||
                desc.includes('refund') || desc.includes('i/w chq rtn') ||
                (desc.includes('upi/') && !desc.includes('payment from'));

            // Also check: if balance increased vs previous, it's credit
            if (isCreditTxn) {
                credit = amt;
            } else {
                debit = amt;
            }
        }

        if (debit === 0 && credit === 0) continue;

        // Clean description - remove amounts and reference numbers
        let cleanDesc = fullText;
        for (const m of fullText.matchAll(/([\d,]+\.\d{2})/g)) {
            cleanDesc = cleanDesc.replace(m[0], '');
        }
        // Remove ref numbers like UPI-603257898801, IMPS-603310926720
        cleanDesc = cleanDesc.replace(/\s*(UPI|IMPS|NEFT|NACH|FORMS|NACHDR)[-_][\d]+/gi, '');
        cleanDesc = cleanDesc.replace(/\s*\d{10,}TO?\s*/g, ' ');
        cleanDesc = cleanDesc.replace(/\s+/g, ' ').trim();

        const parsed = parseKotakDescription(cleanDesc);

        transactions.push({
            date: row.date,
            description: cleanDesc,
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

    if (!closingBalance && transactions.length > 0) {
        closingBalance = transactions[transactions.length - 1].balance;
    }

    return {
        bank: 'KOTAK',
        accountNumber,
        accountHolder,
        statementPeriod,
        openingBalance,
        closingBalance,
        transactions,
        emailDate,
        emailSubject,
        sourceFile,
    };
}

// ── Kotak Description Parser ────────────────────────────────────────────────

function parseKotakDescription(desc: string): {
    channel: string; merchant: string; upiId?: string; category?: string;
} {
    const d = desc.toLowerCase();

    if (d.includes('upi')) {
        // UPI patterns
        const upiMerchant = desc.match(/UPI[- ](.+?)(?:[-\/]|$)/i)?.[1]?.trim() || desc;
        return {
            channel: 'UPI',
            merchant: upiMerchant.substring(0, 30),
            category: categorize(d),
        };
    }
    if (d.includes('neft') || d.includes('rtgs')) {
        return { channel: d.includes('rtgs') ? 'RTGS' : 'NEFT', merchant: desc, category: 'Transfer' };
    }
    if (d.includes('imps')) {
        return { channel: 'IMPS', merchant: desc, category: 'Transfer' };
    }
    if (d.includes('atm') || d.includes('cash')) {
        return { channel: 'ATM', merchant: 'ATM/Cash', category: 'Cash' };
    }
    if (d.includes('interest')) {
        return { channel: 'BANK', merchant: 'Interest', category: 'Interest' };
    }
    if (d.includes('emi') || d.includes('loan')) {
        return { channel: 'BANK', merchant: desc, category: 'EMI/Loan' };
    }

    return { channel: 'OTHER', merchant: desc.substring(0, 40), category: categorize(d) };
}

function categorize(d: string): string {
    if (d.includes('swiggy') || d.includes('zomato') || d.includes('bistro') || d.includes('kfc'))
        return 'Food & Dining';
    if (d.includes('blinkit') || d.includes('bigbasket') || d.includes('1mg'))
        return 'Groceries';
    if (d.includes('amazon') || d.includes('flipkart') || d.includes('myntra'))
        return 'Shopping';
    if (d.includes('netflix') || d.includes('spotify') || d.includes('apple') || d.includes('youtube'))
        return 'Subscriptions';
    if (d.includes('airtel') || d.includes('jio') || d.includes('recharge') || d.includes('bill'))
        return 'Bills';
    if (d.includes('uber') || d.includes('ola') || d.includes('rapido'))
        return 'Transport';
    if (d.includes('salary') || d.includes('stipend'))
        return 'Income';
    return 'Other';
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Kotak Bank Statement Parser');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

    const gmail = await getGmailService();

    // Fetch Kotak statement emails from both senders
    const queries = [
        'from:BankStatements@kotak.bank.in has:attachment',
        'from:BankStatements@kotak.com has:attachment',
    ];

    const allStatements: StatementData[] = [];
    const processedIds = new Set<string>();
    let fileCounter = 0;

    for (const query of queries) {
        console.log(`\n🔍 Query: ${query}`);
        const listRes = await gmail.users.messages.list({
            userId: 'me', q: query, maxResults: 10,
        });

        const messages = listRes.data.messages || [];
        console.log(`   Found ${messages.length} emails\n`);

        for (const msg of messages) {
            if (processedIds.has(msg.id)) continue;
            processedIds.add(msg.id);

            const detail = await gmail.users.messages.get({
                userId: 'me', id: msg.id, format: 'full',
            });

            const headers = detail.data.payload?.headers || [];
            const date = headers.find((h: any) => h.name === 'Date')?.value || '';
            const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';

            const parts = detail.data.payload?.parts || [];
            const attachments = findAttachments(parts);
            const pdfAttachments = attachments.filter(
                (a: any) => a.filename.toLowerCase().endsWith('.pdf'),
            );

            for (const att of pdfAttachments) {
                fileCounter++;
                try {
                    // Download with unique filename
                    const response = await gmail.users.messages.attachments.get({
                        userId: 'me', messageId: msg.id, id: att.attachmentId,
                    });
                    const buffer = Buffer.from(response.data.data, 'base64');
                    const filename = `kotak_${fileCounter}_${att.filename}`.replace(/[^a-zA-Z0-9._-]/g, '_');
                    const filePath = path.join(DOWNLOADS_DIR, filename);
                    fs.writeFileSync(filePath, buffer);
                    console.log(`📥 Downloaded: ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
                    console.log(`   Subject: ${subject}`);

                    // Try to decrypt with each password
                    const decryptedPath = filePath.replace(/\.pdf$/i, '_decrypted.pdf');
                    let decrypted = false;

                    for (const password of KOTAK_PASSWORDS) {
                        try {
                            execSync(`qpdf --password="${password}" --decrypt "${filePath}" "${decryptedPath}" 2>&1`);
                            console.log(`   🔓 Decrypted with: ${password}`);
                            decrypted = true;
                            break;
                        } catch {}
                    }

                    if (!decrypted) {
                        // Try without password
                        try {
                            execSync(`qpdf --decrypt "${filePath}" "${decryptedPath}" 2>&1`);
                            console.log(`   🔓 Not encrypted`);
                            decrypted = true;
                        } catch {
                            console.log(`   ❌ Could not decrypt`);
                            continue;
                        }
                    }

                    // Extract text with layout preservation
                    const rawText = execSync(`pdftotext -layout "${decryptedPath}" -`).toString();

                    // Parse
                    const statement = parseKotakStatement(rawText, date, subject, filename);
                    allStatements.push(statement);

                    console.log(`   Period: ${statement.statementPeriod}`);
                    console.log(`   Transactions: ${statement.transactions.length}`);

                    if (statement.transactions.length > 0) {
                        console.log(`\n   ${'Date'.padEnd(12)} ${'Type'.padEnd(7)} ${'Amount'.padStart(12)} ${'Channel'.padEnd(8)} ${'Merchant'.padEnd(30)} ${'Category'.padEnd(15)}`);
                        console.log(`   ${'-'.repeat(90)}`);
                        for (const txn of statement.transactions) {
                            console.log(
                                `   ${txn.date.padEnd(12)} ${txn.type.padEnd(7)} ${('₹' + txn.amount.toLocaleString()).padStart(12)} ${txn.channel.padEnd(8)} ${txn.merchant.substring(0, 30).padEnd(30)} ${(txn.category || '').padEnd(15)}`,
                            );
                        }

                        const totalDebit = statement.transactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
                        const totalCredit = statement.transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
                        console.log(`\n   Total Debits:  ₹${totalDebit.toLocaleString()}`);
                        console.log(`   Total Credits: ₹${totalCredit.toLocaleString()}`);
                    }
                } catch (err: any) {
                    console.log(`   ❌ Error: ${err.message}`);
                }
                console.log();
            }
        }
    }

    // Save results
    const outputPath = path.join(DOWNLOADS_DIR, 'kotak-statements-parsed.json');
    fs.writeFileSync(outputPath, JSON.stringify(allStatements, null, 2));

    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`  Total statements parsed: ${allStatements.length}`);
    console.log(`  Output: ${outputPath}`);
    console.log('═══════════════════════════════════════════════════════════');
}

main().catch(console.error);
