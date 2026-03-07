import { IParserConfigDoc, ParserConfigModel } from '@/schema/parser-configs.schema';
import { BaseService } from '../base-service';

class ParserConfigService extends BaseService<IParserConfigDoc> {
    constructor() {
        super(ParserConfigModel);
    }

    /** Get all active parser configs, optionally filtered for a specific user. */
    async getActiveConfigs(userId?: string): Promise<IParserConfigDoc[]> {
        const query: any = { active: true };
        if (userId) {
            query.$or = [
                { activeForUserIds: { $size: 0 } }, // available to all
                { activeForUserIds: userId },
            ];
        }
        return this.model.find(query).sort({ provider: 1, id: 1 });
    }

    /** Get a single parser config by its slug id. */
    async getBySlug(id: string): Promise<IParserConfigDoc | null> {
        return this.model.findOne({ id });
    }

    /** Activate or deactivate a parser. */
    async setActive(id: string, active: boolean): Promise<IParserConfigDoc | null> {
        return this.model.findOneAndUpdate(
            { id },
            { active, statusUpdatedAt: new Date().toISOString() },
            { new: true }
        );
    }

    /** Bump version and optionally update rules. */
    async bumpVersion(
        id: string,
        updates: { declarativeRules?: any; codeModule?: string }
    ): Promise<IParserConfigDoc | null> {
        const config = await this.model.findOne({ id });
        if (!config) return null;

        const now = new Date().toISOString();

        // Close current version in history
        const history = config.stats?.versionHistory || [];
        if (history.length > 0) {
            history[history.length - 1].deactivatedAt = now;
            history[history.length - 1].successRate = config.stats?.successRate || 0;
            history[history.length - 1].totalAttempts = config.stats?.totalAttempts || 0;
        }

        const newVersion = (config.version || 1) + 1;
        history.push({
            version: newVersion,
            activatedAt: now,
            successRate: 0,
            totalAttempts: 0,
        });

        return this.model.findOneAndUpdate(
            { id },
            {
                ...updates,
                version: newVersion,
                'stats.versionHistory': history,
            },
            { new: true }
        );
    }

    /**
     * Record a parse attempt result — updates stats atomically.
     * Call after every parse attempt (success or failure).
     */
    async recordAttempt(
        id: string,
        result: {
            success: boolean;
            confidence: number; // fieldsFound / totalFields
            fieldResults: Record<string, boolean>; // fieldName → wasFound
        }
    ): Promise<void> {
        const now = new Date().toISOString();
        const inc: Record<string, number> = {
            'stats.totalAttempts': 1,
        };

        if (result.success) {
            inc['stats.successCount'] = 1;
        } else {
            inc['stats.failCount'] = 1;
        }

        // Per-field stats
        for (const [field, found] of Object.entries(result.fieldResults)) {
            if (found) {
                inc[`stats.fieldStats.${field}.found`] = 1;
            } else {
                inc[`stats.fieldStats.${field}.missing`] = 1;
            }
        }

        const set: Record<string, any> = {};
        if (result.success) {
            set['stats.lastSuccess'] = now;
        } else {
            set['stats.lastFailure'] = now;
        }

        await this.model.updateOne({ id }, { $inc: inc, $set: set });

        // Recompute success rate (read-after-write for accuracy)
        const config = await this.model.findOne({ id }, { stats: 1 }).lean();
        if (config?.stats) {
            const total = config.stats.totalAttempts || 1;
            const successRate = (config.stats.successCount || 0) / total;
            const avgConfidence =
                ((config.stats.avgConfidence || 0) * (total - 1) + result.confidence) / total;

            await this.model.updateOne(
                { id },
                { $set: { 'stats.successRate': successRate, 'stats.avgConfidence': avgConfidence } }
            );
        }
    }

    /** Get parsers with low reliability (for review dashboard). */
    async getDegradedParsers(threshold = 0.8): Promise<IParserConfigDoc[]> {
        return this.model.find({
            active: true,
            'stats.totalAttempts': { $gte: 10 },
            'stats.successRate': { $lt: threshold },
        });
    }

    /** Get stats summary for all active parsers. */
    async getStatsOverview(): Promise<
        Array<{
            id: string;
            name: string;
            provider: string;
            version: number;
            successRate: number;
            totalAttempts: number;
            avgConfidence: number;
        }>
    > {
        return this.model
            .find({ active: true }, {
                id: 1,
                name: 1,
                provider: 1,
                version: 1,
                'stats.successRate': 1,
                'stats.totalAttempts': 1,
                'stats.avgConfidence': 1,
            })
            .lean()
            .then((docs) =>
                docs.map((d: any) => ({
                    id: d.id,
                    name: d.name,
                    provider: d.provider,
                    version: d.version,
                    successRate: d.stats?.successRate || 0,
                    totalAttempts: d.stats?.totalAttempts || 0,
                    avgConfidence: d.stats?.avgConfidence || 0,
                }))
            );
    }
}

export const parserConfigService = new ParserConfigService();
