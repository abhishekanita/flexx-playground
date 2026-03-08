import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';

const USER_ID = '69ad593fb3726a47dec36515';

async function main() {
    await databaseLoader();
    const emails = await rawEmailsService.find({ userId: USER_ID, fromAddress: 'service@icicisecurities.com' });

    console.log(`Total ICICI Securities: ${emails.length}`);
    const subjects: Record<string, number> = {};
    for (const e of emails) {
        subjects[e.subject || ''] = (subjects[e.subject || ''] || 0) + 1;
    }
    for (const [s, c] of Object.entries(subjects).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${c}x "${s}"`);
    }

    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
