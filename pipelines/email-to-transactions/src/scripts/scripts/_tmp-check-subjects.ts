import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';

const USER_ID = '69ad593fb3726a47dec36515';

async function main() {
    await databaseLoader();

    // Check Zomato subjects
    const zomato = await rawEmailsService.find({ userId: USER_ID, fromAddress: 'noreply@zomato.com' });
    console.log(`\n=== ZOMATO (${zomato.length}) ===`);
    const zSubjects: Record<string, number> = {};
    for (const e of zomato) {
        const s = e.subject || '';
        zSubjects[s] = (zSubjects[s] || 0) + 1;
    }
    for (const [s, c] of Object.entries(zSubjects).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${c}x "${s}"`);
    }

    // Check Rapido subjects
    const rapido = await rawEmailsService.find({ userId: USER_ID, fromAddress: 'shoutout@rapido.bike' });
    console.log(`\n=== RAPIDO (${rapido.length}) ===`);
    for (const e of rapido) {
        console.log(`  "${e.subject}"`);
    }

    // Check HDFC alerts subjects
    const hdfc = await rawEmailsService.find({ userId: USER_ID, fromAddress: 'alerts@hdfcbank.net' });
    console.log(`\n=== HDFC ALERTS (${hdfc.length}) ===`);
    const hSubjects: Record<string, number> = {};
    for (const e of hdfc) {
        const s = e.subject || '';
        hSubjects[s] = (hSubjects[s] || 0) + 1;
    }
    for (const [s, c] of Object.entries(hSubjects).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${c}x "${s}"`);
    }

    // Check apartment subjects
    const apt = await rawEmailsService.find({ userId: USER_ID, fromAddress: 'do-not-reply@rank1infotech.com' });
    console.log(`\n=== APARTMENT (${apt.length}) ===`);
    const aSubjects: Record<string, number> = {};
    for (const e of apt) {
        const s = e.subject || '';
        aSubjects[s] = (aSubjects[s] || 0) + 1;
    }
    for (const [s, c] of Object.entries(aSubjects).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${c}x "${s}"`);
    }

    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
