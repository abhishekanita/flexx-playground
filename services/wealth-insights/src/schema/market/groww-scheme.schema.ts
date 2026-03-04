import { GrowwScheme } from '@/types/market/groww-scheme.type';
import { Document, Schema, model } from 'mongoose';

export interface IGrowwSchemeDoc extends Document, Omit<GrowwScheme, '_id'> {}

const schema = new Schema<IGrowwSchemeDoc>(
	{
		searchId: { type: String, required: true },
		schemeName: { type: String, required: true },
		fundHouse: { type: String, required: true },
		category: { type: String },
		subCategory: { type: String },
		schemeType: { type: String },
		plan: { type: String },
		logoUrl: { type: String },

		nav: { type: Number },
		navDate: { type: String },
		aum: { type: Number },

		returns: { type: Schema.Types.Mixed, default: null },

		growwRating: { type: Number },
		crisilRating: { type: Number },

		minSipAmount: { type: Number },
		minLumpsum: { type: Number },

		// Deep sync fields
		isin: { type: String, default: null },
		benchmarkName: { type: String, default: null },
		exitLoad: { type: String, default: null },
		stampDuty: { type: String, default: null },
		expenseRatio: { type: Number, default: null },
		fundManagerDetails: { type: Schema.Types.Mixed, default: null },
		holdings: { type: Schema.Types.Mixed, default: null },
		riskStats: { type: Schema.Types.Mixed, default: null },
		sipReturns: { type: Schema.Types.Mixed, default: null },
		categoryRank: { type: Schema.Types.Mixed, default: null },
		categoryAvgReturns: { type: Schema.Types.Mixed, default: null },
		expenseHistory: { type: Schema.Types.Mixed, default: null },
		launchDate: { type: String, default: null },
		lockInPeriod: { type: String, default: null },

		// Sync metadata
		lastLightSyncAt: { type: Date },
		lastDeepSyncAt: { type: Date, default: null },
		deepSyncFailed: { type: Boolean, default: false },
		deepSyncError: { type: String, default: null },
	},
	{
		timestamps: true,
		versionKey: false,
		collection: 'mfs.market.schemes',
	},
);

schema.index({ searchId: 1 }, { unique: true });
schema.index({ category: 1, subCategory: 1 });
schema.index({ fundHouse: 1 });
schema.index({ isin: 1 }, { sparse: true });

export const GrowwSchemeModel = model<IGrowwSchemeDoc>('mfs.market.schemes', schema);
