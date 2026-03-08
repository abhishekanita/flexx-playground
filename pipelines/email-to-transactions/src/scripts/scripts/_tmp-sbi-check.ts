import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';
import { userService } from '@/services/users/user.service';
import { gmailConnectionService } from '@/services/users/gmail-connection.service';
import { GmailPlugin } from '@/plugins/gmail';

const USER_ID = '69ad593fb3726a47dec36515';

async function main() {
    await databaseLoader();

    // 1. Check sync cursor
    const cursor = await userService.getGmailSyncCursor(USER_ID);
    console.log('=== Sync Cursor ===');
    console.log('Cursor:', cursor);

    // 2. Find all SBI-related emails in DB
    const emails = await rawEmailsService.find({
        userId: USER_ID,
        $or: [
            { fromAddress: { $regex: 'sbi', $options: 'i' } },
            { subject: { $regex: 'sbi', $options: 'i' } },
        ],
    });
    console.log('\n=== SBI Emails in DB ===');
    console.log('Total:', emails.length);
    for (const e of emails) {
        console.log(JSON.stringify({
            id: (e as any)._id?.toString(),
            subject: e.subject,
            from: e.fromAddress,
            date: e.receivedAt,
            hasPdf: e.hasPdf,
            attCount: e.attachments?.length,
        }));
    }

    // 3. Check Gmail directly for SBI statement emails
    console.log('\n=== Gmail Search ===');
    const creds = await gmailConnectionService.getCredentials(USER_ID);
    const gmail = new GmailPlugin(creds.accessToken, creds.refreshToken);

    // Search for SBI e-statement emails
    const query1 = 'from:sbi subject:"E-account statement"';
    const msgs1 = await gmail.searchAllMessages(query1, 100);
    console.log(`Query: "${query1}" => ${msgs1.length} results`);
    for (const m of msgs1) {
        console.log(JSON.stringify({
            id: m.messageId,
            subject: m.subject,
            from: m.fromEmail,
            date: m.receivedAt,
            hasAttachments: m.hasAttachments,
            attCount: m.attachments?.length,
        }));
    }

    // Broader SBI search
    const query2 = 'from:sbi';
    const msgs2 = await gmail.searchAllMessages(query2, 100);
    console.log(`\nQuery: "${query2}" => ${msgs2.length} results`);
    for (const m of msgs2) {
        console.log(JSON.stringify({
            id: m.messageId,
            subject: m.subject,
            from: m.fromEmail,
            date: m.receivedAt,
        }));
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
