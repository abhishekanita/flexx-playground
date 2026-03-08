import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { gmailConnectionService } from '@/services/users/gmail-connection.service';
import { GmailPlugin } from '@/plugins/gmail';

const USER_ID = '69ad593fb3726a47dec36515';

async function main() {
    await databaseLoader();

    const creds = await gmailConnectionService.getCredentials(USER_ID);
    const gmail = new GmailPlugin(creds.accessToken, creds.refreshToken);

    // Broader search - try different subject variations
    const queries = [
        'from:sbi subject:"E-account statement"',
        'from:sbi subject:"e-statement"',
        'from:sbi subject:"account statement"',
        'from:sbi subject:statement',
        'from:alerts.sbi.co.in',
        'from:alerts.sbi.bank.in',
        'from:sbi.co.in subject:statement',
    ];

    for (const q of queries) {
        const msgs = await gmail.searchAllMessages(q, 200);
        console.log(`\n=== Query: "${q}" => ${msgs.length} results ===`);
        // Show only statement-like emails, sorted by date
        const relevant = msgs
            .filter(m => m.subject?.toLowerCase().includes('statement') || m.subject?.toLowerCase().includes('account'))
            .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
        for (const m of relevant) {
            console.log(`  ${m.receivedAt} | ${m.fromEmail} | ${m.subject}`);
        }
    }

    // Also search specifically for Apr, Jun, Aug 2025 windows
    console.log('\n\n=== TARGETED: All SBI emails in Apr 2025 ===');
    const apr = await gmail.searchAllMessages('from:sbi after:2025/04/01 before:2025/05/01 subject:statement', 100);
    for (const m of apr) {
        console.log(`  ${m.receivedAt} | ${m.fromEmail} | ${m.subject}`);
    }
    if (apr.length === 0) console.log('  (none)');

    console.log('\n=== TARGETED: All SBI emails in Jun 2025 ===');
    const jun = await gmail.searchAllMessages('from:sbi after:2025/06/01 before:2025/07/01 subject:statement', 100);
    for (const m of jun) {
        console.log(`  ${m.receivedAt} | ${m.fromEmail} | ${m.subject}`);
    }
    if (jun.length === 0) console.log('  (none)');

    console.log('\n=== TARGETED: All SBI emails in Aug 2025 ===');
    const aug = await gmail.searchAllMessages('from:sbi after:2025/08/01 before:2025/09/01 subject:statement', 100);
    for (const m of aug) {
        console.log(`  ${m.receivedAt} | ${m.fromEmail} | ${m.subject}`);
    }
    if (aug.length === 0) console.log('  (none)');

    // Also check ALL emails from alerts.sbi.co.in chronologically
    console.log('\n\n=== ALL emails from alerts.sbi.co.in (chronological) ===');
    const allSbi = await gmail.searchAllMessages('from:alerts.sbi.co.in OR from:alerts.sbi.bank.in OR from:sbi.co.in', 500);
    const sorted = allSbi.sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());
    for (const m of sorted) {
        console.log(`  ${m.receivedAt} | ${m.fromEmail} | ${m.subject}`);
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
