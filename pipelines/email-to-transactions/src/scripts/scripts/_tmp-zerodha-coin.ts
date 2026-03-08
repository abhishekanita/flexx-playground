import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';
import * as cheerio from 'cheerio';

const USER_ID = '69ad593fb3726a47dec36515';

async function main() {
    await databaseLoader();
    const emails = await rawEmailsService.find({ userId: USER_ID, fromAddress: 'alerts@mailer.zerodha.com' });

    for (const e of emails) {
        if (!e.bodyHtml) continue;
        const $ = cheerio.load(e.bodyHtml);
        const text = $.root().text().replace(/\s+/g, ' ').trim();
        // Remove CSS
        const cleaned = text.replace(/^.*?\}/, '').replace(/.*?\{[^}]*\}/g, '').trim();
        console.log(`\n=== ${e.subject} ===`);
        // Print first 500 meaningful chars
        const start = cleaned.indexOf('Dear');
        if (start > -1) console.log(cleaned.substring(start, start + 500));
        else console.log(cleaned.substring(0, 500));
    }

    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
