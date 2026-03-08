import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';
import * as cheerio from 'cheerio';

const USER_ID = '69ad593fb3726a47dec36515';

async function main() {
    await databaseLoader();

    // Get different subject patterns
    const emails = await rawEmailsService.find({ userId: USER_ID, fromAddress: 'alerts@hdfcbank.net' });

    const subjects = ['UPI txn', 'Credit Card', 'debited via'];
    for (const s of subjects) {
        const matching = emails.filter(e => (e.subject || '').includes(s));
        if (matching.length === 0) continue;
        const sample = matching[0];
        const $ = cheerio.load(sample.bodyHtml || '');
        const text = $.root().text().replace(/\s+/g, ' ').trim();
        console.log(`\n=== "${s}" (${matching.length}x) ===`);
        console.log(`Subject: ${sample.subject}`);
        // Print first 500 chars of extracted text
        console.log(text.substring(0, 500));
    }

    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
