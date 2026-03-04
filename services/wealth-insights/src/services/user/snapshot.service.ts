import { BaseService } from '../base-service';
import { IMFUserSnapshotDoc, MFUserSnapshotModel } from '@/schema/user/user-snapshot.schema';
import { IMFUserFolioDoc } from '@/schema/user/user-folios.schema';
import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { SnapshotHolding, SnapshotFundHouse } from '@/types/storage/user-snapshot.type';
import { daysBetween } from '@/core/analyse/helpers/financial-math';
import logger from '@/utils/logger';

const log = logger.createServiceLogger('SnapshotService');

export class SnapshotService extends BaseService<IMFUserSnapshotDoc> {
    constructor() {
        super(MFUserSnapshotModel);
    }

    /**
     * Recompute and upsert the snapshot for a PAN from stored folios + original statement data.
     */
    async recomputeSnapshot(
        pan: string,
        data: MFDetailedStatementData,
        activeFolios: IMFUserFolioDoc[],
    ): Promise<IMFUserSnapshotDoc | null> {
        const now = new Date();

        // Compute holdings from active folios
        const totalMV = activeFolios.reduce((s, f) => s + (f.snapshot?.marketValue || 0), 0);
        const holdings: SnapshotHolding[] = activeFolios.map(f => {
            const costValue = f.snapshot?.costValue || 0;
            const marketValue = f.snapshot?.marketValue || 0;
            const unrealisedGain = marketValue - costValue;
            const unrealisedGainPct = costValue > 0 ? (unrealisedGain / costValue) * 100 : 0;
            const firstDate = f.firstTransactionDate || '';
            const lastDate = f.lastTransactionDate || '';
            const navDate = f.snapshot?.navDate || '';
            const holdingDays = firstDate && navDate
                ? daysBetween(new Date(firstDate), new Date(navDate))
                : 0;

            return {
                folioNumber: f.folioNumber,
                fundHouse: f.fundHouse,
                schemeName: f.scheme?.currentName || '',
                isin: f.scheme?.isin || '',
                plan: f.scheme?.plan || 'Regular',
                nav: f.snapshot?.nav || 0,
                navDate,
                units: f.closingUnitBalance || 0,
                costValue,
                marketValue,
                unrealisedGain,
                unrealisedGainPct: Math.round(unrealisedGainPct * 100) / 100,
                weight: totalMV > 0 ? Math.round((marketValue / totalMV) * 10000) / 100 : 0,
                firstTransactionDate: firstDate,
                lastTransactionDate: lastDate,
                holdingDays,
                hasNominee: (f.investor?.nominees?.length || 0) > 0,
            };
        }).sort((a, b) => b.weight - a.weight);

        // Compute fund house summary
        const fundHouseMap = new Map<string, { costValue: number; marketValue: number }>();
        for (const h of holdings) {
            const existing = fundHouseMap.get(h.fundHouse) || { costValue: 0, marketValue: 0 };
            existing.costValue += h.costValue;
            existing.marketValue += h.marketValue;
            fundHouseMap.set(h.fundHouse, existing);
        }

        const fundHouseSummary: SnapshotFundHouse[] = Array.from(fundHouseMap.entries())
            .map(([fundHouse, vals]) => {
                const gain = vals.marketValue - vals.costValue;
                return {
                    fundHouse,
                    costValue: vals.costValue,
                    marketValue: vals.marketValue,
                    gain,
                    gainPct: vals.costValue > 0 ? Math.round((gain / vals.costValue) * 10000) / 100 : 0,
                    weight: totalMV > 0 ? Math.round((vals.marketValue / totalMV) * 10000) / 100 : 0,
                };
            })
            .sort((a, b) => b.weight - a.weight);

        // Compute summary from holdings + statement data
        const totalCostValue = holdings.reduce((s, h) => s + h.costValue, 0);
        const totalUnrealisedGain = totalMV - totalCostValue;
        const totalUnrealisedGainPct = totalCostValue > 0 ? (totalUnrealisedGain / totalCostValue) * 100 : 0;

        // Compute invested/withdrawn from statement transactions
        let totalInvested = 0;
        let totalWithdrawn = 0;
        for (const folio of data.folios) {
            for (const tx of folio.transactions) {
                if (tx.amount === null) continue;
                const isPurchase = ['Purchase', 'SIP', 'NFO Allotment', 'Switch In', 'STP In'].includes(tx.type);
                const isRedemption = ['Redemption', 'SIP Redemption', 'SWP', 'Switch Out', 'STP Out'].includes(tx.type);
                if (isPurchase && tx.amount > 0) totalInvested += tx.amount;
                if (isRedemption) totalWithdrawn += Math.abs(tx.amount);
            }
        }

        const closedFolioCount = data.folios.filter(f => f.closingUnitBalance <= 0).length;
        const lifetimePnL = totalWithdrawn + totalMV - totalInvested;
        const lifetimePnLPct = totalInvested > 0 ? (lifetimePnL / totalInvested) * 100 : 0;

        // Determine widest statement period
        const existing = await this.model.findOne({ pan }).lean();
        let statementPeriod = data.statementPeriod;
        if (existing?.statementPeriod) {
            statementPeriod = {
                from: existing.statementPeriod.from < data.statementPeriod.from
                    ? existing.statementPeriod.from
                    : data.statementPeriod.from,
                to: existing.statementPeriod.to > data.statementPeriod.to
                    ? existing.statementPeriod.to
                    : data.statementPeriod.to,
            };
        }

        const result = await this.model.findOneAndUpdate(
            { pan },
            {
                $set: {
                    pan,
                    investor: {
                        name: data.investor.name,
                        email: data.investor.email,
                        pan: data.investor.pan,
                    },
                    statementPeriod,
                    summary: {
                        totalCostValue,
                        totalMarketValue: totalMV,
                        totalUnrealisedGain,
                        totalUnrealisedGainPct: Math.round(totalUnrealisedGainPct * 100) / 100,
                        activeFolioCount: activeFolios.length,
                        closedFolioCount,
                        totalInvested: Math.round(totalInvested),
                        totalWithdrawn: Math.round(totalWithdrawn),
                        lifetimePnL: Math.round(lifetimePnL),
                        lifetimePnLPct: Math.round(lifetimePnLPct * 100) / 100,
                    },
                    holdings,
                    fundHouseSummary,
                    lastSyncedAt: now,
                },
                $inc: { syncCount: 1 },
            },
            { upsert: true, new: true }
        );

        log.info(`Snapshot upserted for PAN ${pan.slice(-4)} — ${activeFolios.length} active folios, MV ₹${Math.round(totalMV).toLocaleString('en-IN')}`);
        return result;
    }

    async getSnapshot(pan: string): Promise<IMFUserSnapshotDoc | null> {
        return this.model.findOne({ pan }).lean();
    }
}

export const snapshotService = new SnapshotService();
