import { BaseService } from '../base-service';
import { IGrowwAMCDoc, GrowwAMCModel } from '@/schema/market/groww-amc.schema';
import { GrowwAMC } from '@/types/market/groww-amc.type';

export class GrowwAMCService extends BaseService<IGrowwAMCDoc> {
	constructor() {
		super(GrowwAMCModel);
	}

	async upsertAMC(data: Partial<GrowwAMC>): Promise<IGrowwAMCDoc | null> {
		return this.model.findOneAndUpdate({ slug: data.slug }, { $set: data }, { upsert: true, new: true });
	}

	async getAllSlugs(): Promise<string[]> {
		const docs = await this.model.find({}).select('slug').lean();
		return docs.map((d) => d.slug);
	}
}

export const growwAMCService = new GrowwAMCService();
