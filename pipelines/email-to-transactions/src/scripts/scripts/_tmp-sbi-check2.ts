import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { gmailConnectionService } from '@/services/users/gmail-connection.service';
import { GmailPlugin } from '@/plugins/gmail';
import { GMAIL_SEARCH_QUERIES_V2 } from '@/pipelines/email-sync/helpers/search-queries';

const USER_ID = '69ad593fb3726a47dec36515';

// The 4 missing e-statement email dates - check which 30-day windows they fall in
// Oct 6, 2024 — window ~Sep 16 to Oct 16
// Nov 8, 2024 — window ~Oct 16 to Nov 15
// Feb 10, 2025 — window ~Jan 25 to Feb 24
// Mar 10, 2025 — window ~Feb 24 to Mar 26

async function main() {
    await databaseLoader();

    const creds = await gmailConnectionService.getCredentials(USER_ID);
    const gmail = new GmailPlugin(creds.accessToken, creds.refreshToken);

    // Simulate the exact windows & queries the sync would have used
    // Sync started ~360 days before June 11, 2025 => ~June 16, 2024
    // With 30-day windows
    const startDate = new Date(Date.now() - 12 * 30 * 86400000); // approx

    // Test specific windows around the missing emails
    const testWindows = [
        { start: '2024/09/13', end: '2024/10/13', label: 'Window for Oct 6 email' },
        { start: '2024/10/13', end: '2024/11/12', label: 'Window for Nov 8 email' },
        { start: '2025/01/21', end: '2025/02/20', label: 'Window for Feb 10 email' },
        { start: '2025/02/20', end: '2025/03/22', label: 'Window for Mar 10 email' },
        { start: '2025/04/21', end: '2025/05/21', label: 'Window for May 6 email (FOUND)' },
    ];

    for (const win of testWindows) {
        console.log(`\n=== ${win.label} (${win.start} to ${win.end}) ===`);

        for (const sq of GMAIL_SEARCH_QUERIES_V2) {
            const query = `${sq.query} after:${win.start} before:${win.end}`;
            const msgs = await gmail.searchAllMessages(query, 500);

            const sbiStatements = msgs.filter(m =>
                m.subject?.includes('E-account statement') && m.fromEmail?.includes('sbi')
            );

            console.log(`  Query "${sq.id}": ${msgs.length} total, ${sbiStatements.length} SBI statements`);
            for (const s of sbiStatements) {
                console.log(`    -> ${s.subject} from ${s.fromEmail} date ${s.receivedAt}`);
            }
        }
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
