import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.dev') });

const userCreds = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'abhishek-gmail-integration.json'), 'utf-8'),
);

async function main() {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_CLIENT_SECRET!,
    );
    oauth2Client.setCredentials({
        access_token: userCreds.accessToken,
        refresh_token: userCreds.refreshToken,
    });
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get the most recent SBI statement email body
    const sbiRes = await gmail.users.messages.list({
        userId: 'me', q: 'from:cbssbi.cas@alerts.sbi.bank.in', maxResults: 1,
    });

    const kotakRes = await gmail.users.messages.list({
        userId: 'me', q: 'from:BankStatements@kotak.bank.in', maxResults: 1,
    });

    const kotak2Res = await gmail.users.messages.list({
        userId: 'me', q: 'from:BankStatements@kotak.com subject:"Bank Account Statement"', maxResults: 1,
    });

    for (const [label, res] of [['SBI', sbiRes], ['KOTAK (bank.in)', kotakRes], ['KOTAK (kotak.com)', kotak2Res]] as const) {
        const msgs = (res as any).data.messages || [];
        if (msgs.length === 0) { console.log(`No ${label} emails found`); continue; }

        const detail = await gmail.users.messages.get({
            userId: 'me', id: msgs[0].id, format: 'full',
        });

        console.log(`\n${'='.repeat(60)}`);
        console.log(`  ${label} EMAIL BODY`);
        console.log('='.repeat(60));

        const headers = detail.data.payload?.headers || [];
        console.log(`Subject: ${headers.find((h: any) => h.name === 'Subject')?.value}`);
        console.log(`Date: ${headers.find((h: any) => h.name === 'Date')?.value}\n`);

        // Extract text from all parts
        function extractText(parts: any[]): string {
            let text = '';
            if (!parts) return text;
            for (const part of parts) {
                if (part.mimeType === 'text/plain' && part.body?.data) {
                    text += Buffer.from(part.body.data, 'base64').toString('utf-8');
                } else if (part.mimeType === 'text/html' && part.body?.data) {
                    // Simple HTML to text
                    const html = Buffer.from(part.body.data, 'base64').toString('utf-8');
                    text += html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 3000);
                }
                if (part.parts) text += extractText(part.parts);
            }
            return text;
        }

        const parts = detail.data.payload?.parts || [];
        // Also check top-level body
        let bodyText = '';
        if (detail.data.payload?.body?.data) {
            bodyText = Buffer.from(detail.data.payload.body.data, 'base64').toString('utf-8');
            bodyText = bodyText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        }
        bodyText += extractText(parts);

        // Search for password-related text
        const passwordKeywords = ['password', 'Password', 'PASSWORD', 'passcode', 'open', 'protected', 'unlock', 'dob', 'DOB', 'date of birth', 'mobile', 'PAN', 'pan'];

        console.log('--- Full body text ---');
        console.log(bodyText.substring(0, 4000));
        console.log('\n--- Password-related sections ---');

        const sentences = bodyText.split(/[.!?\n]/);
        for (const sentence of sentences) {
            if (passwordKeywords.some(kw => sentence.toLowerCase().includes(kw.toLowerCase()))) {
                console.log(`  >> ${sentence.trim()}`);
            }
        }
    }
}

main().catch(console.error);
