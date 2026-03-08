import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { rawEmailsService } from '@/services/emails/raw-emails.service';
import { gmailConnectionService } from '@/services/users/gmail-connection.service';
import { GmailPlugin } from '@/plugins/gmail';
import { PDFParse } from 'pdf-parse';
import * as fs from 'fs';
import * as path from 'path';

const USER_ID = '69ad593fb3726a47dec36515';
const PASSWORD = 'ASHU0611';

async function main() {
    await databaseLoader();
    const creds = await gmailConnectionService.getCredentials(USER_ID);
    const gmail = new GmailPlugin(creds.accessToken, creds.refreshToken);

    const emails = await rawEmailsService.find({
        userId: USER_ID,
        fromAddress: { $regex: 'emailstatements.*hdfcbank', $options: 'i' },
        subject: { $regex: 'credit card statement', $options: 'i' },
    });

    // Only ones with attachments
    const withAtt = emails.filter((e: any) => e.attachments?.length > 0);
    console.log(`Found ${withAtt.length} HDFC CC statements with attachments`);

    const outDir = path.join(process.cwd(), 'output', 'hdfc-cc');
    fs.mkdirSync(outDir, { recursive: true });

    for (const email of withAtt) {
        const att = email.attachments![0];
        const monthMatch = email.subject?.match(/(\w+)-(\d{4})/);
        const label = monthMatch ? `${monthMatch[1]}-${monthMatch[2]}` : (email as any)._id?.toString();

        try {
            console.log(`\nExtracting: ${email.subject}`);
            const buf = await gmail.downloadAttachment((email as any).gmailMessageId, att.gmailAttachmentId);
            const parser = new PDFParse({ data: new Uint8Array(buf), password: PASSWORD });
            const result = await parser.getText();
            await parser.destroy();

            const filename = `statement-${label}.txt`;
            fs.writeFileSync(path.join(outDir, filename), result.text);
            console.log(`  ✓ ${result.text.length} chars → ${filename}`);
        } catch (e: any) {
            console.log(`  ✗ Failed: ${e.message}`);
        }
    }

    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
