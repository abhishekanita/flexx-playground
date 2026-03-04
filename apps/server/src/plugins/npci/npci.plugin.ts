import axios, { AxiosInstance } from 'axios';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
// import qrcode from 'qrcode-terminal';
import {
    AccountMapping,
    CreateChatResponse,
    Mandate,
    MandateInsights,
    RawMandateMetadataResponse,
    RevokeResult,
    SendOTPResponse,
    UPI_APP_SCHEMES,
    UpiApp,
    ValidateOTPResponse,
} from './npci.type';
import { config } from '../../config';

// ─── Insights schema + prompt ─────────────────────────────────────────────────

const openai = createOpenAI({
    apiKey: config.openai.apiKey,
});

const mandateInsightsSchema = z.object({
    summary: z.object({
        totalMandates: z.number().describe('Total number of mandates'),
        activeMandates: z.number().describe('Number of ACTIVE mandates'),
        inactiveMandates: z.number().describe('Number of INACTIVE mandates'),
        totalAmountDebited: z.number().describe('Sum of totalExecutionAmount across all mandates'),
        maxMonthlyExposure: z.number().describe('Sum of amount (ceiling) for all ACTIVE mandates'),
        annualizedExposure: z.number().describe('maxMonthlyExposure × 12'),
    }),
    shockInsights: z
        .array(z.string())
        .describe(
            'Hard-hitting, specific insights designed to make the user go "wow". ' +
                'Use exact rupee amounts and percentages. ' +
                'E.g. "Netflix has silently drained ₹14,927 from your account over 23 months — 39% of all your autopay spend."'
        ),
    generalInsights: z
        .array(z.string())
        .describe('Useful, calmer observations about spending patterns, category distribution, mandate age, etc.'),
    topSpenders: z
        .array(
            z.object({
                payeeName: z.string(),
                totalSpent: z.number(),
                executionCount: z.number(),
            })
        )
        .describe('Top 5 mandates by totalExecutionAmount, descending'),
    categoryBreakdown: z
        .array(
            z.object({
                category: z.string(),
                count: z.number().describe('Number of mandates in this category'),
                maxExposure: z.number().describe('Sum of amount ceilings for ACTIVE mandates in this category'),
            })
        )
        .describe('Breakdown by mandate category'),
    risks: z
        .array(z.string())
        .describe(
            'Specific financial risks: zombie mandates, concentration on one vendor, ' +
                'high ceilings with low actual usage, inactive mandates that should be revoked, etc.'
        ),
    recommendations: z.array(z.string()).describe('Actionable next steps: which mandates to revoke, review, or watch'),
});

const INSIGHTS_SYSTEM_PROMPT = `You are an Indian personal finance analyst specializing in UPI autopay mandates.

You receive a JSON array of mandates. Each mandate has:
- payeeName, amount (max ceiling per cycle), status (ACTIVE/INACTIVE)
- category, recurrance
- totalExecutionCount (how many times it has charged), totalExecutionAmount (total ₹ actually debited)

Your job:
1. Compute hard numbers: total spend, max monthly exposure, annualized risk.
2. Produce 4-6 "shock insights" — punchy, specific, use exact ₹ amounts and percentages. These should make the user feel the weight of silent recurring charges.
3. Produce 3-5 general insights — calmer, useful patterns.
4. Identify the top 5 spenders by actual money debited.
5. Break down by category with exposure.
6. Flag 3-5 specific risks (zombie mandates, concentration, ceiling gaps).
7. Give 3-5 concrete recommendations (name specific mandates to revoke/review).

Use Indian Rupee (₹) formatting. Be direct, no fluff.`;

export class NPCIPlugin {
    private readonly baseUrl = 'https://www.upihelp.npci.org.in';
    private readonly client: AxiosInstance;

    // Auth state — populated after validateOTP succeeds
    private accessToken: string | null = null;
    private csrfToken: string | null = null;
    private sessionId: string | null = null;

    constructor() {
        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                accept: '*/*',
                'accept-language': 'en-GB,en;q=0.7',
                'content-type': 'application/json',
                origin: 'https://www.upihelp.npci.org.in',
                referer: 'https://www.upihelp.npci.org.in/',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'user-agent':
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
                    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                    'Chrome/144.0.0.0 Safari/537.36',
            },
        });
    }

    // ─── Auth ───────────────────────────────────────────────────────────────

    /**
     * Triggers OTP dispatch to the given mobile number.
     */
    async sendOTP(mobileNumber: string): Promise<SendOTPResponse> {
        const res = await this.client.post<SendOTPResponse>('auth/login', {
            mobile_number: mobileNumber,
        });
        return res.data;
    }

    /**
     * Validates the OTP and stores the access + CSRF tokens for subsequent calls.
     */
    async validateOTP(mobileNumber: string, otp: string): Promise<ValidateOTPResponse> {
        const res = await this.client.post<ValidateOTPResponse>('auth/validate', {
            mobile_number: mobileNumber,
            otp,
        });
        this.loginFromOTPResponse(res.data);
        return res.data;
    }

    loginFromOTPResponse(response: ValidateOTPResponse, cookies?: string): void {
        this.accessToken = response.access_token;
        this.csrfToken = response.csrf_token;
        this.sessionId = response.session_id;

        // Bearer token on every request
        this.client.defaults.headers.common['authorization'] = `Bearer ${this.accessToken}`;

        // Referer must contain the session_id for protected endpoints
        this.client.defaults.headers.common['referer'] = `${this.baseUrl}/thread/${this.sessionId}`;

        // Attach cookies if provided (needed for TS* / refresh_token on mandate endpoints)
        if (cookies) {
            this.client.defaults.headers.common['cookie'] = cookies;
        }
    }

    // ─── Mandate APIs ────────────────────────────────────────────────────────

    /**
     * Returns a flat list of all UPI autopay mandates for the given mobile number.
     */
    async getMandates(mobileNumber: string): Promise<Mandate[]> {
        const res = await this.client.post<RawMandateMetadataResponse>('messages/mandate/metadata/', {
            flag: 'mandates',
            mobile_number: mobileNumber,
        });

        return Object.entries(res.data).flatMap(([category, item]) =>
            item.mandates.map(m => ({
                umn: m.umn,
                payeeName: m['payee name'],
                amount: m.amount,
                recurrance: m.recurrance,
                status: m['Latest Status'],
                category,
                totalExecutionCount: m['Total Execution Count'],
                totalExecutionAmount: m['Total Execution Amount'],
                isPause: m.is_pause,
                isRevoke: m.is_revoke,
                isUnpause: m.is_unpause,
            }))
        );
    }

    /**
     * Returns the VPA → bank account mapping for the given mobile number.
     */
    async getAccountMapping(mobileNumber: string): Promise<AccountMapping> {
        const res = await this.client.post<AccountMapping>('messages/mandate/metadata/', { flag: 'mapper', mobile_number: mobileNumber });
        return res.data;
    }

    // ─── Revoke Deep Links ────────────────────────────────────────────────────

    /**
     * Builds a UPI deep-link string for revoking a mandate.
     * When encoded as a QR code and scanned, it opens the specified UPI app
     * directly on the mandate revoke flow.
     *
     * Format: [[UPI_APP]]<APP>[[/UPI_APP]][Intent_Link:true]<scheme>://mandate?pn=...&txnType=REVOKE&umn=...&mode=04&purpose=14
     */
    generateRevokeLink(mandate: Mandate, app: UpiApp): string {
        const scheme = UPI_APP_SCHEMES[app];
        const params = new URLSearchParams({
            pn: mandate.payeeName,
            txnType: 'REVOKE',
            umn: mandate.umn,
            mode: '04',
            purpose: '14',
        });

        return `[[UPI_APP]]${app}[[/UPI_APP]][Intent_Link:true]${scheme}://mandate?${params.toString()}`;
    }

    /**
     * Prints a scannable QR code to the console for revoking a mandate.
     */
    printRevokeQR(mandate: Mandate, app: UpiApp): void {
        const link = this.generateRevokeLink(mandate, app);
        console.log(`\nRevoke mandate: ${mandate.payeeName} (${mandate.umn})`);
        console.log(`App: ${app}\n`);
        // qrcode.generate(link, { small: true });
    }

    // ─── Revoke via NPCI Chat ─────────────────────────────────────────────────

    /**
     * Returns the raw mandate metadata (un-flattened) needed by the chat API.
     */
    async getRawMandateMetadata(mobileNumber: string): Promise<RawMandateMetadataResponse> {
        const res = await this.client.post<RawMandateMetadataResponse>('messages/mandate/metadata/', {
            flag: 'mandates',
            mobile_number: mobileNumber,
        });
        return res.data;
    }

    /**
     * Full revoke flow via NPCI chat:
     * 1. Fetch raw mandate metadata (or use provided summary)
     * 2. Create a chat session
     * 3. Fire the stream request to trigger NPCI bot processing (just drain it)
     * 4. GET /messages/{chatId} to fetch the structured bot response
     * 5. Parse the intent URL + app, print QR, return result
     */
    async revokeMandate(mobileNumber: string, mandate: Mandate, mandateSummary?: RawMandateMetadataResponse): Promise<RevokeResult> {
        const summary = mandateSummary ?? (await this.getRawMandateMetadata(mobileNumber));
        console.log('summary', summary);

        // 1. Create chat
        const { data: chat } = await this.client.post<CreateChatResponse>('chat', { title: 'New Chat' });
        console.log('chat', chat);
        const chatId = chat.chat.id;
        const threadReferer = `${this.baseUrl}/thread/${chatId}`;

        // 2. Set chat title
        const title = `Revoke the mandate for ${mandate.payeeName} with amount ₹${mandate.amount}`;
        const res = await this.client.post(`chat/${chatId}`, { title });
        console.log('sendinging message', res.data);

        // 3. Fire the stream request to trigger bot processing — capture data
        const streamData = await this.triggerStream(chatId, title, summary, threadReferer);
        console.log('[DEBUG] Stream data:', streamData.slice(0, 2000));

        // 4. Fetch the structured messages
        const messages = await this.getMessages(chatId, threadReferer);

        // 5. Try parsing intent URL from messages first, fall back to stream data
        const botContent = this.extractBotContent(messages);
        const source = botContent || streamData;
        const intentUrl = this.parseIntentUrl(source);
        const app = this.parseApp(source);

        if (!intentUrl) {
            throw new Error(
                `Could not extract revoke intent URL from NPCI response.\n` +
                    `Bot content:\n${botContent.slice(0, 500)}\n` +
                    `Stream data:\n${streamData.slice(0, 500)}`
            );
        }

        const result: RevokeResult = { intentUrl, app, mandate };

        // 6. Print to console
        console.log(`\nRevoke mandate: ${mandate.payeeName} (${mandate.umn})`);
        console.log(`App: ${app}`);
        console.log(`Intent: ${intentUrl}\n`);
        // qrcode.generate(intentUrl, { small: true });

        return result;
    }

    // ─── Mandate Insights ──────────────────────────────────────────────────────

    /**
     * Generates AI-powered insights from a list of mandates.
     * Uses GPT-4o-mini to produce shock-value stats and actionable recommendations.
     */
    async generateInsights(mandates: Mandate[]): Promise<MandateInsights> {
        const { object } = await generateObject({
            model: openai('gpt-4o-mini'),
            schema: mandateInsightsSchema as any,
            system: INSIGHTS_SYSTEM_PROMPT,
            prompt: JSON.stringify(mandates, null, 2),
            temperature: 0.4,
        });

        return object as MandateInsights;
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private async triggerStream(
        chatId: string,
        query: string,
        mandateSummary: RawMandateMetadataResponse,
        referer: string
    ): Promise<string> {
        try {
            const res = await this.client.post(
                'messages/stream',
                {
                    query,
                    chat_id: chatId,
                    attachments: [],
                    language: 'English',
                    mandate_summary: mandateSummary,
                },
                {
                    headers: { referer },
                    responseType: 'stream',
                }
            );

            // Drain the stream and capture data
            return await new Promise<string>((resolve, reject) => {
                let data = '';
                res.data.on('data', (chunk: Buffer) => {
                    data += chunk.toString();
                });
                res.data.on('end', () => resolve(data));
                res.data.on('error', reject);
            });
        } catch (err: any) {
            console.warn(`Stream request failed (${err.response?.status ?? err.message}), falling back to messages fetch.`);
            return '';
        }
    }

    private async getMessages(chatId: string, referer: string): Promise<any> {
        const res = await this.client.get(`messages/${chatId}`, {
            headers: { referer },
        });
        return res.data;
    }

    private extractBotContent(messages: any): string {
        // Dump raw shape so we can see what NPCI returns
        console.log('[DEBUG] Raw messages response:', JSON.stringify(messages, null, 2).slice(0, 2000));

        // messages may be an array or { messages: [...] } or other shapes
        const list: any[] = Array.isArray(messages) ? messages : messages?.messages ?? [];
        // Concatenate all assistant/bot message content (try common field names)
        return list
            .filter((m: any) => m.role === 'assistant' || m.sender === 'bot' || m.type === 'bot')
            .map((m: any) => m.content ?? m.text ?? m.message ?? m.body ?? JSON.stringify(m))
            .join('\n');
    }

    private parseIntentUrl(text: string): string | null {
        const match = text.match(/\[Intent_Link:true\]([^\s"\\]+)/);
        return match?.[1] ?? null;
    }

    private parseApp(text: string): string {
        const match = text.match(/\[\[UPI_APP\]\](\w+)\[\[\/UPI_APP\]\]/);
        return match?.[1] ?? 'UNKNOWN';
    }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const npciPlugin = new NPCIPlugin();
