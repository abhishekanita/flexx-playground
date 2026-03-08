import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';
import * as fs from 'fs';
import * as path from 'path';

const USER_ID = '69ad593fb3726a47dec36515';

const INVESTMENT_DOMAINS = [
    'icicisecurities', 'icicidirect', 'zerodha', 'indmoney', 'ind.money',
    'nsdl', 'cdsl', 'bseindia', 'nseindia', 'cams', 'kfintech',
    'mutualfund', 'amfi', 'groww', 'kuvera', 'mfcentral',
    'hdfcfund', 'sbimf', 'axismf', 'nippon', 'dsp',
    'smallcase', 'coin.zerodha',
];

async function main() {
    await databaseLoader();
    const emails = await rawEmailsService.find({ userId: USER_ID });

    // Find investment-related senders
    const groups: Record<string, { count: number; subjects: Set<string>; hasPdf: boolean; hasHtml: boolean; hasText: boolean; sampleId: string }> = {};

    for (const e of emails) {
        const from = (e.fromAddress || '').toLowerCase();
        const isInvestment = INVESTMENT_DOMAINS.some(d => from.includes(d));
        if (!isInvestment) continue;

        if (!groups[from]) {
            groups[from] = { count: 0, subjects: new Set(), hasPdf: false, hasHtml: false, hasText: false, sampleId: e._id.toString() };
        }
        groups[from].count++;
        groups[from].subjects.add((e.subject || '').substring(0, 100));
        if (e.hasPdf || (e.attachments && e.attachments.length > 0)) groups[from].hasPdf = true;
        if (e.bodyHtml) groups[from].hasHtml = true;
        if (e.bodyText) groups[from].hasText = true;
    }

    const sorted = Object.entries(groups).sort((a, b) => b[1].count - a[1].count);

    console.log(`=== INVESTMENT EMAIL PROVIDERS ===\n`);
    let total = 0;
    for (const [from, info] of sorted) {
        const flags = [info.hasPdf ? 'PDF' : '', info.hasHtml ? 'HTML' : '', info.hasText ? 'TXT' : ''].filter(Boolean).join('+');
        console.log(`${info.count.toString().padStart(4)}x | ${from} [${flags}]`);
        const subjects = [...info.subjects].slice(0, 5);
        for (const s of subjects) console.log(`       "${s}"`);
        if (info.subjects.size > 5) console.log(`       ... and ${info.subjects.size - 5} more`);
        console.log();
        total += info.count;
    }
    console.log(`Total investment emails: ${total}`);

    // Save samples
    const outBase = path.join(process.cwd(), 'output', 'provider-samples');
    for (const [from, info] of sorted) {
        const email = await rawEmailsService.findById(info.sampleId);
        if (!email) continue;

        const dirName = from.split('@')[1]?.split('.')[0] || from.replace(/[^a-z0-9]/g, '-');
        const outDir = path.join(outBase, `inv-${dirName}`);
        fs.mkdirSync(outDir, { recursive: true });

        fs.writeFileSync(path.join(outDir, 'info.json'), JSON.stringify({
            subject: email.subject,
            from: email.fromAddress,
            date: email.receivedAt,
            hasPdf: email.hasPdf,
            hasAttachments: !!(email.attachments && email.attachments.length > 0),
            attachments: email.attachments?.map((a: any) => ({ name: a.filename, mime: a.mimeType })),
            bodyTextLength: email.bodyText?.length || 0,
            bodyHtmlLength: email.bodyHtml?.length || 0,
        }, null, 2));

        if (email.bodyHtml) fs.writeFileSync(path.join(outDir, 'sample.html'), email.bodyHtml);
        if (email.bodyText) fs.writeFileSync(path.join(outDir, 'sample.txt'), email.bodyText);
    }

    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
