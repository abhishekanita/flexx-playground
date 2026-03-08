import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { TransactionModel } from '@/schema/transaction.schema';
import { TransactionSignalModel } from '@/schema/transaction-signal.schema';
import { InvestmentTransactionModel } from '@/schema/investment-transaction.schema';
import { InvestmentAccountModel } from '@/schema/investment-account.schema';
import { InvestmentHoldingModel } from '@/schema/investment-holding.schema';
import * as fs from 'fs';
import * as path from 'path';

const USER_ID = '69ad593fb3726a47dec36515';

const CATEGORY_COLORS: Record<string, string> = {
    food_delivery: '#FF6B35',
    cab_ride: '#0984E3',
    groceries: '#00B894',
    subscription: '#6C5CE7',
    ecommerce: '#E17055',
    flight: '#D63031',
    emi: '#636E72',
    restaurant: '#FDCB6E',
    ott: '#A29BFE',
    mobile_recharge: '#55EFC4',
    investment: '#00CEC9',
    transfer: '#74B9FF',
    train: '#FAB1A0',
    hotel: '#FF7675',
    rent: '#DFE6E9',
    atm_withdrawal: '#B2BEC3',
    pharmacy: '#81ECEC',
    salary: '#2ECC71',
    broadband: '#E056A0',
    electricity: '#F1C40F',
    insurance: '#8E44AD',
    unknown: '#B0B0A8',
    other: '#95A5A6',
};

const TX_TYPE_COLORS: Record<string, string> = {
    buy: '#3bf78e',
    sell: '#ff4d6a',
    redemption: '#ffb347',
    dividend: '#5ba4f5',
    sip: '#6C5CE7',
    switch_in: '#00B894',
    switch_out: '#E17055',
    fee: '#636E72',
    bonus: '#FDCB6E',
    rights: '#A29BFE',
    ipo: '#55EFC4',
    unknown: '#95A5A6',
};

function formatMonth(key: string): string {
    const [y, m] = key.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(m) - 1]} ${y}`;
}

function toMonthKey(d: Date | string): string {
    const date = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(date.getTime())) return 'unknown';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function fmt(n: number): string {
    if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
    if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
    if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
    return `₹${n.toFixed(0)}`;
}

async function main() {
    await databaseLoader();

    // ── Spending transactions ──────────────────────────────────
    const spendingTxns = await TransactionModel.find({ user_id: USER_ID }).lean();
    const signals = await TransactionSignalModel.find({
        transaction_id: { $in: spendingTxns.map(t => t._id.toString()) },
    }).lean();

    // Build signal map
    const signalsByTxnId: Record<string, any[]> = {};
    for (const s of signals) {
        if (!signalsByTxnId[s.transaction_id]) signalsByTxnId[s.transaction_id] = [];
        signalsByTxnId[s.transaction_id].push(s);
    }

    // ── Investment transactions ─────────────────────────────────
    const investTxns = await InvestmentTransactionModel.find({ user_id: USER_ID }).lean();
    const investAccounts = await InvestmentAccountModel.find({ user_id: USER_ID }).lean();
    const investHoldings = await InvestmentHoldingModel.find({ user_id: USER_ID }).lean();

    // Build account ID → name map
    const acctMap: Record<string, any> = {};
    for (const a of investAccounts) {
        acctMap[a._id.toString()] = a;
    }

    // ── Group spending by month ────────────────────────────────
    const spendingByMonth: Record<string, any[]> = {};
    for (const t of spendingTxns) {
        const key = toMonthKey(t.tx_date);
        if (key === 'unknown') continue;
        if (!spendingByMonth[key]) spendingByMonth[key] = [];
        spendingByMonth[key].push({
            _id: t._id.toString(),
            date: t.tx_date,
            amount: t.amount,
            type: t.type,
            channel: t.channel || 'UNKNOWN',
            category: t.category || 'unknown',
            merchant: t.merchant_name || '',
            narration: t.raw_narration || '',
            account: t.account_last4 ? `A/c ${t.account_last4}` : '',
            upiRef: t.upi_ref || null,
            upiApp: t.upi_app || null,
            upiReceiverVpa: t.upi_receiver_vpa || null,
            merchantOrderId: t.merchant_order_id || null,
            context: t.context || {},
            reconciled: t.reconciled || false,
            reconciliationStatus: t.reconciliation_status || 'pending',
            signalCount: t.signal_count || 0,
            enrichmentScore: t.enrichment_score || 0,
            signals: signalsByTxnId[t._id.toString()] || [],
            balanceAfter: t.balance_after,
            valueDate: t.value_date,
            subCategory: t.sub_category,
        });
    }

    // ── Group investments by month ─────────────────────────────
    const investByMonth: Record<string, any[]> = {};
    for (const t of investTxns) {
        const key = t.tx_date ? t.tx_date.slice(0, 7) : 'unknown';
        if (key === 'unknown') continue;
        if (!investByMonth[key]) investByMonth[key] = [];
        const acct = acctMap[t.investment_account_id] || {};
        investByMonth[key].push({
            _id: t._id.toString(),
            date: t.tx_date,
            txType: t.tx_type,
            amount: t.amount,
            netAmount: t.net_amount,
            units: t.units,
            nav: t.nav,
            isin: t.isin,
            securityName: t.security_name || '',
            exchange: t.exchange || '',
            platform: acct.platform || '',
            accountId: acct.account_id || '',
            accountLabel: acct.platform ? `${acct.platform} (${acct.account_id || acct.dp_id || ''})` : 'Unknown',
            brokerage: t.brokerage || 0,
            stt: t.stt || 0,
            stampDuty: t.stamp_duty || 0,
            gst: t.gst_on_brokerage || 0,
            exitLoad: t.exit_load || 0,
            transactionCharges: t.transaction_charges || 0,
            contractNumber: t.contract_number || null,
            orderNumber: t.order_id || null,
            broker: t.broker || '',
            channel: t.channel || '',
            settlementDate: t.settlement_date || null,
            reconciliationStatus: t.reconciliation_status || 'email_only',
            signalCount: t.signal_count || 0,
            tdsDeducted: t.tds_deducted || null,
            dividendPerUnit: t.dividend_per_unit || null,
            financialYear: t.financial_year || null,
            unitBalanceAfter: t.unit_balance_after || null,
        });
    }

    // ── Collect all months ─────────────────────────────────────
    const allMonths = new Set([...Object.keys(spendingByMonth), ...Object.keys(investByMonth)]);
    const sortedMonths = [...allMonths].sort();

    // ── Build month data ───────────────────────────────────────
    const months = sortedMonths.map(key => {
        const spending = spendingByMonth[key] || [];
        const investing = investByMonth[key] || [];

        // Spending stats
        const debits = spending.filter((t: any) => t.type === 'debit');
        const credits = spending.filter((t: any) => t.type === 'credit');
        const totalDebit = debits.reduce((s: number, t: any) => s + t.amount, 0);
        const totalCredit = credits.reduce((s: number, t: any) => s + t.amount, 0);

        // Category breakdown
        const catMap: Record<string, { amount: number; count: number }> = {};
        for (const t of debits) {
            const cat = t.category || 'unknown';
            if (!catMap[cat]) catMap[cat] = { amount: 0, count: 0 };
            catMap[cat].amount += t.amount;
            catMap[cat].count++;
        }
        const categoryBreakdown = Object.entries(catMap)
            .map(([slug, v]) => ({
                slug,
                label: slug.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
                color: CATEGORY_COLORS[slug] || '#95A5A6',
                amount: v.amount,
                count: v.count,
                pct: totalDebit > 0 ? Math.round((v.amount / totalDebit) * 10000) / 100 : 0,
            }))
            .sort((a, b) => b.amount - a.amount);

        // Investment type breakdown
        const txTypeMap: Record<string, { amount: number; count: number }> = {};
        for (const t of investing) {
            const typ = t.txType || 'unknown';
            if (!txTypeMap[typ]) txTypeMap[typ] = { amount: 0, count: 0 };
            txTypeMap[typ].amount += Math.abs(t.amount);
            txTypeMap[typ].count++;
        }
        const investmentTypeBreakdown = Object.entries(txTypeMap)
            .map(([slug, v]) => ({
                slug,
                label: slug.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
                color: TX_TYPE_COLORS[slug] || '#95A5A6',
                amount: v.amount,
                count: v.count,
            }))
            .sort((a, b) => b.amount - a.amount);

        // Account breakdown for investments
        const acctBreakdown: Record<string, { label: string; buy: number; sell: number; count: number }> = {};
        for (const t of investing) {
            const key = t.accountLabel;
            if (!acctBreakdown[key]) acctBreakdown[key] = { label: key, buy: 0, sell: 0, count: 0 };
            if (['buy', 'sip'].includes(t.txType)) acctBreakdown[key].buy += Math.abs(t.amount);
            else acctBreakdown[key].sell += Math.abs(t.amount);
            acctBreakdown[key].count++;
        }

        return {
            key,
            label: formatMonth(key),
            spending: {
                totalDebit,
                totalCredit,
                debitCount: debits.length,
                creditCount: credits.length,
                categoryBreakdown,
                transactions: spending,
            },
            investment: {
                totalBuy: investing.filter((t: any) => ['buy', 'sip'].includes(t.txType)).reduce((s: number, t: any) => s + Math.abs(t.amount), 0),
                totalSell: investing.filter((t: any) => ['sell', 'redemption'].includes(t.txType)).reduce((s: number, t: any) => s + Math.abs(t.amount), 0),
                totalOther: investing.filter((t: any) => !['buy', 'sip', 'sell', 'redemption'].includes(t.txType)).reduce((s: number, t: any) => s + Math.abs(t.amount), 0),
                txnCount: investing.length,
                typeBreakdown: investmentTypeBreakdown,
                accountBreakdown: Object.values(acctBreakdown),
                transactions: investing,
            },
        };
    });

    // ── Summary stats ──────────────────────────────────────────
    const summary = {
        totalSpendingTxns: spendingTxns.length,
        totalInvestmentTxns: investTxns.length,
        totalInvestmentAccounts: investAccounts.length,
        totalHoldings: investHoldings.length,
        spendingDebitTotal: spendingTxns.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0),
        spendingCreditTotal: spendingTxns.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0),
        investBuyTotal: investTxns.filter(t => ['buy', 'sip'].includes(t.tx_type)).reduce((s, t) => s + Math.abs(t.amount), 0),
        investSellTotal: investTxns.filter(t => ['sell', 'redemption'].includes(t.tx_type)).reduce((s, t) => s + Math.abs(t.amount), 0),
        investAccounts: investAccounts.map(a => ({
            id: a._id.toString(),
            platform: a.platform,
            accountId: a.account_id,
            dpId: a.dp_id,
            holderName: a.holder_name,
            platformType: a.platform_type,
        })),
        holdings: investHoldings.map(h => ({
            id: h._id.toString(),
            name: h.name,
            vehicle: h.vehicle,
            assetClass: h.asset_class,
            isin: h.isin,
            units: h.units,
            currentValue: h.current_value,
            snapshotDate: h.snapshot_date,
        })),
    };

    const output = {
        generatedAt: new Date().toISOString(),
        userId: USER_ID,
        summary,
        months,
    };

    const jsonPath = path.join(__dirname, '..', '..', '..', 'txn-dashboard-data.json');
    const jsonStr = JSON.stringify(output, null, 2);
    fs.writeFileSync(jsonPath, jsonStr);

    // Embed into HTML dashboard
    const htmlPath = path.join(__dirname, '..', '..', '..', 'txn-dashboard.html');
    if (fs.existsSync(htmlPath)) {
        let html = fs.readFileSync(htmlPath, 'utf-8');
        // Remove existing embedded data if any
        html = html.replace(/<!--DATA_START-->[\s\S]*?<!--DATA_END-->/g, '');
        // Insert data script before the closing </head> tag
        const dataScript = `<!--DATA_START--><script>window.__DASHBOARD_DATA__ = ${jsonStr};</script><!--DATA_END-->`;
        html = html.replace('</head>', `${dataScript}\n</head>`);
        fs.writeFileSync(htmlPath, html);
        console.log(`Embedded data into ${htmlPath}`);
    }

    console.log(`Dashboard data written to ${jsonPath}`);
    console.log(`  Spending: ${spendingTxns.length} txns across ${Object.keys(spendingByMonth).length} months`);
    console.log(`  Investments: ${investTxns.length} txns across ${Object.keys(investByMonth).length} months`);
    console.log(`  Investment accounts: ${investAccounts.length}, Holdings: ${investHoldings.length}`);

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
