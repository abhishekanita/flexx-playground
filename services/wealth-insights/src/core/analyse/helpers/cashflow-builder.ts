/**
 * Converts statement transactions into investor cashflows for XIRR calculation.
 *
 * Critical sign convention:
 *   Purchase/SIP       → negative (money going OUT from investor)
 *   Redemption/SWP     → positive (money coming IN to investor)
 *   Switch In / STP In → negative (treated as purchase)
 *   Switch Out/STP Out → positive (treated as redemption)
 *   Stamp Duty / STT   → negative (charge)
 *   Dividend Reinvest  → 0 (internal, no real cashflow)
 *   Merger / Bonus      → 0 (internal)
 */

import { MFDetailedStatementData } from '../../../types/statements/mf-statements.type';
import { Cashflow, parseDate } from './financial-math';

type Transaction = MFDetailedStatementData['folios'][number]['transactions'][number];

// Transaction types that represent money leaving the investor
const OUTFLOW_TYPES = new Set([
    'Purchase',
    'SIP',
    'Switch In',
    'STP In',
    'NFO Allotment',
]);

// Transaction types that represent money coming to the investor
const INFLOW_TYPES = new Set([
    'Redemption',
    'SIP Redemption',
    'SWP',
    'Switch Out',
    'STP Out',
    'Dividend Payout',
]);

// Transaction types that are internal (no real investor cashflow)
const ZERO_CASHFLOW_TYPES = new Set([
    'Dividend Reinvestment',
    'Bonus',
    'Merger',
]);

/**
 * Convert a single transaction to investor cashflow.
 * Returns [date, cashflowAmount] or null if the transaction has no cashflow.
 */
export function transactionToCashflow(tx: Transaction): Cashflow | null {
    const amount = tx.amount;
    if (amount === null || amount === 0) return null;

    const date = parseDate(tx.date);

    if (OUTFLOW_TYPES.has(tx.type)) {
        return [date, -Math.abs(amount)]; // money going out
    }

    if (INFLOW_TYPES.has(tx.type)) {
        return [date, Math.abs(amount)]; // money coming in
    }

    if (tx.type === 'Stamp Duty') {
        return [date, -Math.abs(amount)]; // charge
    }

    if (ZERO_CASHFLOW_TYPES.has(tx.type)) {
        return null; // internal transfer, no real cashflow
    }

    // Unknown type - default to outflow if units are positive (buy), inflow if negative (sell)
    return [date, tx.units > 0 ? -Math.abs(amount) : Math.abs(amount)];
}

/**
 * Build investor cashflows for the entire portfolio.
 * Used for portfolio-level XIRR.
 */
export function buildPortfolioCashflows(data: MFDetailedStatementData): Cashflow[] {
    const cashflows: Cashflow[] = [];

    for (const folio of data.folios) {
        for (const tx of folio.transactions) {
            const cf = transactionToCashflow(tx);
            if (cf) cashflows.push(cf);
        }
    }

    return cashflows;
}

/**
 * Build investor cashflows for the entire portfolio EXCLUDING charges (stamp duty).
 * Used for portfolioXIRRExCharges.
 */
export function buildPortfolioCashflowsExCharges(data: MFDetailedStatementData): Cashflow[] {
    const cashflows: Cashflow[] = [];

    for (const folio of data.folios) {
        for (const tx of folio.transactions) {
            if (tx.type === 'Stamp Duty') continue;
            const cf = transactionToCashflow(tx);
            if (cf) cashflows.push(cf);
        }
    }

    return cashflows;
}

/**
 * Build investor cashflows for a single folio (scheme).
 * Used for scheme-level XIRR.
 */
export function buildFolioCashflows(
    folio: MFDetailedStatementData['folios'][number],
): Cashflow[] {
    const cashflows: Cashflow[] = [];

    for (const tx of folio.transactions) {
        const cf = transactionToCashflow(tx);
        if (cf) cashflows.push(cf);
    }

    return cashflows;
}

/**
 * Get total invested amount for a folio (sum of all outflows, absolute value).
 */
export function getTotalInvested(folio: MFDetailedStatementData['folios'][number]): number {
    let total = 0;
    for (const tx of folio.transactions) {
        if (tx.amount === null) continue;
        if (OUTFLOW_TYPES.has(tx.type)) {
            total += Math.abs(tx.amount);
        }
    }
    return total;
}

/**
 * Get total withdrawn amount for a folio (sum of all inflows).
 */
export function getTotalWithdrawn(folio: MFDetailedStatementData['folios'][number]): number {
    let total = 0;
    for (const tx of folio.transactions) {
        if (tx.amount === null) continue;
        if (INFLOW_TYPES.has(tx.type)) {
            total += Math.abs(tx.amount);
        }
    }
    return total;
}

/**
 * Get net invested (invested - withdrawn) for a folio.
 */
export function getNetInvested(folio: MFDetailedStatementData['folios'][number]): number {
    return getTotalInvested(folio) - getTotalWithdrawn(folio);
}
