/**
 * Enrichment cache schema.
 * Collection: mfs.enriched.cache
 *
 * Stores cached enrichment data from external APIs (Yahoo Finance, MFAPI, Kuvera, AMFI, etc.)
 * with automatic TTL-based expiry. Prevents redundant API calls across process restarts.
 *
 * Data types and their TTLs:
 *   benchmark      — 24h  (market data changes daily)
 *   nav_history    — 24h  (NAV updates daily)
 *   fund_metadata  — 24h  (TER/AUM/ratings — daily refresh)
 *   amfi_master    — 24h  (scheme registry — rarely changes)
 *   holdings       — 720h (30 days — AMCs publish monthly per SEBI mandate)
 *   market_cap     — 168h (7 days — market caps shift but weekly is fine)
 */

import { Document, Schema, model } from 'mongoose';

export type EnrichmentDataType =
    | 'benchmark'
    | 'nav_history'
    | 'fund_metadata'
    | 'amfi_master'
    | 'holdings'
    | 'market_cap';

export interface IEnrichmentCacheDoc extends Document {
    dataType: EnrichmentDataType;
    key: string;
    data: any;
    fetchedAt: Date;
    expiresAt: Date;
}

const schema = new Schema<IEnrichmentCacheDoc>(
    {
        dataType: {
            type: String,
            required: true,
            enum: ['benchmark', 'nav_history', 'fund_metadata', 'amfi_master', 'holdings', 'market_cap'],
        },
        key: { type: String, required: true },
        data: { type: Schema.Types.Mixed, required: true },
        fetchedAt: { type: Date, required: true, default: Date.now },
        expiresAt: { type: Date, required: true },
    },
    {
        timestamps: false,
        versionKey: false,
        collection: 'mfs.enriched.cache',
    }
);

// Unique compound index — one entry per (dataType, key) pair
schema.index({ dataType: 1, key: 1 }, { unique: true });

// TTL index — MongoDB automatically deletes documents when expiresAt passes
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Fast lookups by dataType alone (for bulk reads like "all amfi_master entries")
schema.index({ dataType: 1, fetchedAt: -1 });

export const EnrichmentCacheModel = model<IEnrichmentCacheDoc>('mfs.enriched.cache', schema);
