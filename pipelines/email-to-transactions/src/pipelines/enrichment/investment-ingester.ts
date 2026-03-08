import { createHash } from 'crypto';
import { investmentAccountService } from '@/services/investments/investment-account.service';
import { investmentHoldingService } from '@/services/investments/investment-holding.service';
import { investmentTransactionService } from '@/services/investments/investment-transaction.service';
import { financialAccountService } from '@/services/accounts/financial-account.service';
import {
    NormalizedInvestmentOutput,
    NormalizedInvestmentAccount,
    NormalizedInvestmentHolding,
    NormalizedInvestmentTransaction,
    NormalizedFinancialAccount,
} from './normalizers/normalizer.types';

export interface InvestmentIngestionResult {
    accountsUpserted: number;
    holdingsReplaced: number;
    holdingsInserted: number;
    transactionsCreated: number;
    transactionsDeduplicated: number;
    financialAccountsUpserted: number;
}

function buildInvestmentTxFingerprint(
    userId: string,
    tx: NormalizedInvestmentTransaction
): string {
    const parts = [
        userId,
        tx.tx_type,
        tx.tx_date,
        tx.isin || tx.security_name || '',
        tx.amount?.toString() || '0',
        tx.units?.toString() || '0',
        tx.contract_number || tx.order_number || '',
    ].join('|');
    return createHash('sha256').update(parts).digest('hex').slice(0, 32);
}

export async function ingestInvestmentData(
    userId: string,
    data: NormalizedInvestmentOutput,
    sourceEmailId: string,
    receivedAt: Date
): Promise<InvestmentIngestionResult> {
    const result: InvestmentIngestionResult = {
        accountsUpserted: 0,
        holdingsReplaced: 0,
        holdingsInserted: 0,
        transactionsCreated: 0,
        transactionsDeduplicated: 0,
        financialAccountsUpserted: 0,
    };

    // ── 1. Upsert investment accounts ────────────────────────────────────
    const accountIdMap: Record<string, string> = {}; // account_key → mongo _id

    // Helper: resolve account_key to mongo _id, auto-creating if needed
    const resolveAccountId = async (accountKey: string): Promise<string> => {
        if (accountIdMap[accountKey]) return accountIdMap[accountKey];

        // Parse account_key: "Platform|account_id_or_dp_id"
        const [platform, identifier] = accountKey.split('|');
        const doc = await investmentAccountService.upsertAccount(
            userId,
            { platform, account_id: identifier },
            {
                user_id: userId,
                platform,
                platform_type: 'broker',
                account_id: identifier,
            } as any
        );
        accountIdMap[accountKey] = doc._id.toString();
        return doc._id.toString();
    };

    for (const acct of data.accounts) {
        const doc = await investmentAccountService.upsertAccount(
            userId,
            {
                platform: acct.platform,
                account_id: acct.account_id,
                dp_id: acct.dp_id,
            },
            {
                user_id: userId,
                platform: acct.platform,
                platform_type: acct.platform_type,
                account_id: acct.account_id,
                dp_id: acct.dp_id,
                trading_code: acct.trading_code,
                pan: acct.pan,
                holder_name: acct.holder_name,
                nominees: acct.nominees,
                kyc_ok: acct.kyc_ok,
            } as any
        );
        const key = `${acct.platform}|${acct.account_id || acct.dp_id}`;
        accountIdMap[key] = doc._id.toString();
        result.accountsUpserted++;
    }

    // ── 2. Replace or insert holdings ────────────────────────────────────
    // Group holdings by account_key + reconciliation_status
    const authoritativeHoldings: Record<string, NormalizedInvestmentHolding[]> = {};
    const interimHoldings: NormalizedInvestmentHolding[] = [];

    for (const h of data.holdings) {
        if (h.reconciliation_status === 'authoritative') {
            const key = h.account_key;
            if (!authoritativeHoldings[key]) authoritativeHoldings[key] = [];
            authoritativeHoldings[key].push(h);
        } else {
            interimHoldings.push(h);
        }
    }

    // Authoritative holdings: full replacement per account
    for (const [accountKey, holdings] of Object.entries(authoritativeHoldings)) {
        const accountId = await resolveAccountId(accountKey);

        const snapshotDate = holdings[0]?.snapshot_date || new Date().toISOString().slice(0, 10);
        const holdingDocs = holdings.map(h => ({
            user_id: userId,
            investment_account_id: accountId,
            vehicle: h.vehicle,
            asset_class: h.asset_class,
            name: h.name,
            isin: h.isin,
            symbol: h.symbol,
            folio_number: h.folio_number,
            amfi_code: h.amfi_code,
            mf_plan: h.mf_plan,
            mf_option: h.mf_option,
            amc: h.amc,
            rta: h.rta,
            units: h.units,
            locked_quantity: h.locked_quantity,
            current_nav: h.current_nav,
            current_value: h.current_value,
            total_invested: h.total_invested,
            face_value: h.face_value,
            snapshot_date: snapshotDate,
            reconciliation_status: 'authoritative',
            source: 'email',
            source_email_id: sourceEmailId,
            status: 'active',
        }));

        await investmentHoldingService.replaceHoldings(accountId, 'email', snapshotDate, holdingDocs as any);
        result.holdingsReplaced += holdingDocs.length;
    }

    // Interim holdings: insert without replacing (e.g., BSE/NSE balance reports)
    for (const h of interimHoldings) {
        const accountId = await resolveAccountId(h.account_key);
        await investmentHoldingService.create({
            user_id: userId,
            investment_account_id: accountId,
            vehicle: h.vehicle,
            asset_class: h.asset_class,
            name: h.name,
            isin: h.isin,
            symbol: h.symbol,
            folio_number: h.folio_number,
            units: h.units,
            locked_quantity: h.locked_quantity,
            current_nav: h.current_nav,
            current_value: h.current_value,
            snapshot_date: h.snapshot_date,
            reconciliation_status: 'interim',
            source: 'email',
            source_email_id: sourceEmailId,
            status: 'active',
        } as any);
        result.holdingsInserted++;
    }

    // ── 3. Dedup + create investment transactions ────────────────────────
    for (const tx of data.transactions) {
        const fingerprint = buildInvestmentTxFingerprint(userId, tx);
        const accountId = await resolveAccountId(tx.account_key);

        // Check for existing by fingerprint
        const existing = await investmentTransactionService.findByFingerprint(fingerprint);
        if (existing) {
            // Add this email as an additional signal
            await investmentTransactionService.addSignalToExisting(
                existing._id.toString(),
                {
                    source: 'email',
                    email_id: sourceEmailId,
                    received_at: receivedAt,
                    parsed_data: data.rawParsed,
                }
            );
            result.transactionsDeduplicated++;
            continue;
        }

        // Check for existing by ISIN + date (for matching across sources)
        if (tx.isin && tx.tx_date) {
            const isinMatches = await investmentTransactionService.findByIsinAndDate(userId, tx.isin, tx.tx_date);
            const sameTypeSameUnits = isinMatches.find(
                (m: any) => m.tx_type === tx.tx_type && Math.abs((m.units || 0) - (tx.units || 0)) < 0.01
            );
            if (sameTypeSameUnits) {
                await investmentTransactionService.addSignalToExisting(
                    sameTypeSameUnits._id.toString(),
                    {
                        source: 'email',
                        email_id: sourceEmailId,
                        received_at: receivedAt,
                        parsed_data: data.rawParsed,
                    }
                );
                result.transactionsDeduplicated++;
                continue;
            }
        }

        // Check for existing by contract number (ICICI Securities)
        if (tx.contract_number) {
            const contractMatches = await investmentTransactionService.findByContractNumber(userId, tx.contract_number);
            if (contractMatches.length > 0) {
                // Same contract — add signal to first match
                await investmentTransactionService.addSignalToExisting(
                    contractMatches[0]._id.toString(),
                    {
                        source: 'email',
                        email_id: sourceEmailId,
                        received_at: receivedAt,
                        parsed_data: data.rawParsed,
                    }
                );
                result.transactionsDeduplicated++;
                continue;
            }
        }

        // Create new investment transaction
        await investmentTransactionService.create({
            user_id: userId,
            fingerprint,
            investment_account_id: accountId,
            tx_type: tx.tx_type,
            tx_date: tx.tx_date,
            settlement_date: tx.settlement_date,
            isin: tx.isin,
            security_name: tx.security_name,
            exchange: tx.exchange,
            units: tx.units,
            nav: tx.nav,
            amount: tx.amount,
            brokerage: tx.brokerage,
            gst: tx.gst,
            stt: tx.stt,
            stamp_duty: tx.stamp_duty,
            exit_load: tx.exit_load,
            transaction_charges: tx.transaction_charges,
            net_amount: tx.net_amount,
            unit_balance_after: tx.unit_balance_after,
            contract_number: tx.contract_number,
            order_number: tx.order_number,
            broker: tx.broker,
            channel: tx.channel,
            advisor_code: tx.advisor_code,
            tds_deducted: tx.tds_deducted,
            dividend_per_unit: tx.dividend_per_unit,
            financial_year: tx.financial_year,
            reconciliation_status: tx.reconciliation_status,
            signal_count: 1,
            source_signals: [{
                source: 'email',
                email_id: sourceEmailId,
                received_at: receivedAt,
                parsed_data: data.rawParsed,
            }],
            source_email_id: sourceEmailId,
        } as any);
        result.transactionsCreated++;
    }

    // ── 4. Upsert financial accounts ─────────────────────────────────────
    for (const fa of data.financialAccounts) {
        await financialAccountService.upsertAccount(
            userId,
            fa.provider,
            fa.account_identifier,
            {
                user_id: userId,
                provider: fa.provider,
                account_type: fa.account_type,
                account_identifier: fa.account_identifier,
                card_network: fa.card_network,
                card_variant: fa.card_variant,
                upi_vpa: fa.upi_vpa,
                current_balance: fa.current_balance,
            } as any
        );
        result.financialAccountsUpserted++;
    }

    return result;
}
