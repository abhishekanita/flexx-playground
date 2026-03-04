import { Skeleton } from '@/components/ui/skeleton';
import { useMFInsights } from '../hooks/use-mf-insights';
import { HeroSection } from '../components/hero-section';
import { InsightSpotlight } from '../components/insight-spotlight';
import { FundRace } from '../components/fund-race';
import { PortfolioTreemap } from '../components/portfolio-treemap';
import { InvestmentHeatmap } from '../components/investment-heatmap';
import { BenchmarkChart } from '../components/benchmark-chart';
import { FundCardsList } from '../components/fund-cards-list';
import { ClosedFundsTable } from '../components/closed-funds-table';
import { AssetAllocation } from '../components/asset-allocation';
import { SectorAllocation } from '../components/sector-allocation';
import { TopHoldings } from '../components/top-holdings';
import { MarketCapDistribution } from '../components/market-cap-distribution';
import { DashboardSkeleton } from '../components/dashboard-skeleton';

export const MFDashboardPage = () => {
    const { data, isLoading, error } = useMFInsights();
    const dashboard = data?.dashboardData;
    const insightCards = data?.insightCards?.cards || [];

    return (
        <div className="mx-auto max-w-6xl px-6 py-8 pb-20">
            {isLoading && <DashboardSkeleton />}

            {error && (
                <div className="text-center py-20">
                    <p className="text-sm text-muted-foreground">Failed to load insights. Try again later.</p>
                </div>
            )}

            {dashboard && (
                <div className="grid grid-cols-12 gap-5 auto-rows-min">
                    {/* Row 1: Hero (8) + Real World (4) */}
                    <div className="col-span-8">
                        <HeroSection heroStats={dashboard.heroStats} />
                    </div>
                    {insightCards.length > 0 && (
                        <div className="col-span-4">
                            <InsightSpotlight cards={insightCards} />
                        </div>
                    )}

                    {/* Row 2: Fund Race (6) + Portfolio Treemap (6) */}
                    {dashboard.fundRace.length > 0 && (
                        <div className="col-span-6">
                            <FundRace funds={dashboard.fundRace} />
                        </div>
                    )}
                    {dashboard.portfolioMap.length > 0 && (
                        <div className="col-span-6">
                            <PortfolioTreemap blocks={dashboard.portfolioMap} />
                        </div>
                    )}

                    {/* Row 3: Asset (4) + Sector (4) + Market Cap (4) */}
                    {dashboard.assetAllocation && (
                        <div className="col-span-4">
                            <AssetAllocation bars={dashboard.assetAllocation} />
                        </div>
                    )}
                    {dashboard.sectorAllocation && (
                        <div className="col-span-4">
                            <SectorAllocation data={dashboard.sectorAllocation} />
                        </div>
                    )}
                    {dashboard.marketCapDistribution && (
                        <div className="col-span-4">
                            <MarketCapDistribution bars={dashboard.marketCapDistribution} />
                        </div>
                    )}

                    {/* Row 4: Heatmap (8) + Top Holdings (4) */}
                    {dashboard.heatmap.length > 0 && (
                        <div className="col-span-8">
                            <InvestmentHeatmap heatmap={dashboard.heatmap} />
                        </div>
                    )}
                    {dashboard.topHoldings && (
                        <div className="col-span-4">
                            <TopHoldings data={dashboard.topHoldings} />
                        </div>
                    )}

                    {/* Row 5: Benchmark (4) + Fund Cards (8) */}
                    {dashboard.benchmarkBars.length > 0 && (
                        <div className="col-span-4">
                            <BenchmarkChart bars={dashboard.benchmarkBars} />
                        </div>
                    )}
                    {dashboard.fundCards.length > 0 && (
                        <div className="col-span-8">
                            <FundCardsList funds={dashboard.fundCards} />
                        </div>
                    )}

                    {/* Row 6: Closed Funds (full width) */}
                    <div className="col-span-12">
                        <ClosedFundsTable funds={dashboard.closedFunds} />
                    </div>
                </div>
            )}
        </div>
    );
};
