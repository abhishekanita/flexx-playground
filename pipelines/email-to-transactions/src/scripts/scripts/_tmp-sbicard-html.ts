import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';
import * as fs from 'fs';
import * as path from 'path';

const USER_ID = '69ad593fb3726a47dec36515';

async function main() {
    await databaseLoader();

    const emails = await rawEmailsService.find({
        userId: USER_ID,
        fromAddress: 'statements@sbicard.com',
    });

    if (emails.length > 0) {
        const email = emails[0];
        const outDir = path.join(process.cwd(), 'output', 'sbicard');
        fs.mkdirSync(outDir, { recursive: true });

        // Save raw HTML
        if (email.bodyHtml) {
            fs.writeFileSync(path.join(outDir, 'statement-email.html'), email.bodyHtml);
            console.log('Saved raw HTML');

            // Look for password-related content
            const html = email.bodyHtml.toLowerCase();
            const pwIdx = html.indexOf('password');
            if (pwIdx > -1) {
                // Show context around "password" mentions
                const contexts = [];
                let searchFrom = 0;
                while (true) {
                    const idx = html.indexOf('password', searchFrom);
                    if (idx === -1) break;
                    const start = Math.max(0, idx - 200);
                    const end = Math.min(html.length, idx + 500);
                    contexts.push(email.bodyHtml.substring(start, end));
                    searchFrom = idx + 1;
                }
                console.log(`\nFound ${contexts.length} "password" mentions:\n`);
                contexts.forEach((c, i) => {
                    console.log(`--- Context ${i + 1} ---`);
                    console.log(c);
                    console.log();
                });
            }

            // Look for images that might contain password info
            const imgMatches = email.bodyHtml.match(/<img[^>]+src="([^"]+)"[^>]*>/gi);
            if (imgMatches) {
                console.log(`\n=== Images in email (${imgMatches.length}) ===`);
                for (const img of imgMatches) {
                    console.log(img.substring(0, 200));
                }
            }
        }
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
