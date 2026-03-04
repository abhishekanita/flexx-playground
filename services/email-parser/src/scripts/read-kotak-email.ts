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

    // Get both types of Kotak statement emails with FULL raw content
    const queries = [
        { label: 'KOTAK bank.in', q: 'from:BankStatements@kotak.bank.in subject:"statement"' },
        { label: 'KOTAK kotak.com', q: 'from:BankStatements@kotak.com subject:"Bank Account Statement"' },
    ];

    for (const { label, q } of queries) {
        const res = await gmail.users.messages.list({ userId: 'me', q, maxResults: 1 });
        const msgs = res.data.messages || [];
        if (!msgs.length) continue;

        const detail = await gmail.users.messages.get({
            userId: 'me', id: msgs[0].id, format: 'full',
        });

        console.log(`\n${'='.repeat(60)}`);
        console.log(`  ${label}`);
        console.log('='.repeat(60));

        const headers = detail.data.payload?.headers || [];
        console.log(`Subject: ${headers.find((h: any) => h.name === 'Subject')?.value}`);

        // Get ALL HTML from all parts
        function getHtml(parts: any[]): string[] {
            const result: string[] = [];
            if (!parts) return result;
            for (const part of parts) {
                if (part.body?.data) {
                    const decoded = Buffer.from(part.body.data, 'base64').toString('utf-8');
                    result.push(decoded);
                }
                if (part.parts) result.push(...getHtml(part.parts));
            }
            return result;
        }

        const parts = detail.data.payload?.parts || [];
        const htmlParts = getHtml(parts);

        // Also check top-level body
        if (detail.data.payload?.body?.data) {
            htmlParts.unshift(Buffer.from(detail.data.payload.body.data, 'base64').toString('utf-8'));
        }

        for (let i = 0; i < htmlParts.length; i++) {
            const html = htmlParts[i];
            // Search for password/CRN mentions in the raw HTML
            const lower = html.toLowerCase();

            // Find all occurrences of password, CRN, protected
            const keywords = ['password', 'crn', 'protected', 'open the', 'open this', 'dob', 'date of birth'];
            for (const kw of keywords) {
                let idx = lower.indexOf(kw);
                while (idx !== -1) {
                    // Get surrounding context (200 chars before and after)
                    const start = Math.max(0, idx - 200);
                    const end = Math.min(html.length, idx + kw.length + 200);
                    const context = html.substring(start, end).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                    console.log(`\n  [${kw}] found at pos ${idx}:`);
                    console.log(`    ${context}`);
                    idx = lower.indexOf(kw, idx + 1);
                }
            }
        }
    }
}

main().catch(console.error);
