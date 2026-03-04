import { BaseService } from '@/definitions/base/BaseService';
import { IMFUserInsightsDoc, MFUserInsightsModel } from '@/schema/mf-insights/user-insights.schema';
import { DashboardData } from '@/types/mf-insights';
import { InsightCardsResult } from '@/types/mf-insights';

export class MFInsightsService extends BaseService<IMFUserInsightsDoc> {
    constructor() {
        super(MFUserInsightsModel);
    }

    async getLatest(pan: string): Promise<IMFUserInsightsDoc | null> {
        return this.model.findOne({ pan }).sort({ generatedAt: -1 }).lean();
    }

    async getDashboardData(pan: string): Promise<DashboardData | null> {
        const latest = await this.getLatest(pan);
        return latest?.dashboardData || null;
    }

    async getInsightCards(pan: string): Promise<InsightCardsResult | null> {
        const latest = await this.getLatest(pan);
        return latest?.insightCards || null;
    }
}

export const mfInsightsService = new MFInsightsService();
