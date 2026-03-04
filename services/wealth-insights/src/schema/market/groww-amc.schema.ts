import { GrowwAMC } from '@/types/market/groww-amc.type';
import { Document, Schema, model } from 'mongoose';

export interface IGrowwAMCDoc extends Document, Omit<GrowwAMC, '_id'> {}

const schema = new Schema<IGrowwAMCDoc>(
	{
		slug: { type: String, required: true },
		name: { type: String, required: true },
		totalAum: { type: Number },
		schemeCount: { type: Number },
		lastLightSyncAt: { type: Date },
		lastDeepSyncAt: { type: Date, default: null },
	},
	{
		timestamps: true,
		versionKey: false,
		collection: 'mfs.market.amcs',
	},
);

schema.index({ slug: 1 }, { unique: true });

export const GrowwAMCModel = model<IGrowwAMCDoc>('mfs.market.amcs', schema);
