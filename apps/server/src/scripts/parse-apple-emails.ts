import mongoose from 'mongoose';
import { google } from 'googleapis';
import { config } from '@/config';

interface AppleCharge {
    app: string;
    plan: string;
    amount: number;
    date: string;
    renewsOn: string;
}

class ParseAppleEmails {
    async run() {
        const uri = `${config.db.uri}/${config.db.name}`;
        await mongoose.connect(uri);
        console.log('Connected to DB');

        const gmailDoc = await mongoose.connection.db!
            .collection('integration_gmail')
            .findOne({ isConnected: true });

        if (!gmailDoc) {
            console.log('No Gmail integration found');
            await mongoose.disconnect();
            return;
        }

        const { accessToken, refreshToken } = gmailDoc;
        await mongoose.disconnect();

        const auth = new google.auth.OAuth2(
            config.google.clientId,
            config.google.clientSecret,
            config.google.redirectUrl
        );
        auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
        const gmail = google.gmail({ version: 'v1', auth });

        const query = 'from:no_reply@email.apple.com subject:(invoice OR receipt) after:2023/01/01';
        console.log(`\nSearching: ${query}\n`);
        const messageIds: string[] = [];
        let pageToken: string | undefined;

        do {
            const res = await gmail.users.messages.list({
                userId: 'me',
                q: query,
                maxResults: 100,
                pageToken,
            });
            for (const msg of res.data.messages || []) {
                if (msg.id) messageIds.push(msg.id);
            }
            pageToken = res.data.nextPageToken || undefined;
        } while (pageToken);

        console.log(`Found ${messageIds.length} Apple invoice/receipt emails\n`);

        const allCharges: AppleCharge[] = [];
        let unparsed = 0;

        for (let i = 0; i < messageIds.length; i++) {
            const detail = await gmail.users.messages.get({
                userId: 'me',
                id: messageIds[i],
                format: 'full',
            });

            const headers = detail.data.payload?.headers || [];
            const dateStr = headers.find(h => h.name === 'Date')?.value || '';
            const html = this.findHtml(detail.data.payload);
            const text = this.cleanHtml(html);

            // An email may contain duplicate (two copies of same invoice in HTML)
            // Just parse once — dedup by taking first match
            const charge = this.parseNewFormat(text, dateStr) || this.parseOldFormat(text, dateStr);

            if (charge) {
                allCharges.push(charge);
            } else {
                unparsed++;
            }

            if ((i + 1) % 20 === 0) {
                console.log(`Processed ${i + 1}/${messageIds.length} emails...`);
            }
        }

        console.log(`\nParsed ${allCharges.length} charges, ${unparsed} unparsed from ${messageIds.length} emails\n`);

        // Group by app (normalize "Apple TV" and "Apple TV+" together)
        const byApp = new Map<string, AppleCharge[]>();
        for (const charge of allCharges) {
            const key = this.normalizeAppName(charge.app);
            if (!byApp.has(key)) byApp.set(key, []);
            byApp.get(key)!.push(charge);
        }

        // Print
        console.log('='.repeat(80));
        console.log('APPLE SUBSCRIPTIONS & PURCHASES');
        console.log('='.repeat(80));

        const sortedApps = [...byApp.entries()].sort((a, b) => {
            const totalA = a[1].reduce((s, c) => s + c.amount, 0);
            const totalB = b[1].reduce((s, c) => s + c.amount, 0);
            return totalB - totalA;
        });

        let grandTotal = 0;

        for (const [app, charges] of sortedApps) {
            const sorted = charges.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const total = sorted.reduce((s, c) => s + c.amount, 0);
            grandTotal += total;
            const latestPlan = sorted.filter(c => c.plan).pop()?.plan || '';

            console.log(`\n${app}${latestPlan ? `  [${latestPlan}]` : ''}`);
            console.log('─'.repeat(60));
            for (const c of sorted) {
                const d = new Date(c.date).toISOString().split('T')[0];
                console.log(`  ${d}    ₹${c.amount}`);
            }
            console.log(`  ${'─'.repeat(40)}`);
            console.log(`  ${sorted.length} charges    Total: ₹${total}`);
        }

        console.log(`\n${'='.repeat(80)}`);
        console.log(`GRAND TOTAL: ₹${grandTotal} across ${allCharges.length} charges, ${sortedApps.length} apps`);
        console.log('='.repeat(80));
    }

    // New format (2025+): "Apple Account:" section marker
    private parseNewFormat(text: string, emailDate: string): AppleCharge | null {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

        const accountIdx = lines.findIndex(l => /^Apple (Account|ID):?$/i.test(l));
        if (accountIdx < 0 || !lines[accountIdx + 1]?.includes('@')) return null;

        const endIdx = lines.findIndex((l, i) => i > accountIdx + 2 && /^(Billing and Payment|Subtotal)/i.test(l));
        if (endIdx < 0) return null;

        const section = lines.slice(accountIdx + 2, endIdx);
        return this.extractFromSection(section, emailDate);
    }

    // Old format (pre-2025): Items come after store section header like "App Store" or "Apple TV"
    private parseOldFormat(text: string, emailDate: string): AppleCharge | null {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

        // Find the first "App Store" or "Apple TV" line that's followed by an app name (not headers)
        // Skip duplicate invoice (old emails have the same invoice twice)
        const storeIdx = lines.findIndex(l => /^(App Store|Apple TV)$/i.test(l));
        if (storeIdx < 0) return null;

        const storeHeader = lines[storeIdx];

        // End at "Subtotal" or "TOTAL"
        const endIdx = lines.findIndex((l, i) => i > storeIdx && /^(Subtotal|TOTAL)/i.test(l));
        if (endIdx < 0) return null;

        const section = lines.slice(storeIdx + 1, endIdx);
        // Use store header as fallback app name (e.g. "Apple TV" section → Apple TV+)
        const fallbackApp = /^Apple TV$/i.test(storeHeader) ? 'Apple TV+' : undefined;
        return this.extractFromSection(section, emailDate, fallbackApp);
    }

    private extractFromSection(section: string[], emailDate: string, fallbackApp?: string): AppleCharge | null {
        let app = '';
        let plan = '';
        let amount = 0;
        let renewsOn = '';

        for (const line of section) {
            // Amount line
            const amountMatch = line.match(/^₹\s*([\d,]+(?:\.\d{2})?)/);
            if (amountMatch) {
                amount = parseFloat(amountMatch[1].replace(/,/g, ''));
                continue;
            }

            // Plan with cycle
            if (/\((?:Monthly|Yearly|Annual|Weekly|Quarterly)\)/i.test(line)) {
                plan = line;
                continue;
            }

            // SAC line
            if (/^SAC:/i.test(line)) continue;

            // Renews line
            if (/^Renews/i.test(line)) {
                renewsOn = line.replace('Renews ', '');
                continue;
            }

            // Device line (e.g. "Abhishek's MacBook Air", "John's iPhone")
            if (/[''\u2019]s\s+(iPhone|iPad|Mac|MacBook|Apple Watch)/i.test(line)) continue;
            // Fallback: any line that's primarily a device name
            if (/^.+\s(MacBook|iPhone|iPad)\s*(Air|Pro|Mini|Plus|Max)?$/i.test(line)) continue;

            // Report a Problem
            if (/^Report a Problem/i.test(line)) continue;

            // In-App Purchase / Subscription type
            if (/^(In-App Purchase|Subscription)$/i.test(line)) continue;

            // Skip "BILLED TO", "UPI", address lines, section headers, etc
            if (/^(BILLED TO|UPI|INVOICE|SEQUENCE|ORDER|DOCUMENT|IND$|Billing and Payment|Billing Information)/i.test(line)) continue;

            // Skip address-like lines (postal codes, state codes, country)
            if (/^\d{6}$/.test(line) || /^[A-Z]{2}$/.test(line)) continue;
            if (/^India$/i.test(line)) continue;
            if (/Pinjore|Aggarwal|Bitna|Haryana/i.test(line)) continue;

            // Skip date lines (e.g. "23 Jun 2023", "07 Feb 2024")
            if (/^\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/i.test(line)) continue;

            // Skip payment method lines
            if (/^(Store Credit|Store Credit and UPI|Apple Pay|Debit|Credit)$/i.test(line)) continue;

            // Skip store section headers (old format)
            if (/^(App Store|Apple TV)$/i.test(line)) continue;

            // Skip bare plan/cycle names that aren't app names
            if (/^(Monthly|Yearly|Annual|Weekly|Quarterly|Free Trial)$/i.test(line)) continue;

            // Skip order/sequence IDs (alphanumeric codes)
            if (/^[A-Z0-9]{6,}$/.test(line)) continue;
            if (/^3-\d+$/.test(line)) continue;
            if (/^\d{9,}$/.test(line)) continue;

            // Skip email addresses
            if (/@/.test(line)) continue;

            // First good remaining line is the app name
            if (!app && line.length > 1) {
                app = line;
            }
        }

        if (!app && fallbackApp) app = fallbackApp;
        if (!app || !amount) return null;

        return {
            app,
            plan,
            amount,
            date: this.parseDate(emailDate),
            renewsOn,
        };
    }

    private normalizeAppName(name: string): string {
        if (/^Apple TV/i.test(name)) return 'Apple TV+';
        if (/^iCloud/i.test(name)) return 'iCloud+';
        if (/^YouTube/i.test(name)) return 'YouTube Premium';
        if (/^Bumble/i.test(name)) return 'Bumble';
        return name;
    }

    private parseDate(dateStr: string): string {
        try {
            return new Date(dateStr).toISOString();
        } catch {
            return dateStr;
        }
    }

    private findHtml(payload: any): string {
        if (!payload) return '';
        if (payload.mimeType === 'text/html' && payload.body?.data) {
            return Buffer.from(payload.body.data, 'base64').toString('utf-8');
        }
        if (payload.parts) {
            for (const part of payload.parts) {
                const r = this.findHtml(part);
                if (r) return r;
            }
        }
        return '';
    }

    private cleanHtml(html: string): string {
        return html
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/(?:p|div|tr|td|li|h[1-6])>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&#8209;/g, '-')
            .replace(/&#8217;/g, "'")
            .replace(/&#\d+;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&[a-z]+;/gi, ' ')
            .replace(/[ \t]+/g, ' ')
            .split('\n')
            .map(l => l.trim())
            .filter(Boolean)
            .join('\n');
    }
}

export default new ParseAppleEmails();
