import {
    NormalizedInvestmentOutput,
    NormalizedInvestmentAccount,
    NormalizedInvestmentHolding,
    NormalizedInvestmentTransaction,
    NormalizedFinancialAccount,
    InvestmentNormalizerFn,
} from './normalizer.types';

type EmailMeta = { rawEmailId: string; receivedAt: string };

function toYMD(dateStr: string | undefined): string {
    if (!dateStr) return '';
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    // DD/MM/YYYY or DD-MM-YYYY
    const dmy = dateStr.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
    // Try JS date parse
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return dateStr;
}

function parseAmount(v: any): number {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return parseFloat(v.replace(/,/g, '')) || 0;
    return 0;
}

function empty(): NormalizedInvestmentOutput {
    return { accounts: [], holdings: [], transactions: [], financialAccounts: [], rawParsed: {} };
}

// ── NSDL CAS ────────────────────────────────────────────────────────────────
// Authoritative source for equity holdings + MF holdings. Also has transactions.

export function normalizeNsdlCas(raw: Record<string, any>, meta: EmailMeta): NormalizedInvestmentOutput {
    const out = empty();
    out.rawParsed = raw;

    const holderName = raw.holderName || '';

    for (const demat of raw.dematAccounts || []) {
        const accountKey = `${demat.dpName || 'NSDL'}|${demat.dpId || demat.clientId}`;

        // Account
        out.accounts.push({
            platform: demat.dpName || 'NSDL',
            platform_type: 'depository',
            dp_id: demat.dpId,
            account_id: demat.clientId,
            holder_name: holderName,
            pan: raw.nsdlId, // NSDL uses NSDL ID (PAN-linked)
        });

        // Equity holdings
        for (const eq of demat.equities || []) {
            out.holdings.push({
                vehicle: 'stock',
                asset_class: 'equity',
                name: eq.companyName,
                isin: eq.isin,
                symbol: eq.stockSymbol,
                units: eq.shares,
                current_nav: eq.marketPrice,
                current_value: eq.value,
                face_value: eq.faceValue,
                snapshot_date: toYMD(meta.receivedAt),
                reconciliation_status: 'authoritative',
                account_key: accountKey,
            });
        }

        // MF holdings
        for (const mf of demat.mutualFunds || []) {
            out.holdings.push({
                vehicle: 'mutual_fund',
                asset_class: 'mutual_fund',
                name: mf.schemeName,
                isin: mf.isin,
                units: mf.units,
                locked_quantity: mf.lockedInUnits,
                current_nav: mf.nav,
                current_value: mf.value,
                snapshot_date: toYMD(meta.receivedAt),
                reconciliation_status: 'authoritative',
                account_key: accountKey,
            });
        }
    }

    // Transactions from CAS
    for (const tx of raw.transactions || []) {
        // Determine buy/sell from debit/credit
        const isDebit = (tx.debit || 0) > 0;
        const units = isDebit ? tx.debit : tx.credit;
        const txType = isDebit ? 'sell' : 'buy';

        out.transactions.push({
            tx_type: txType,
            tx_date: toYMD(tx.date),
            isin: tx.isin,
            security_name: tx.securityName,
            units,
            amount: 0, // CAS doesn't have monetary amounts for demat txns
            net_amount: 0,
            reconciliation_status: 'confirmed',
            account_key: out.accounts[0]
                ? `${out.accounts[0].platform}|${out.accounts[0].dp_id || out.accounts[0].account_id}`
                : 'NSDL|unknown',
            order_number: tx.orderNo,
            unit_balance_after: tx.closingBalance,
        });
    }

    return out;
}

// ── ICICI Securities Equity ─────────────────────────────────────────────────
// Source of truth for equity trade costs (brokerage, GST, STT, stamp duty)

export function normalizeIciciSecEquity(raw: Record<string, any>, meta: EmailMeta): NormalizedInvestmentOutput {
    const out = empty();
    out.rawParsed = raw;

    const accountKey = `ICICI Securities|${raw.tradingCode || raw.clientCode}`;

    // Account
    out.accounts.push({
        platform: 'ICICI Securities',
        platform_type: 'broker',
        account_id: raw.clientCode,
        trading_code: raw.tradingCode,
        pan: raw.pan,
    });

    // Build summary lookup for STT, stamp duty, transaction charges per contract
    const summaryMap: Record<string, any> = {};
    for (const s of raw.summary || []) {
        summaryMap[s.contractNumber] = s;
    }

    for (const trade of raw.trades || []) {
        const summary = summaryMap[trade.contractNumber] || {};
        out.transactions.push({
            tx_type: trade.buySell === 'B' ? 'buy' : 'sell',
            tx_date: toYMD(trade.tradeDate),
            settlement_date: toYMD(trade.settlementDate),
            isin: trade.isin,
            security_name: trade.security,
            exchange: trade.exchange,
            units: trade.quantity,
            nav: trade.ratePerSecurity,
            amount: trade.total,
            brokerage: trade.brokerage,
            gst: trade.gst,
            stt: summary.stt,
            stamp_duty: summary.stampDuty,
            transaction_charges: summary.transactionCharges,
            net_amount: summary.netTotal || trade.grossAmount,
            contract_number: trade.contractNumber,
            order_number: trade.tradeNo,
            broker: 'ICICI Securities',
            reconciliation_status: 'confirmed',
            account_key: accountKey,
        });
    }

    return out;
}

// ── Zerodha Demat Statement ─────────────────────────────────────────────────
// Holdings + demat-level transactions

export function normalizeZerodhaDemat(raw: Record<string, any>, meta: EmailMeta): NormalizedInvestmentOutput {
    const out = empty();
    out.rawParsed = raw;

    const accountKey = `Zerodha|${raw.tradingId || raw.clientId}`;

    out.accounts.push({
        platform: 'Zerodha',
        platform_type: 'broker',
        dp_id: raw.dpId,
        account_id: raw.clientId,
        trading_code: raw.tradingId,
        pan: raw.pan,
        holder_name: raw.holderName,
    });

    for (const h of raw.holdings || []) {
        out.holdings.push({
            vehicle: 'stock',
            asset_class: 'equity',
            name: h.companyName,
            isin: h.isin,
            units: h.currentBalance,
            locked_quantity: h.pledgeBalance + (h.earmarkBalance || 0),
            current_nav: h.rate,
            current_value: h.value,
            snapshot_date: toYMD(meta.receivedAt),
            reconciliation_status: 'authoritative',
            account_key: accountKey,
        });
    }

    for (const tx of raw.transactions || []) {
        const isBuy = (tx.buyCr || 0) > 0;
        out.transactions.push({
            tx_type: isBuy ? 'buy' : 'sell',
            tx_date: toYMD(tx.date),
            units: isBuy ? tx.buyCr : tx.sellDr,
            amount: 0,
            net_amount: 0,
            unit_balance_after: tx.balance,
            broker: 'Zerodha',
            reconciliation_status: 'email_only',
            account_key: accountKey,
        });
    }

    return out;
}

// ── Zerodha Equity Statement ────────────────────────────────────────────────
// Weekly/quarterly equity settlement ledger

export function normalizeZerodhaEquity(raw: Record<string, any>, meta: EmailMeta): NormalizedInvestmentOutput {
    const out = empty();
    out.rawParsed = raw;

    if (!raw.hasData) return out;

    const accountKey = `Zerodha|${raw.ledgerCode}`;

    out.accounts.push({
        platform: 'Zerodha',
        platform_type: 'broker',
        account_id: raw.ledgerCode,
    });

    for (const tx of raw.transactions || []) {
        out.transactions.push({
            tx_type: tx.transactionType || 'settlement',
            tx_date: toYMD(tx.transactionDate),
            settlement_date: toYMD(tx.executionDate),
            isin: tx.isin,
            security_name: tx.scripName,
            units: (tx.qtyDelivered || 0) + (tx.qtyReceived || 0),
            amount: 0,
            net_amount: 0,
            unit_balance_after: tx.balance,
            broker: 'Zerodha',
            channel: tx.segment,
            reconciliation_status: 'email_only',
            account_key: accountKey,
        });
    }

    return out;
}

// ── BSE Funds & Securities Balance ──────────────────────────────────────────

export function normalizeBseFundsBalance(raw: Record<string, any>, meta: EmailMeta): NormalizedInvestmentOutput {
    const out = empty();
    out.rawParsed = raw;

    const accountKey = `${raw.broker || 'BSE'}|${raw.clientCode}`;

    out.accounts.push({
        platform: raw.broker || 'BSE',
        platform_type: 'broker',
        account_id: raw.clientCode,
    });

    for (const sec of raw.securities || []) {
        out.holdings.push({
            vehicle: 'stock',
            asset_class: 'equity',
            name: sec.securityName,
            isin: sec.isin,
            units: sec.quantity,
            snapshot_date: toYMD(raw.reportDate),
            reconciliation_status: 'interim',
            account_key: accountKey,
        });
    }

    // Financial account: funds balance
    if (raw.fundsBalance != null) {
        out.financialAccounts.push({
            provider: raw.broker || 'BSE',
            account_type: 'trading',
            account_identifier: raw.clientCode,
            current_balance: raw.fundsBalance,
        });
    }

    return out;
}

// ── NSE Funds & Securities Balance ──────────────────────────────────────────

export function normalizeNseFundsBalance(raw: Record<string, any>, meta: EmailMeta): NormalizedInvestmentOutput {
    const out = empty();
    out.rawParsed = raw;

    const accountKey = `${raw.broker || 'NSE'}|${raw.clientCode}`;

    out.accounts.push({
        platform: raw.broker || 'NSE',
        platform_type: 'broker',
        account_id: raw.clientCode,
    });

    for (const sec of raw.securities || []) {
        out.holdings.push({
            vehicle: 'stock',
            asset_class: 'equity',
            name: sec.name,
            isin: sec.isin,
            units: sec.quantity,
            snapshot_date: toYMD(raw.reportDate),
            reconciliation_status: 'interim',
            account_key: accountKey,
        });
    }

    if (raw.fundsBalance != null) {
        out.financialAccounts.push({
            provider: raw.broker || 'NSE',
            account_type: 'trading',
            account_identifier: raw.clientCode,
            current_balance: raw.fundsBalance,
        });
    }

    return out;
}

// ── NSE Trade Confirmation ──────────────────────────────────────────────────

export function normalizeNseTradeConfirmation(raw: Record<string, any>, meta: EmailMeta): NormalizedInvestmentOutput {
    const out = empty();
    out.rawParsed = raw;

    for (const trade of raw.trades || []) {
        out.transactions.push({
            tx_type: trade.buySell?.toLowerCase() === 'b' ? 'buy' : 'sell',
            tx_date: toYMD(raw.tradeDate),
            security_name: trade.symbol,
            units: trade.quantity,
            nav: trade.price,
            amount: trade.value,
            net_amount: trade.value,
            exchange: 'NSE',
            reconciliation_status: 'email_only',
            account_key: `NSE|${raw.pan || 'unknown'}`,
        });
    }

    return out;
}

// ── INDmoney Statement ──────────────────────────────────────────────────────

export function normalizeIndmoneyStatement(raw: Record<string, any>, meta: EmailMeta): NormalizedInvestmentOutput {
    const out = empty();
    out.rawParsed = raw;

    if (!raw.hasData) return out;

    out.accounts.push({
        platform: 'INDmoney',
        platform_type: 'broker',
        account_id: raw.clientCode,
        pan: raw.pan,
        holder_name: raw.clientName,
    });

    // INDmoney entries are ledger items — not per-security transactions
    // Store as financial account balance info
    if (raw.entries?.length > 0) {
        const lastEntry = raw.entries[raw.entries.length - 1];
        out.financialAccounts.push({
            provider: 'INDmoney',
            account_type: 'trading',
            account_identifier: raw.clientCode,
            current_balance: lastEntry.balance,
        });
    }

    return out;
}

// ── ICICI Demat Statement ───────────────────────────────────────────────────

export function normalizeIciciDemat(raw: Record<string, any>, meta: EmailMeta): NormalizedInvestmentOutput {
    const out = empty();
    out.rawParsed = raw;

    const accountKey = `ICICI Bank Demat|${raw.dpId || raw.clientId}`;

    out.accounts.push({
        platform: 'ICICI Bank',
        platform_type: 'depository',
        dp_id: raw.dpId,
        account_id: raw.clientId,
    });

    for (const h of raw.holdings || []) {
        out.holdings.push({
            vehicle: 'stock',
            asset_class: 'equity',
            name: h.name,
            isin: h.isin,
            units: h.quantity,
            snapshot_date: toYMD(meta.receivedAt),
            reconciliation_status: 'interim',
            account_key: accountKey,
        });
    }

    for (const tx of raw.transactions || []) {
        const isBuy = (tx.credit || 0) > 0;
        out.transactions.push({
            tx_type: isBuy ? 'buy' : 'sell',
            tx_date: toYMD(tx.date),
            isin: tx.isin,
            units: isBuy ? tx.credit : tx.debit,
            amount: 0,
            net_amount: 0,
            unit_balance_after: tx.balance,
            reconciliation_status: 'email_only',
            account_key: accountKey,
        });
    }

    return out;
}

// ── KFintech MF Valuation (declarative) ─────────────────────────────────────

export function normalizeKfintechValuation(raw: Record<string, any>, meta: EmailMeta): NormalizedInvestmentOutput {
    const out = empty();
    out.rawParsed = raw;

    const accountKey = `KFintech|${raw.folio || 'unknown'}`;

    out.holdings.push({
        vehicle: 'mutual_fund',
        asset_class: 'mutual_fund',
        name: raw.schemeName || '',
        folio_number: raw.folio,
        amc: raw.fundHouse,
        units: 0, // valuation email doesn't always have units
        current_nav: raw.nav,
        current_value: parseAmount(raw.valuation),
        snapshot_date: toYMD(raw.valuationDate),
        reconciliation_status: 'interim',
        account_key: accountKey,
    });

    return out;
}

// ── KFintech MF Redemption (declarative) ────────────────────────────────────

export function normalizeKfintechRedemption(raw: Record<string, any>, meta: EmailMeta): NormalizedInvestmentOutput {
    const out = empty();
    out.rawParsed = raw;

    const accountKey = `KFintech|${raw.folio || 'unknown'}`;

    out.transactions.push({
        tx_type: 'redemption',
        tx_date: toYMD(raw.date || meta.receivedAt),
        security_name: raw.schemeName || raw.fund || '',
        units: raw.units,
        nav: raw.nav,
        amount: parseAmount(raw.amount),
        exit_load: parseAmount(raw.exitLoad),
        stt: parseAmount(raw.stt),
        net_amount: parseAmount(raw.amount) - parseAmount(raw.exitLoad) - parseAmount(raw.stt),
        reconciliation_status: 'email_only',
        account_key: accountKey,
    });

    return out;
}

// ── Zerodha Coin Redemption (declarative) ───────────────────────────────────

export function normalizeZerodhaCoinRedemption(raw: Record<string, any>, meta: EmailMeta): NormalizedInvestmentOutput {
    const out = empty();
    out.rawParsed = raw;

    const accountKey = `Zerodha|${raw.clientId || 'unknown'}`;

    for (const r of raw.redemptions || []) {
        out.transactions.push({
            tx_type: 'redemption',
            tx_date: toYMD(raw.date || meta.receivedAt),
            security_name: r.fund,
            units: r.units,
            nav: r.nav,
            amount: parseAmount(r.amount),
            exit_load: parseAmount(r.exitLoad),
            stt: parseAmount(r.stt),
            net_amount: parseAmount(r.amount) - parseAmount(r.exitLoad) - parseAmount(r.stt),
            broker: 'Zerodha',
            reconciliation_status: 'email_only',
            account_key: accountKey,
        });
    }

    return out;
}

// ── Zerodha Coin Sell Order (declarative) ───────────────────────────────────

export function normalizeZerodhaCoinSellOrder(raw: Record<string, any>, meta: EmailMeta): NormalizedInvestmentOutput {
    const out = empty();
    out.rawParsed = raw;

    const accountKey = `Zerodha|${raw.clientId || 'unknown'}`;

    out.transactions.push({
        tx_type: raw.orderType?.toLowerCase() || 'sell',
        tx_date: toYMD(meta.receivedAt),
        security_name: raw.fund,
        units: raw.quantity,
        amount: 0,
        net_amount: 0,
        broker: 'Zerodha',
        reconciliation_status: 'pending',
        account_key: accountKey,
    });

    return out;
}

// ── Zerodha Demat AMC (declarative) ─────────────────────────────────────────

export function normalizeZerodhaDematAmc(raw: Record<string, any>, meta: EmailMeta): NormalizedInvestmentOutput {
    const out = empty();
    out.rawParsed = raw;

    // AMC charge — store as a fee transaction
    out.transactions.push({
        tx_type: 'fee',
        tx_date: toYMD(meta.receivedAt),
        security_name: raw.chargeType || 'Demat AMC',
        amount: parseAmount(raw.totalAmount),
        net_amount: parseAmount(raw.totalAmount),
        broker: 'Zerodha',
        reconciliation_status: 'email_only',
        account_key: `Zerodha|unknown`,
    });

    return out;
}

// ── Dividend emails (declarative) ───────────────────────────────────────────

export function normalizeDividend(raw: Record<string, any>, meta: EmailMeta): NormalizedInvestmentOutput {
    const out = empty();
    out.rawParsed = raw;

    out.transactions.push({
        tx_type: 'dividend',
        tx_date: toYMD(meta.receivedAt),
        security_name: raw.company,
        units: parseFloat(raw.shares) || undefined,
        amount: parseAmount(raw.grossAmount),
        tds_deducted: parseAmount(raw.tds),
        net_amount: parseAmount(raw.netAmount || raw.grossAmount),
        dividend_per_unit: parseAmount(raw.perShare || raw.dividendPerShare),
        financial_year: raw.financialYear,
        reconciliation_status: 'confirmed',
        account_key: `dividend|${raw.company || 'unknown'}`,
    });

    return out;
}
