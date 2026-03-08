import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';
import * as fs from 'fs';
import * as path from 'path';

const USER_ID = '69ad593fb3726a47dec36515';

const PROVIDERS = [
    { name: 'zomato', from: 'noreply@zomato.com', subjectFilter: /order/i },
    { name: 'hdfc-alerts', from: 'alerts@hdfcbank.net', subjectFilter: /UPI|txn|update/i },
    { name: 'hdfc-savings', from: 'hdfcbanksmartstatement@hdfcbank.net' },
    { name: 'rapido', from: 'shoutout@rapido.bike' },
    { name: 'licious', from: 'no-reply@licious.com' },
    { name: 'google-play', from: 'googleplay-noreply@google.com' },
    { name: 'indigo', from: '6egstinvoice@goindigo.in' },
    { name: 'apartment', from: 'do-not-reply@rank1infotech.com' },
];

async function main() {
    await databaseLoader();

    const outBase = path.join(process.cwd(), 'output', 'provider-samples');
    fs.mkdirSync(outBase, { recursive: true });

    for (const provider of PROVIDERS) {
        const emails = await rawEmailsService.find({
            userId: USER_ID,
            fromAddress: provider.from,
        });

        let filtered = emails;
        if (provider.subjectFilter) {
            filtered = emails.filter(e => provider.subjectFilter!.test(e.subject || ''));
        }

        console.log(`\n=== ${provider.name} === (${filtered.length}/${emails.length} emails)`);

        if (filtered.length === 0) continue;

        // Show subjects
        const subjects = [...new Set(filtered.map(e => e.subject))].slice(0, 5);
        for (const s of subjects) console.log(`  "${s}"`);

        // Save sample bodyText/bodyHtml
        const sample = filtered[0];
        const outDir = path.join(outBase, provider.name);
        fs.mkdirSync(outDir, { recursive: true });

        const info = {
            subject: sample.subject,
            from: sample.fromAddress,
            date: sample.receivedAt,
            hasPdf: sample.hasPdf,
            hasAttachments: !!(sample.attachments && sample.attachments.length > 0),
            attachments: sample.attachments?.map((a: any) => ({ name: a.filename, mime: a.mimeType })),
            bodyTextLength: sample.bodyText?.length || 0,
            bodyHtmlLength: sample.bodyHtml?.length || 0,
        };
        console.log(`  Sample: ${JSON.stringify(info)}`);

        fs.writeFileSync(path.join(outDir, 'info.json'), JSON.stringify(info, null, 2));

        if (sample.bodyText) {
            fs.writeFileSync(path.join(outDir, 'sample.txt'), sample.bodyText);
        }
        if (sample.bodyHtml) {
            fs.writeFileSync(path.join(outDir, 'sample.html'), sample.bodyHtml);
        }

        // Save 2nd sample too if available
        if (filtered.length > 1) {
            const s2 = filtered[Math.min(3, filtered.length - 1)];
            if (s2.bodyText) fs.writeFileSync(path.join(outDir, 'sample2.txt'), s2.bodyText);
            if (s2.bodyHtml) fs.writeFileSync(path.join(outDir, 'sample2.html'), s2.bodyHtml);
        }
    }

    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
