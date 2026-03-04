import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { gmailPlugin } from '@/plugins/gmail.plugin';
import type { PdfTemplateExtraction } from '@/types/parser.types';
import type { ParsedStatementTransaction, TransactionType } from '@/types/financial.types';

export interface PdfExtractionResult {
    accountNumber?: string;
    accountHolder?: string;
    statementPeriod?: { from: string; to: string };
    openingBalance?: number;
    closingBalance?: number;
    transactions: ParsedStatementTransaction[];
    errors: string[];
}

export class PdfExtractor {
    /**
     * Download PDF attachment from Gmail, decrypt, extract text, parse transactions.
     * Ported from parse-sbi-statements.ts and parse-kotak-statements.ts.
     */
    async extractFromAttachment(
        accessToken: string,
        refreshToken: string,
        messageId: string,
        attachmentId: string,
        filename: string,
        pdfConfig: PdfTemplateExtraction
    ): Promise<PdfExtractionResult> {
        const errors: string[] = [];
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gmail-pdf-'));

        try {
            // Download attachment
            const buffer = await gmailPlugin.downloadAttachment(
                accessToken,
                refreshToken,
                messageId,
                attachmentId
            );

            const encryptedPath = path.join(tmpDir, filename);
            const decryptedPath = path.join(tmpDir, `decrypted-${filename}`);
            const textPath = path.join(tmpDir, 'extracted.txt');

            fs.writeFileSync(encryptedPath, buffer);

            // Try to decrypt with qpdf
            let sourcePath = encryptedPath;
            if (pdfConfig.passwordEnvVar) {
                const password = process.env[pdfConfig.passwordEnvVar];
                if (password) {
                    try {
                        execSync(`qpdf --password="${password}" --decrypt "${encryptedPath}" "${decryptedPath}"`, {
                            stdio: 'pipe',
                        });
                        sourcePath = decryptedPath;
                    } catch {
                        // Try without password (some statements aren't encrypted)
                        try {
                            execSync(`qpdf --decrypt "${encryptedPath}" "${decryptedPath}"`, { stdio: 'pipe' });
                            sourcePath = decryptedPath;
                        } catch {
                            errors.push('PDF decryption failed, trying direct extraction');
                        }
                    }
                }
            }

            // Extract text with pdftotext
            try {
                execSync(`pdftotext -layout "${sourcePath}" "${textPath}"`, { stdio: 'pipe' });
            } catch {
                errors.push('pdftotext extraction failed');
                return { transactions: [], errors };
            }

            const text = fs.readFileSync(textPath, 'utf-8');

            // Parse transactions using config regex
            return this.parseStatementText(text, pdfConfig, errors);
        } finally {
            // Cleanup temp dir
            try {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            } catch {}
        }
    }

    /**
     * Parse extracted PDF text using config-driven regex patterns.
     */
    private parseStatementText(
        text: string,
        config: PdfTemplateExtraction,
        errors: string[]
    ): PdfExtractionResult {
        const lines = text.split('\n');
        const transactions: ParsedStatementTransaction[] = [];
        const txnRegex = new RegExp(config.transactionRegex, 'gm');

        let accountNumber: string | undefined;
        let openingBalance: number | undefined;
        let closingBalance: number | undefined;

        // Try to extract account number
        const accMatch = text.match(/(?:Account|A\/C|Acct)[\s.:]*(\d[\d\s-]{5,})/i);
        if (accMatch) accountNumber = accMatch[1].replace(/\s/g, '');

        // Extract transactions line by line
        for (const line of lines) {
            const match = line.match(txnRegex);
            if (!match) {
                txnRegex.lastIndex = 0; // Reset regex for next line
                continue;
            }
            txnRegex.lastIndex = 0;

            // Re-run to get capture groups
            const groups = new RegExp(config.transactionRegex).exec(line);
            if (!groups) continue;

            try {
                const dateStr = groups[1];
                const description = (groups[2] || '').trim();

                // Parse amounts from named positions or groups
                let debit = 0;
                let credit = 0;
                let balance = 0;

                // Try to extract debit/credit/balance from remaining groups
                const amounts = line.match(/[\d,]+\.\d{2}/g) || [];
                if (amounts.length >= 3) {
                    // Typical: debit, credit, balance (one of debit/credit is blank)
                    const a1 = parseFloat(amounts[amounts.length - 3]?.replace(/,/g, '') || '0');
                    const a2 = parseFloat(amounts[amounts.length - 2]?.replace(/,/g, '') || '0');
                    balance = parseFloat(amounts[amounts.length - 1]?.replace(/,/g, '') || '0');

                    if (a1 > 0 && a2 === 0) {
                        debit = a1;
                    } else if (a1 === 0 && a2 > 0) {
                        credit = a2;
                    } else if (a1 > 0) {
                        debit = a1;
                        credit = a2;
                    }
                } else if (amounts.length >= 1) {
                    const amt = parseFloat(amounts[amounts.length - 1]?.replace(/,/g, '') || '0');
                    // Determine type from description keywords
                    if (/credit|deposit|refund|interest/i.test(description)) {
                        credit = amt;
                    } else {
                        debit = amt;
                    }
                }

                const type: TransactionType = credit > 0 ? 'credit' : 'debit';
                const amount = type === 'credit' ? credit : debit;

                if (amount > 0) {
                    const date = this.parseDate(dateStr, config.dateFormat);
                    const { channel, merchant } = this.parseDescription(description, config.descriptionParser);

                    transactions.push({
                        date,
                        description,
                        amount,
                        type,
                        balance: balance || undefined,
                        channel: channel as any,
                        merchant,
                        synced: false,
                    });
                }
            } catch (err: any) {
                errors.push(`Failed to parse line: ${err.message}`);
            }
        }

        // Try to detect opening/closing balances
        const balanceMatch = text.match(/(?:Opening|Beginning)\s*Balance[:\s]*([\d,]+\.\d{2})/i);
        if (balanceMatch) openingBalance = parseFloat(balanceMatch[1].replace(/,/g, ''));

        const closingMatch = text.match(/(?:Closing|Ending)\s*Balance[:\s]*([\d,]+\.\d{2})/i);
        if (closingMatch) closingBalance = parseFloat(closingMatch[1].replace(/,/g, ''));

        return { accountNumber, openingBalance, closingBalance, transactions, errors };
    }

    private parseDate(dateStr: string, format: string): Date {
        switch (format) {
            case 'DD-MM-YY': {
                const [d, m, y] = dateStr.split('-').map(Number);
                return new Date(2000 + y, m - 1, d);
            }
            case 'DD Mon YYYY': {
                const parts = dateStr.replace(',', '').split(/\s+/);
                const day = parseInt(parts[0]);
                const month = this.monthToNum(parts[1]);
                const year = parseInt(parts[2]);
                return new Date(year, month - 1, day);
                }
            case 'DD/MM/YYYY': {
                const [d, m, y] = dateStr.split('/').map(Number);
                return new Date(y, m - 1, d);
            }
            default:
                return new Date(dateStr);
        }
    }

    private parseDescription(
        desc: string,
        parserName: string
    ): { channel?: string; merchant?: string } {
        // UPI pattern: UPI/(DR|CR)/ref/merchant/bank/upiId
        const upiMatch = desc.match(/UPI\/(DR|CR)\/\d+\/([^/]+)/i);
        if (upiMatch) {
            return { channel: 'UPI', merchant: upiMatch[2].trim() };
        }

        if (/UPI LITE/i.test(desc)) return { channel: 'UPI', merchant: 'UPI Lite Top-up' };
        if (/^NEFT/i.test(desc)) return { channel: 'NEFT', merchant: desc.replace(/^NEFT[^/]*\//, '').trim() };
        if (/^IMPS/i.test(desc)) return { channel: 'IMPS', merchant: desc.replace(/^IMPS[^/]*\//, '').trim() };
        if (/^RTGS/i.test(desc)) return { channel: 'RTGS' };
        if (/ATM/i.test(desc)) return { channel: 'ATM' };
        if (/INTEREST/i.test(desc)) return { channel: 'OTHER', merchant: 'Interest' };

        return { channel: 'OTHER' };
    }

    private monthToNum(month: string): number {
        const map: Record<string, number> = {
            jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
            jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
        };
        return map[month.toLowerCase().substring(0, 3)] || 1;
    }
}

export const pdfExtractor = new PdfExtractor();
