import { useQuery } from '@tanstack/react-query';
import { mfInsightsApi } from '../services/mf-insights.service';
import { type MFInsightsResponse } from '../types';

// Hardcoded for now — will come from user context later
const DEFAULT_PAN = 'BSCPA0434K';

export function useMFInsights(pan: string = DEFAULT_PAN) {
    return useQuery<MFInsightsResponse>({
        queryKey: ['mf-insights', pan],
        queryFn: () => mfInsightsApi.getInsights(pan),
    });
}
