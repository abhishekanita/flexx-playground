import { Tool } from 'ai';
import z from 'zod';
import { npciPlugin } from '@/plugins/npci/npci.plugin';
import { Mandate, UpiApp } from '@/plugins/npci/npci.type';

// ─── Session-scoped mandate cache ────────────────────────────────────────────

let cachedMandates: Mandate[] = [];

// ─── Tool definition ─────────────────────────────────────────────────────────

export const upiMandatesTool: Tool = {
    description:
        'Manage UPI autopay mandates — authenticate via OTP, fetch all mandates with AI-generated insights, ' +
        'and generate revoke deep links. Flow: initiate_auth → user provides OTP → confirm_otp → optionally get_revoke_qr.',
    inputSchema: z.object({
        action: z
            .enum(['initiate_auth', 'confirm_otp', 'fetch_mandates', 'get_revoke_qr'])
            .describe(
                'Action to perform. ' +
                    'initiate_auth: send OTP to mobile number. ' +
                    'confirm_otp: validate OTP, fetch mandates, and generate insights. ' +
                    'fetch_mandates: re-fetch mandates after auth (if already authenticated). ' +
                    'get_revoke_qr: generate a UPI deep link to revoke a specific mandate.'
            ),
        mobileNumber: z.string().describe('10-digit Indian mobile number'),
        otp: z.string().optional().describe('OTP received by user (required for confirm_otp)'),
        mandateUmn: z.string().optional().describe('UMN of the mandate to revoke (required for get_revoke_qr)'),
        upiApp: z
            .enum(['PAYTM', 'GOOGLE_PAY', 'PHONEPE', 'BHIM', 'CRED', 'AMAZON_PAY', 'WHATSAPP'])
            .optional()
            .describe('UPI app for the revoke deep link (default: GOOGLE_PAY)'),
    }),
    execute: async ({ action, mobileNumber, otp, mandateUmn, upiApp }) => {
        switch (action) {
            // ── Send OTP ─────────────────────────────────────────────────
            case 'initiate_auth': {
                const res = await npciPlugin.sendOTP(mobileNumber);
                return {
                    success: true,
                    message: res.message || 'OTP sent successfully. Ask the user for the OTP they received.',
                };
            }

            // ── Validate OTP + fetch mandates + insights ─────────────────
            case 'confirm_otp': {
                if (!otp) {
                    return { success: false, error: 'otp is required for confirm_otp action' };
                }

                await npciPlugin.validateOTP(mobileNumber, otp);
                const mandates = await npciPlugin.getMandates(mobileNumber);
                cachedMandates = mandates;
                const insights = await npciPlugin.generateInsights(mandates);

                return {
                    success: true,
                    mandateCount: mandates.length,
                    mandates,
                    insights,
                };
            }

            // ── Re-fetch mandates (already authenticated) ────────────────
            case 'fetch_mandates': {
                const mandates = await npciPlugin.getMandates(mobileNumber);
                cachedMandates = mandates;
                const insights = await npciPlugin.generateInsights(mandates);

                return {
                    success: true,
                    mandateCount: mandates.length,
                    mandates,
                    insights,
                };
            }

            // ── Generate revoke deep link ────────────────────────────────
            case 'get_revoke_qr': {
                if (!mandateUmn) {
                    return { success: false, error: 'mandateUmn is required for get_revoke_qr action' };
                }

                const mandate = cachedMandates.find(m => m.umn === mandateUmn);
                if (!mandate) {
                    return {
                        success: false,
                        error: `Mandate with UMN "${mandateUmn}" not found. Fetch mandates first.`,
                    };
                }

                const app: UpiApp = (upiApp as UpiApp) || 'GOOGLE_PAY';
                const deepLink = npciPlugin.generateRevokeLink(mandate, app);

                return {
                    success: true,
                    mandate: {
                        umn: mandate.umn,
                        payeeName: mandate.payeeName,
                        amount: mandate.amount,
                        status: mandate.status,
                    },
                    app,
                    deepLink,
                    instruction: 'Share this deep link with the user. When opened on their phone, it will launch the UPI app directly on the mandate revoke flow.',
                };
            }

            default:
                return { success: false, error: `Unknown action: ${action}` };
        }
    },
};
