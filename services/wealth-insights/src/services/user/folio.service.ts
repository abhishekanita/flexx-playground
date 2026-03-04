import { BaseService } from '../base-service';
import { IMFUserFolioDoc, MFUserFolioModel } from '@/schema/user/user-folios.schema';
import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import logger from '@/utils/logger';

const log = logger.createServiceLogger('FolioService');

export class FolioService extends BaseService<IMFUserFolioDoc> {
    constructor() {
        super(MFUserFolioModel);
    }

    /**
     * Upsert all folios from a parsed statement.
     * Returns count of upserted folios.
     */
    async upsertFromStatement(pan: string, email: string, data: MFDetailedStatementData): Promise<number> {
        const now = new Date();
        let upsertCount = 0;

        for (const folio of data.folios) {
            const firstTx = folio.transactions[0];
            const lastTx = folio.transactions[folio.transactions.length - 1];

            await this.model.findOneAndUpdate(
                { pan, folioNumber: folio.folioNumber },
                {
                    $set: {
                        pan,
                        email,
                        folioNumber: folio.folioNumber,
                        fundHouse: folio.fundHouse,
                        scheme: {
                            schemeName: folio.scheme.schemeName,
                            schemeCode: folio.scheme.scheme_code,
                            isin: folio.scheme.isin,
                            currentName: folio.scheme.current_name,
                            plan: folio.scheme.plan,
                            option: folio.scheme.option,
                            dematStatus: folio.scheme.dematStatus,
                            registrar: folio.scheme.registrar,
                            advisor: folio.scheme.advisor,
                        },
                        investor: {
                            holderName: folio.investor.holderName,
                            nominees: folio.investor.nominees || [],
                            kycOk: folio.investor.kycOk,
                            panOk: folio.investor.panOk,
                        },
                        openingUnitBalance: folio.openingUnitBalance,
                        closingUnitBalance: folio.closingUnitBalance,
                        snapshot: {
                            navDate: folio.snapshot.navDate,
                            nav: folio.snapshot.nav,
                            costValue: folio.snapshot.totalCostValue,
                            marketValue: folio.snapshot.marketValue,
                        },
                        status: folio.closingUnitBalance > 0 ? 'active' : 'closed',
                        stampDutyTotal: folio.stampDutyTotal,
                        transactionCount: folio.transactions.length,
                        firstTransactionDate: firstTx?.date || '',
                        lastTransactionDate: lastTx?.date || '',
                        lastSyncedAt: now,
                    },
                },
                { upsert: true, new: true }
            );
            upsertCount++;
        }

        log.info(`Upserted ${upsertCount} folios for PAN ${pan.slice(-4)}`);
        return upsertCount;
    }

    async getActiveFolios(pan: string): Promise<IMFUserFolioDoc[]> {
        return this.model.find({ pan, status: 'active' }).lean();
    }

    async getAllFolios(pan: string): Promise<IMFUserFolioDoc[]> {
        return this.model.find({ pan }).lean();
    }

    async getFoliosByStatus(pan: string, status: 'active' | 'closed'): Promise<IMFUserFolioDoc[]> {
        return this.model.find({ pan, status }).lean();
    }
}

export const folioService = new FolioService();
