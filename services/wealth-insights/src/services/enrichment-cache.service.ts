/**
 * Enrichment cache service.
 *
 * Provides typed get/set operations for cached enrichment data in MongoDB.
 * Each data type has its own TTL — MongoDB's TTL index auto-deletes expired entries.
 *
 * Usage pattern in providers (two-level cache):
 *   1. Check in-memory Map (instant, per-process)
 *   2. Check MongoDB via this service (persistent across restarts)
 *   3. Fetch from external API (slow, rate-limited)
 *   4. Store in both caches
 */

import { BaseService } from './base-service';
import {
    EnrichmentCacheModel,
    IEnrichmentCacheDoc,
    EnrichmentDataType,
} from '@/schema/enrichment-cache.schema';
import logger from '@/utils/logger';

const log = logger.createServiceLogger('EnrichmentCache');

/** TTL in hours per data type */
const TTL_HOURS: Record<EnrichmentDataType, number> = {
    benchmark: 24,
    nav_history: 24,
    fund_metadata: 24,
    amfi_master: 24,
    holdings: 720,      // 30 days
    market_cap: 168,    // 7 days
};

class EnrichmentCacheService extends BaseService<IEnrichmentCacheDoc> {
    constructor() {
        super(EnrichmentCacheModel);
    }

    /**
     * Get a single cached entry. Returns null if not found or expired.
     */
    async get<T = any>(dataType: EnrichmentDataType, key: string): Promise<T | null> {
        try {
            const doc = await this.findOne({ dataType, key });
            if (!doc) return null;
            return doc.data as T;
        } catch {
            return null;
        }
    }

    /**
     * Store a single entry with auto-calculated expiry.
     */
    async set(dataType: EnrichmentDataType, key: string, data: any): Promise<void> {
        const ttlHours = TTL_HOURS[dataType] || 24;
        const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

        try {
            await this.model.findOneAndUpdate(
                { dataType, key },
                { $set: { data, fetchedAt: new Date(), expiresAt } },
                { upsert: true, new: true },
            );
        } catch (err) {
            log.warn(`Failed to cache ${dataType}:${key}: ${(err as Error).message}`);
        }
    }

    /**
     * Get multiple cached entries by keys. Returns a Map of key → data.
     * Only returns entries that exist and haven't expired.
     */
    async getMany<T = any>(dataType: EnrichmentDataType, keys: string[]): Promise<Map<string, T>> {
        const map = new Map<string, T>();
        if (keys.length === 0) return map;

        try {
            const docs = await this.find({ dataType, key: { $in: keys } } as any);
            for (const doc of docs) {
                map.set(doc.key, doc.data as T);
            }
        } catch {
            // Silent fail — callers will fetch fresh on cache miss
        }

        return map;
    }

    /**
     * Store multiple entries in bulk. Uses bulkWrite with upserts for efficiency.
     */
    async setMany(dataType: EnrichmentDataType, entries: { key: string; data: any }[]): Promise<void> {
        if (entries.length === 0) return;

        const ttlHours = TTL_HOURS[dataType] || 24;
        const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
        const now = new Date();

        const ops = entries.map(({ key, data }) => ({
            updateOne: {
                filter: { dataType, key },
                update: { $set: { dataType, key, data, fetchedAt: now, expiresAt } },
                upsert: true,
            },
        }));

        try {
            await this.bulkWrite(ops);
            log.debug(`Cached ${entries.length} ${dataType} entries`);
        } catch (err) {
            log.warn(`Failed to bulk cache ${dataType}: ${(err as Error).message}`);
        }
    }

    /**
     * Get all cached entries for a data type. Useful for bulk-loading (e.g., AMFI master).
     */
    async getAll<T = any>(dataType: EnrichmentDataType): Promise<Map<string, T>> {
        try {
            const docs = await this.find({ dataType } as any);
            const map = new Map<string, T>();
            for (const doc of docs) {
                map.set(doc.key, doc.data as T);
            }
            return map;
        } catch {
            return new Map();
        }
    }

    /**
     * Check if fresh data exists for a given type and key.
     */
    async has(dataType: EnrichmentDataType, key: string): Promise<boolean> {
        try {
            const doc = await this.findOne({ dataType, key });
            return doc !== null;
        } catch {
            return false;
        }
    }

    /**
     * Invalidate (delete) cached entries.
     * If key is provided, deletes just that entry. Otherwise deletes all entries of the type.
     */
    async invalidate(dataType: EnrichmentDataType, key?: string): Promise<void> {
        try {
            if (key) {
                await this.deleteOne({ dataType, key });
            } else {
                await this.model.deleteMany({ dataType });
                log.info(`Invalidated all ${dataType} cache entries`);
            }
        } catch (err) {
            log.warn(`Failed to invalidate ${dataType}: ${(err as Error).message}`);
        }
    }

    /**
     * Get cache stats for observability.
     */
    async getStats(): Promise<{ dataType: string; count: number; oldestFetch: Date | null }[]> {
        try {
            const results = await this.model.aggregate([
                {
                    $group: {
                        _id: '$dataType',
                        count: { $sum: 1 },
                        oldestFetch: { $min: '$fetchedAt' },
                    },
                },
                { $sort: { _id: 1 } },
            ]);

            return results.map((r) => ({
                dataType: r._id,
                count: r.count,
                oldestFetch: r.oldestFetch,
            }));
        } catch {
            return [];
        }
    }
}

export const enrichmentCache = new EnrichmentCacheService();
