import { google } from 'googleapis';
import { config } from '@/config';

export interface AppleCharge {
    app: string;
    plan: string;
    amount: number;
    date: string;
    renewsOn: string;
}

export interface AppleSubscription {
    appName: string;
    plan: string;
    currentAmount: number;
    billingCycle: string;
    charges: { date: string; amount: number }[];
    totalSpent: number;
    lastChargeDate: string;
    isActive: boolean;
}

class AppleEmailParser {
    /**
     * Fetches and parses all Apple invoice/receipt emails, returns grouped subscriptions.
     */
    async parse(accessToken: string, refreshToken: string): Promise<AppleSubscription[]> {
        const auth = new google.auth.OAuth2(
            config.google.clientId,
            config.google.clientSecret,
            config.google.redirectUrl
        );
        auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
        const gmail = google.gmail({ version: 'v1', auth });

        const query = 'from:no_reply@email.apple.com subject:(invoice OR receipt) after:2023/01/01';
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

        if (messageIds.length === 0) return [];

        const allCharges: AppleCharge[] = [];

        for (const msgId of messageIds) {
            const detail = await gmail.users.messages.get({
                userId: 'me',
                id: msgId,
                format: 'full',
            });

            const headers = detail.data.payload?.headers || [];
            const dateStr = headers.find(h => h.name === 'Date')?.value || '';
            const html = this.findHtml(detail.data.payload);
            const text = this.cleanHtml(html);

            const charge = this.parseNewFormat(text, dateStr) || this.parseOldFormat(text, dateStr);
            if (charge) {
                allCharges.push(charge);
            }
        }

        return this.groupCharges(allCharges);
    }

    private groupCharges(charges: AppleCharge[]): AppleSubscription[] {
        const byApp = new Map<string, AppleCharge[]>();
        for (const charge of charges) {
            const key = this.normalizeAppName(charge.app);
            if (!byApp.has(key)) byApp.set(key, []);
            byApp.get(key)!.push(charge);
        }

        const now = Date.now();

        return [...byApp.entries()].map(([appName, appCharges]) => {
            const sorted = appCharges.sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            );
            const latest = sorted[sorted.length - 1];
            const totalSpent = sorted.reduce((s, c) => s + c.amount, 0);
            const lastChargeDate = new Date(latest.date).toISOString();

            // Infer billing cycle from plan text or charge frequency
            let billingCycle = 'Monthly';
            if (latest.plan) {
                if (/annual|yearly/i.test(latest.plan)) billingCycle = 'Yearly';
                else if (/quarterly/i.test(latest.plan)) billingCycle = 'Quarterly';
                else if (/weekly/i.test(latest.plan)) billingCycle = 'Weekly';
            }

            // Determine if active based on billing cycle
            // If no charge for 1.5x the cycle period, consider paused/inactive
            const daysSinceLastCharge = (now - new Date(latest.date).getTime()) / (24 * 60 * 60 * 1000);
            const maxDays: Record<string, number> = { Weekly: 10, Monthly: 35, Quarterly: 100, Yearly: 380 };
            const isActive = daysSinceLastCharge < (maxDays[billingCycle] ?? 45);

            return {
                appName,
                plan: latest.plan || '',
                currentAmount: latest.amount,
                billingCycle,
                charges: sorted.map(c => ({
                    date: new Date(c.date).toISOString(),
                    amount: c.amount,
                })),
                totalSpent,
                lastChargeDate,
                isActive,
            };
        });
    }

    // ─── Email format parsers ────────────────────────────────────────────────

    private parseNewFormat(text: string, emailDate: string): AppleCharge | null {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

        const accountIdx = lines.findIndex(l => /^Apple (Account|ID):?$/i.test(l));
        if (accountIdx < 0 || !lines[accountIdx + 1]?.includes('@')) return null;

        const endIdx = lines.findIndex(
            (l, i) => i > accountIdx + 2 && /^(Billing and Payment|Subtotal)/i.test(l)
        );
        if (endIdx < 0) return null;

        const section = lines.slice(accountIdx + 2, endIdx);
        return this.extractFromSection(section, emailDate);
    }

    private parseOldFormat(text: string, emailDate: string): AppleCharge | null {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

        const storeIdx = lines.findIndex(l => /^(App Store|Apple TV)$/i.test(l));
        if (storeIdx < 0) return null;

        const storeHeader = lines[storeIdx];

        const endIdx = lines.findIndex(
            (l, i) => i > storeIdx && /^(Subtotal|TOTAL)/i.test(l)
        );
        if (endIdx < 0) return null;

        const section = lines.slice(storeIdx + 1, endIdx);
        const fallbackApp = /^Apple TV$/i.test(storeHeader) ? 'Apple TV+' : undefined;
        return this.extractFromSection(section, emailDate, fallbackApp);
    }

    private extractFromSection(
        section: string[],
        emailDate: string,
        fallbackApp?: string
    ): AppleCharge | null {
        let app = '';
        let plan = '';
        let amount = 0;
        let renewsOn = '';

        for (const line of section) {
            const amountMatch = line.match(/^₹\s*([\d,]+(?:\.\d{2})?)/);
            if (amountMatch) {
                amount = parseFloat(amountMatch[1].replace(/,/g, ''));
                continue;
            }

            if (/\((?:Monthly|Yearly|Annual|Weekly|Quarterly)\)/i.test(line)) {
                plan = line;
                continue;
            }

            if (/^SAC:/i.test(line)) continue;

            if (/^Renews/i.test(line)) {
                renewsOn = line.replace('Renews ', '');
                continue;
            }

            // Device line
            if (/[''\u2019]s\s+(iPhone|iPad|Mac|MacBook|Apple Watch)/i.test(line)) continue;
            if (/^.+\s(MacBook|iPhone|iPad)\s*(Air|Pro|Mini|Plus|Max)?$/i.test(line)) continue;

            if (/^Report a Problem/i.test(line)) continue;
            if (/^(In-App Purchase|Subscription)$/i.test(line)) continue;
            if (/^(BILLED TO|UPI|INVOICE|SEQUENCE|ORDER|DOCUMENT|IND$|Billing and Payment|Billing Information)/i.test(line)) continue;

            // Address lines
            if (/^\d{6}$/.test(line) || /^[A-Z]{2}$/.test(line)) continue;
            if (/^India$/i.test(line)) continue;
            if (/Pinjore|Aggarwal|Bitna|Haryana/i.test(line)) continue;

            // Date lines
            if (/^\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/i.test(line)) continue;

            if (/^(Store Credit|Store Credit and UPI|Apple Pay|Debit|Credit)$/i.test(line)) continue;
            if (/^(App Store|Apple TV)$/i.test(line)) continue;
            if (/^(Monthly|Yearly|Annual|Weekly|Quarterly|Free Trial)$/i.test(line)) continue;

            // Order/sequence IDs
            if (/^[A-Z0-9]{6,}$/.test(line)) continue;
            if (/^3-\d+$/.test(line)) continue;
            if (/^\d{9,}$/.test(line)) continue;

            if (/@/.test(line)) continue;

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

    // ─── Utilities ────────────────────────────────────────────────────────────

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

export default new AppleEmailParser();
