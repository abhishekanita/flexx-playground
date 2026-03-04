import { PortfolioAnalysis } from '@/types/analysis';
import { BehavioralSignals } from '@/core/analyse/modules/dashboard-data.computer';
import { Actionable } from '@/types/advisory/actionable.type';
import { computeActionables } from '@/core/advisory/actionables';
import { insightsService } from '@/services/user/insights.service';

export class ActionablesService {
    /**
     * Compute actionables from the latest stored analysis for a user.
     */
    async getActionables(pan: string): Promise<Actionable[]> {
        const latest = await insightsService.getLatest(pan);
        if (!latest?.analysis) return [];

        return computeActionables(latest.analysis as PortfolioAnalysis);
    }

    /**
     * Compute actionables from a provided analysis (no DB lookup).
     */
    computeFromAnalysis(analysis: PortfolioAnalysis, behavioral?: BehavioralSignals): Actionable[] {
        return computeActionables(analysis, behavioral);
    }
}

export const actionablesService = new ActionablesService();
