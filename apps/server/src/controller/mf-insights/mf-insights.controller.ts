import { mfInsightsService } from '@/services/mf-insights/mf-insights.service';
import { IRequest, IResponse } from '@/types/server';

export class MFInsightsController {
    async getInsights(req: IRequest, res: IResponse) {
        const { pan } = req.params;
        if (!pan) {
            return res.status(400).json({ error: 'PAN is required' });
        }

        const latest = await mfInsightsService.getLatest(pan.toUpperCase());
        if (!latest) {
            return res.status(404).json({ error: 'No insights found for this PAN' });
        }

        return res.json({
            pan: latest.pan,
            email: latest.email,
            version: latest.version,
            generatedAt: latest.generatedAt,
            trigger: latest.trigger,
            dashboardData: latest.dashboardData,
            insightCards: latest.insightCards,
            insightCardsStatus: latest.insightCardsStatus,
            nextScheduledRefresh: latest.nextScheduledRefresh,
            llmCostUsd: latest.llmCostUsd,
        });
    }

    async getDashboard(req: IRequest, res: IResponse) {
        const { pan } = req.params;
        if (!pan) {
            return res.status(400).json({ error: 'PAN is required' });
        }

        const dashboardData = await mfInsightsService.getDashboardData(pan.toUpperCase());
        if (!dashboardData) {
            return res.status(404).json({ error: 'No dashboard data found' });
        }

        return res.json(dashboardData);
    }

    async getCards(req: IRequest, res: IResponse) {
        const { pan } = req.params;
        if (!pan) {
            return res.status(400).json({ error: 'PAN is required' });
        }

        const latest = await mfInsightsService.getLatest(pan.toUpperCase());
        if (!latest) {
            return res.status(404).json({ error: 'No insights found' });
        }

        return res.json({
            insightCards: latest.insightCards,
            insightCardsStatus: latest.insightCardsStatus,
        });
    }
}
