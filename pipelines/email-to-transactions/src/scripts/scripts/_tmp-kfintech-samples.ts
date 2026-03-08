import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';
import * as cheerio from 'cheerio';

const USER_ID = '69ad593fb3726a47dec36515';

async function main() {
    await databaseLoader();

    // KFintech MF service emails (the ones with valuations)
    for (const from of ['mfservice@kfintech.com', 'kfpl.mfservice@kfintech.com']) {
        const emails = await rawEmailsService.find({ userId: USER_ID, fromAddress: from });
        for (const e of emails) {
            if (!e.bodyHtml) continue;
            const $ = cheerio.load(e.bodyHtml);
            const text = $.root().text().replace(/\s+/g, ' ').trim();
            const start = text.indexOf('Dear');
            if (start === -1) continue;
            const content = text.substring(start, start + 600);
            if (content.includes('Valuation') || content.includes('Redemption') || content.includes('transaction')) {
                console.log(`\n=== [${from}] ${e.subject} ===`);
                console.log(content);
            }
        }
    }

    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
