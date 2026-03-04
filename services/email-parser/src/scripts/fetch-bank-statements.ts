import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import pdf from 'pdf-parse';

// ── Config ──────────────────────────────────────────────────────────────────
const CREDENTIALS_PATH = path.join(process.cwd(), 'abhishek-gmail-integration.json');
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
const ENV_PATH = path.join(process.cwd(), '.env.dev');

import * as dotenv from 'dotenv';
dotenv.config({ path: ENV_PATH });

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const userCreds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));

// Password candidates for PDF decryption
const DOB = '18041997';
const PASSWORD_CANDIDATES: Record<string, string[]> = {
    kotak: [
        DOB, '18-04-1997', '18/04/1997', '7838237658',
        '18Apr1997', '1997', 'ABHI' + DOB, 'abhi' + DOB,
        'ABHISHEK', 'abhishek',
    ],
    sbi: [
        DOB, '18-04-1997', '18/04/1997', '9814838083',
        '18Apr1997', '1997', 'ABHI' + DOB, 'abhi' + DOB,
        'ABHISHEK', 'abhishek',
    ],
};

// ── Gmail Auth ──────────────────────────────────────────────────────────────

async function getGmailService() {
    const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
    oauth2Client.setCredentials({
        access_token: userCreds.accessToken,
        refresh_token: userCreds.refreshToken,
    });

    try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
        console.log('✓ Token refreshed');
    } catch (err: any) {
        console.log('Token refresh failed, using existing...', err.message);
    }

    return google.gmail({ version: 'v1', auth: oauth2Client });
}

// ── Recursively find attachments in email parts ─────────────────────────────

interface AttachmentInfo {
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
}

function findAttachments(parts: any[]): AttachmentInfo[] {
    const attachments: AttachmentInfo[] = [];
    if (!parts) return attachments;

    for (const part of parts) {
        if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
            attachments.push({
                filename: part.filename,
                mimeType: part.mimeType || '',
                size: part.body.size || 0,
                attachmentId: part.body.attachmentId,
            });
        }
        // Recurse into nested parts
        if (part.parts) {
            attachments.push(...findAttachments(part.parts));
        }
    }
    return attachments;
}

// ── Download Attachment ─────────────────────────────────────────────────────

async function downloadAttachment(
    gmail: any, messageId: string, attachment: AttachmentInfo, prefix: string,
): Promise<string> {
    const response = await gmail.users.messages.attachments.get({
        userId: 'me', messageId, id: attachment.attachmentId,
    });

    const buffer = Buffer.from(response.data.data, 'base64');
    const sanitized = `${prefix}_${attachment.filename}`.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(DOWNLOADS_DIR, sanitized);
    fs.writeFileSync(filePath, buffer);

    console.log(`   📥 Downloaded: ${sanitized} (${(buffer.length / 1024).toFixed(1)} KB)`);
    return filePath;
}

// ── Decrypt PDF ─────────────────────────────────────────────────────────────

function decryptPdf(inputPath: string, bank: string): string | null {
    const outputPath = inputPath.replace(/\.pdf$/i, '_decrypted.pdf');
    const candidates = PASSWORD_CANDIDATES[bank] || [
        ...PASSWORD_CANDIDATES.sbi, ...PASSWORD_CANDIDATES.kotak,
    ];

    for (const password of candidates) {
        try {
            execSync(`qpdf --password="${password}" --decrypt "${inputPath}" "${outputPath}" 2>&1`);
            console.log(`   🔓 Decrypted with password: "${password}"`);
            return outputPath;
        } catch {
            // wrong password
        }
    }

    // Try without password
    try {
        execSync(`qpdf --decrypt "${inputPath}" "${outputPath}" 2>&1`);
        console.log(`   🔓 Not password-protected`);
        return outputPath;
    } catch {}

    console.log(`   ❌ Could not decrypt with any known password`);
    return null;
}

// ── Parse PDF ───────────────────────────────────────────────────────────────

async function parsePdf(filePath: string): Promise<string> {
    const buffer = fs.readFileSync(filePath);
    const data = await pdf(buffer);
    console.log(`   📄 ${data.numpages} pages, ${data.text.length} chars`);
    return data.text;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Gmail Bank Statement Extractor - SBI & Kotak');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

    const gmail = await getGmailService();

    // Target specific bank statement senders and search with attachment filter
    const searches = [
        { bank: 'sbi', query: 'from:cbssbi.cas@alerts.sbi.co.in has:attachment', label: 'SBI E-Statements (sbi.co.in)' },
        { bank: 'sbi', query: 'from:cbssbi.cas@alerts.sbi.bank.in has:attachment', label: 'SBI E-Statements (sbi.bank.in)' },
        { bank: 'sbi', query: 'from:sbi subject:statement has:attachment', label: 'SBI other statements' },
        { bank: 'kotak', query: 'from:BankStatements@kotak.bank.in has:attachment', label: 'Kotak Statements (bank.in)' },
        { bank: 'kotak', query: 'from:BankStatements@kotak.com has:attachment', label: 'Kotak Statements (kotak.com)' },
        { bank: 'cams', query: 'from:donotreply@camsonline.com subject:statement has:attachment', label: 'CAMS MF Statements' },
    ];

    const allResults: any[] = [];
    const processedIds = new Set<string>();

    for (const search of searches) {
        console.log(`\n── ${search.label} ──`);
        console.log(`   Query: ${search.query}\n`);

        try {
            const listRes = await gmail.users.messages.list({
                userId: 'me', q: search.query, maxResults: 5,
            });

            const messages = listRes.data.messages || [];
            console.log(`   Found ${messages.length} emails\n`);

            for (const msg of messages) {
                if (processedIds.has(msg.id)) continue;
                processedIds.add(msg.id);

                // Get FULL message to see parts/attachments
                const detail = await gmail.users.messages.get({
                    userId: 'me', id: msg.id, format: 'full',
                });

                const headers = detail.data.payload?.headers || [];
                const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
                const from = headers.find((h: any) => h.name === 'From')?.value || '';
                const date = headers.find((h: any) => h.name === 'Date')?.value || '';

                // Find all attachments recursively
                const parts = detail.data.payload?.parts || [];
                const attachments = findAttachments(parts);

                // Also check top-level payload (single-part emails)
                if (detail.data.payload?.filename && detail.data.payload?.body?.attachmentId) {
                    attachments.push({
                        filename: detail.data.payload.filename,
                        mimeType: detail.data.payload.mimeType || '',
                        size: detail.data.payload.body.size || 0,
                        attachmentId: detail.data.payload.body.attachmentId,
                    });
                }

                const pdfAttachments = attachments.filter(
                    a => a.mimeType === 'application/pdf' ||
                         a.filename.toLowerCase().endsWith('.pdf'),
                );

                console.log(`   📧 ${subject}`);
                console.log(`      From: ${from}`);
                console.log(`      Date: ${date}`);
                console.log(`      Attachments: ${attachments.length} total, ${pdfAttachments.length} PDFs`);
                if (attachments.length > 0) {
                    console.log(`      Files: ${attachments.map(a => `${a.filename} (${a.mimeType})`).join(', ')}`);
                }

                // Download and process PDFs
                for (const att of pdfAttachments) {
                    try {
                        const downloaded = await downloadAttachment(gmail, msg.id, att, search.bank);
                        const decrypted = decryptPdf(downloaded, search.bank);
                        const pdfPath = decrypted || downloaded;

                        try {
                            const text = await parsePdf(pdfPath);

                            // Print first 2000 chars to understand the format
                            console.log(`\n   ── PDF Content Preview ──`);
                            console.log(text.substring(0, 2000));
                            console.log(`   ── End Preview ──\n`);

                            allResults.push({
                                bank: search.bank,
                                subject,
                                from,
                                date,
                                filename: att.filename,
                                pages: text.length,
                                textPreview: text.substring(0, 3000),
                                fullText: text,
                            });
                        } catch (parseErr: any) {
                            console.log(`      ⚠️ Parse failed: ${parseErr.message}`);
                        }
                    } catch (dlErr: any) {
                        console.log(`      ❌ Download failed: ${dlErr.message}`);
                    }
                }
                console.log();
            }
        } catch (err: any) {
            console.log(`   ⚠️ Search failed: ${err.message}`);
        }
    }

    // Save results
    const outputPath = path.join(DOWNLOADS_DIR, 'extraction-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(
        allResults.map(r => ({ ...r, fullText: r.fullText?.substring(0, 10000) })),
        null, 2,
    ));

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`  Done! Processed ${allResults.length} PDFs`);
    console.log(`  Results: ${outputPath}`);
    console.log('═══════════════════════════════════════════════════════════');
}

main().catch(console.error);
