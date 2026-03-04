import { BaseService } from '../base-service';
import { IGrowwSchemeDoc, GrowwSchemeModel } from '@/schema/market/groww-scheme.schema';
import { GrowwScheme } from '@/types/market/groww-scheme.type';

export class GrowwSchemeService extends BaseService<IGrowwSchemeDoc> {
	constructor() {
		super(GrowwSchemeModel);
	}

	async bulkUpsertSchemes(schemes: Partial<GrowwScheme>[]): Promise<number> {
		if (!schemes.length) return 0;

		const ops = schemes.map((s) => ({
			updateOne: {
				filter: { searchId: s.searchId },
				update: { $set: s },
				upsert: true,
			},
		}));

		const result = await this.bulkWrite(ops);
		return result.upsertedCount + result.modifiedCount;
	}

	async getSearchIdsNeedingDeepSync(olderThanDays: number = 7, limit?: number): Promise<string[]> {
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - olderThanDays);

		const query = {
			$or: [{ lastDeepSyncAt: null }, { lastDeepSyncAt: { $lt: cutoff } }],
			deepSyncFailed: { $ne: true },
		};

		const docs = await this.model
			.find(query)
			.select('searchId')
			.limit(limit || 0)
			.lean();

		return docs.map((d) => d.searchId);
	}

	async findByIsin(isin: string): Promise<IGrowwSchemeDoc | null> {
		return this.model.findOne({ isin }).lean();
	}

	async findBySearchId(searchId: string): Promise<IGrowwSchemeDoc | null> {
		return this.model.findOne({ searchId }).lean();
	}

	async findByCategory(category: string, subCategory?: string): Promise<IGrowwSchemeDoc[]> {
		const query: any = { category };
		if (subCategory) query.subCategory = subCategory;
		return this.model.find(query).lean();
	}
}

export const growwSchemeService = new GrowwSchemeService();
