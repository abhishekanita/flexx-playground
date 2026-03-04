import { config } from '@/config';
import { MandateModel, IMandateDoc, IntegrationGmailModel, AppleSubscriptionModel, IAppleSubscriptionDoc } from '@/schema';
import appleEmailParser from './apple-email-parser';
import logger from '@/utils/logger';
import { Mandate } from '@/plugins/npci/npci.type';

// ─── Unified subscription type returned by getSubscriptions ─────────────────

export interface UnifiedSubscription {
    id: string;
    name: string;
    amount: number;
    billingCycle: string;
    status: 'active' | 'inactive';
    source: 'apple_email' | 'npci' | 'combined';

    // Apple email data (when source is apple_email or combined)
    plan?: string;
    charges?: { date: string; amount: number }[];
    totalSpent?: number;
    lastChargeDate?: string;

    // NPCI mandate data (when source is npci or combined — enables cancellation)
    mandate?: {
        umn: string;
        payeeName: string;
        category: string;
        isPause: boolean;
        isRevoke: boolean;
        isUnpause: boolean;
        totalExecutionCount: number;
        totalExecutionAmount: number;
        status: string;
    };
}

// ─── Apple payee names in NPCI ───────────────────────────────────────────────

const APPLE_PAYEE_NAMES = ['apple services', 'apple media services'];

function isAppleMandate(mandate: IMandateDoc): boolean {
    return APPLE_PAYEE_NAMES.includes(mandate.payeeName.toLowerCase().trim());
}

// ─── Service class ──────────────────────────────────────────────────────────

class MandateService {
    private log = logger.createServiceLogger('MandateService');

    /**
     * Upsert NPCI mandates into the DB (called after NPCI sync).
     */
    async syncMandates(userId: string, mandates: Mandate[]): Promise<IMandateDoc[]> {
        if (mandates.length === 0) return [];

        const bulkOps = mandates.map(m => ({
            updateOne: {
                filter: { userId, umn: m.umn },
                update: {
                    $set: {
                        payeeName: m.payeeName,
                        amount: m.amount,
                        recurrance: m.recurrance,
                        status: m.status,
                        category: m.category,
                        totalExecutionCount: m.totalExecutionCount,
                        totalExecutionAmount: m.totalExecutionAmount,
                        isPause: m.isPause,
                        isRevoke: m.isRevoke,
                        isUnpause: m.isUnpause,
                        lastSyncedAt: new Date(),
                    },
                    $setOnInsert: {
                        userId,
                        umn: m.umn,
                        enrichmentStatus: 'pending',
                    },
                },
                upsert: true,
            },
        }));

        await MandateModel.bulkWrite(bulkOps);
        return MandateModel.find({ userId }).lean() as unknown as IMandateDoc[];
    }

    /**
     * Fetch Apple receipt emails, parse them, and cache in apple_subscriptions collection.
     */
    async syncAppleSubscriptions(userId: string, force = false): Promise<void> {
        const gmailIntegration = await IntegrationGmailModel.findOne({
            userId,
            isConnected: true,
        }).lean();

        if (!gmailIntegration) {
            this.log.info('No Gmail integration for Apple sync, skipping');
            return;
        }

        // Skip if synced recently (within last hour) unless forced
        if (!force) {
            const recentSync = await AppleSubscriptionModel.findOne({
                userId,
                lastSyncedAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
            }).lean();

            if (recentSync) {
                this.log.info('Apple subscriptions synced recently, skipping');
                return;
            }
        }

        this.log.info('Syncing Apple subscriptions from Gmail...');

        const subs = await appleEmailParser.parse(
            gmailIntegration.accessToken,
            gmailIntegration.refreshToken
        );

        this.log.info(`Parsed ${subs.length} Apple subscriptions from emails`);

        // Upsert each subscription
        for (const sub of subs) {
            await AppleSubscriptionModel.findOneAndUpdate(
                { userId, appName: sub.appName },
                {
                    $set: {
                        plan: sub.plan,
                        currentAmount: sub.currentAmount,
                        billingCycle: sub.billingCycle,
                        charges: sub.charges.map(c => ({ date: new Date(c.date), amount: c.amount })),
                        totalSpent: sub.totalSpent,
                        lastChargeDate: new Date(sub.lastChargeDate),
                        isActive: sub.isActive,
                        lastSyncedAt: new Date(),
                    },
                },
                { upsert: true }
            );
        }

        // Remove stale subscriptions that no longer appear in emails
        const currentAppNames = subs.map(s => s.appName);
        await AppleSubscriptionModel.deleteMany({
            userId,
            appName: { $nin: currentAppNames },
        });
    }

    /**
     * Returns a unified subscription list merging Apple email data + NPCI mandates.
     *
     * Logic:
     * - Non-Apple NPCI mandates → shown as-is (source: 'npci')
     * - Apple email subs matched to an Apple NPCI mandate by amount → combined (source: 'combined')
     * - Apple email subs with no NPCI match → shown standalone (source: 'apple_email')
     * - Apple NPCI mandates with no email match → dropped (email data is source of truth for Apple)
     */
    async getSubscriptions(userId: string): Promise<UnifiedSubscription[]> {
        const [npciMandates, appleSubs] = await Promise.all([
            MandateModel.find({ userId }).lean() as unknown as IMandateDoc[],
            AppleSubscriptionModel.find({ userId }).lean() as unknown as IAppleSubscriptionDoc[],
        ]);

        const results: UnifiedSubscription[] = [];

        // Separate NPCI mandates into Apple vs non-Apple
        const appleNpciMandates = npciMandates.filter(m => isAppleMandate(m));
        const nonAppleMandates = npciMandates.filter(m => !isAppleMandate(m));

        // 1. Add non-Apple NPCI mandates directly
        for (const m of nonAppleMandates) {
            results.push({
                id: m._id.toString(),
                name: this.formatPayeeName(m.payeeName),
                amount: m.amount,
                billingCycle: this.inferCycleFromRecurrence(m.recurrance),
                status: m.status === 'ACTIVE' ? 'active' : 'inactive',
                source: 'npci',
                mandate: {
                    umn: m.umn,
                    payeeName: m.payeeName,
                    category: m.category,
                    isPause: m.isPause,
                    isRevoke: m.isRevoke,
                    isUnpause: m.isUnpause,
                    totalExecutionCount: m.totalExecutionCount,
                    totalExecutionAmount: m.totalExecutionAmount,
                    status: m.status,
                },
            });
        }

        // 2. Match Apple email subs to Apple NPCI mandates by amount
        const usedMandateIds = new Set<string>();

        for (const sub of appleSubs) {
            // Find best matching NPCI mandate: exact amount, prefer ACTIVE, prefer unused
            const matchingMandate = appleNpciMandates
                .filter(m => !usedMandateIds.has(m._id.toString()) && m.amount === sub.currentAmount)
                .sort((a, b) => {
                    // Prefer ACTIVE over INACTIVE
                    if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
                    if (b.status === 'ACTIVE' && a.status !== 'ACTIVE') return 1;
                    return 0;
                })[0];

            const charges = sub.charges.map(c => ({
                date: new Date(c.date).toISOString(),
                amount: c.amount,
            }));

            if (matchingMandate) {
                usedMandateIds.add(matchingMandate._id.toString());
                results.push({
                    id: sub._id.toString(),
                    name: sub.appName,
                    amount: sub.currentAmount,
                    billingCycle: sub.billingCycle,
                    status: sub.isActive ? 'active' : 'inactive',
                    source: 'combined',
                    plan: sub.plan,
                    charges,
                    totalSpent: sub.totalSpent,
                    lastChargeDate: new Date(sub.lastChargeDate).toISOString(),
                    mandate: {
                        umn: matchingMandate.umn,
                        payeeName: matchingMandate.payeeName,
                        category: matchingMandate.category,
                        isPause: matchingMandate.isPause,
                        isRevoke: matchingMandate.isRevoke,
                        isUnpause: matchingMandate.isUnpause,
                        totalExecutionCount: matchingMandate.totalExecutionCount,
                        totalExecutionAmount: matchingMandate.totalExecutionAmount,
                        status: matchingMandate.status,
                    },
                });
            } else {
                // Apple email sub with no matching NPCI mandate
                results.push({
                    id: sub._id.toString(),
                    name: sub.appName,
                    amount: sub.currentAmount,
                    billingCycle: sub.billingCycle,
                    status: sub.isActive ? 'active' : 'inactive',
                    source: 'apple_email',
                    plan: sub.plan,
                    charges,
                    totalSpent: sub.totalSpent,
                    lastChargeDate: new Date(sub.lastChargeDate).toISOString(),
                });
            }
        }

        // Sort: active first, then by amount descending
        results.sort((a, b) => {
            if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
            return b.amount - a.amount;
        });

        return results;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private formatPayeeName(name: string): string {
        // Title case: "NETFLIX COM" → "Netflix"
        return name
            .split(/\s+/)
            .filter(w => !['COM', 'PVT', 'LTD', 'PRIVATE', 'LIMITED', 'INDIA'].includes(w.toUpperCase()))
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ')
            .trim();
    }

    private inferCycleFromRecurrence(recurrance: string): string {
        const r = recurrance.toLowerCase();
        if (r.includes('month')) return 'Monthly';
        if (r.includes('year') || r.includes('annual')) return 'Yearly';
        if (r.includes('week')) return 'Weekly';
        if (r.includes('quarter')) return 'Quarterly';
        return 'Monthly'; // default for CUSTOM
    }
}

export default new MandateService();
