import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

const USER_ID = '69ad593fb3726a47dec36515';

const PROVIDERS = [
    // Zerodha alerts - coin orders, demat charges
    { name: 'zerodha-alerts', from: 'alerts@mailer.zerodha.com' },
    // KFintech MF valuations
    { name: 'kfintech-valuations', from: 'mfservice@kfintech.com' },
    { name: 'kfintech-valuations-2', from: 'kfpl.mfservice@kfintech.com' },
    // NSDL CAS (PDF based)
    { name: 'nsdl-cas', from: 'nsdl-cas@nsdl.co.in' },
    // Zerodha weekly equity (PDF)
    { name: 'zerodha-equity', from: 'no-reply-account-statement@reportsmailer.zerodha.net' },
    // Zerodha demat holdings (PDF)
    { name: 'zerodha-demat', from: 'no-reply-transaction-with-holding-statement@reportsmailer.zerodha.net' },
    // INDmoney (PDF)
    { name: 'indmoney', from: 'statements@transactions.indmoney.com' },
    // BSE (PDF)
    { name: 'bse', from: 'info@bseindia.in' },
];

async function main() {
    await databaseLoader();

    const outBase = path.join(process.cwd(), 'output', 'investment-samples');
    fs.mkdirSync(outBase, { recursive: true });

    for (const p of PROVIDERS) {
        const emails = await rawEmailsService.find({ userId: USER_ID, fromAddress: p.from });
        console.log(`\n=== ${p.name} (${emails.length}x) from: ${p.from} ===`);

        // Show unique subjects
        const subjects = [...new Set(emails.map(e => e.subject))];
        for (const s of subjects.slice(0, 5)) console.log(`  "${s}"`);
        if (subjects.length > 5) console.log(`  ... ${subjects.length - 5} more`);

        // Save samples with body text extraction
        const outDir = path.join(outBase, p.name);
        fs.mkdirSync(outDir, { recursive: true });

        for (let i = 0; i < Math.min(3, emails.length); i++) {
            const e = emails[i];
            const prefix = `sample${i + 1}`;

            // Info
            fs.writeFileSync(path.join(outDir, `${prefix}-info.json`), JSON.stringify({
                subject: e.subject,
                from: e.fromAddress,
                date: e.receivedAt,
                attachments: e.attachments?.map((a: any) => ({ name: a.filename, mime: a.mimeType, gmailAttId: a.gmailAttachmentId })),
            }, null, 2));

            // Extract text from HTML
            if (e.bodyHtml) {
                const $ = cheerio.load(e.bodyHtml);
                const text = $.root().text().replace(/\s+/g, ' ').trim();
                fs.writeFileSync(path.join(outDir, `${prefix}-text.txt`), text);
                // First 300 chars
                console.log(`  [${i}] "${e.subject?.substring(0, 60)}..."`);
                console.log(`      text: ${text.substring(0, 200)}`);
                if (e.attachments?.length) {
                    console.log(`      attachments: ${e.attachments.map((a: any) => a.filename).join(', ')}`);
                }
            }
            if (e.bodyText) {
                fs.writeFileSync(path.join(outDir, `${prefix}-body.txt`), e.bodyText);
            }
        }
    }

    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
