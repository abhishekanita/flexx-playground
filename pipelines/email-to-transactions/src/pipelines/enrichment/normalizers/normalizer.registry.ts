import { NormalizerFn, InvestmentNormalizerFn } from './normalizer.types';
import { normalizeKotakStatement, normalizeSbiStatement } from './bank-statement.normalizer';
import { normalizePhonePeStatement, normalizePaytmStatement } from './upi-statement.normalizer';
import {
    normalizeSwiggyFood,
    normalizeSwiggyInstamart,
    normalizeUberTrip,
    normalizeAppleInvoice,
    normalizeMakeMyTripFlight,
    normalizeZomatoOrder,
    normalizeHdfcUpiAlert,
    normalizeRapidoRide,
    normalizeLiciousOrder,
    normalizeGooglePlayReceipt,
    normalizeIndigoTaxInvoice,
    normalizeHdfcSmartEmi,
    normalizeApartmentMaintenance,
} from './invoice.normalizer';
import {
    normalizeNsdlCas,
    normalizeIciciSecEquity,
    normalizeZerodhaDemat,
    normalizeZerodhaEquity,
    normalizeBseFundsBalance,
    normalizeNseFundsBalance,
    normalizeNseTradeConfirmation,
    normalizeIndmoneyStatement,
    normalizeIciciDemat,
    normalizeKfintechValuation,
    normalizeKfintechRedemption,
    normalizeZerodhaCoinRedemption,
    normalizeZerodhaCoinSellOrder,
    normalizeZerodhaDematAmc,
    normalizeDividend,
} from './investment.normalizer';

// Maps parser config slug → normalizer function (spending domain)
const NORMALIZER_REGISTRY: Record<string, NormalizerFn> = {
    // Bank statements — many signals per email
    kotak_savings_statement: (raw, meta) => normalizeKotakStatement(raw, meta),
    sbi_savings_statement: (raw, meta) => normalizeSbiStatement(raw, meta),

    // UPI statements — many signals per email
    phonepe_statement: (raw, meta) => normalizePhonePeStatement(raw, meta),
    paytm_statement: (raw, meta) => normalizePaytmStatement(raw, meta),

    // Invoices — one signal per email
    swiggy_food_delivery: (raw, meta) => normalizeSwiggyFood(raw, meta),
    swiggy_instamart: (raw, meta) => normalizeSwiggyInstamart(raw, meta),
    uber_trip: (raw, meta) => normalizeUberTrip(raw, meta),
    apple_invoice: (raw, meta) => normalizeAppleInvoice(raw, meta),
    makemytrip_flight: (raw, meta) => normalizeMakeMyTripFlight(raw, meta),

    // New normalizers
    zomato_order: (raw, meta) => normalizeZomatoOrder(raw, meta),
    hdfc_upi_alert: (raw, meta) => normalizeHdfcUpiAlert(raw, meta),
    rapido_ride: (raw, meta) => normalizeRapidoRide(raw, meta),
    licious_order: (raw, meta) => normalizeLiciousOrder(raw, meta),
    google_play_receipt: (raw, meta) => normalizeGooglePlayReceipt(raw, meta),
    indigo_tax_invoice: (raw, meta) => normalizeIndigoTaxInvoice(raw, meta),
    hdfc_smart_emi: (raw, meta) => normalizeHdfcSmartEmi(raw, meta),
    apartment_maintenance: (raw, meta) => normalizeApartmentMaintenance(raw, meta),
};

// Maps parser config slug → investment normalizer function
const INVESTMENT_NORMALIZER_REGISTRY: Record<string, InvestmentNormalizerFn> = {
    // Authoritative sources — full holdings replacement
    nsdl_cas: (raw, meta) => normalizeNsdlCas(raw, meta),
    zerodha_demat_holdings: (raw, meta) => normalizeZerodhaDemat(raw, meta),

    // Equity trade statements — cost basis source of truth
    icicisec_equity_statement: (raw, meta) => normalizeIciciSecEquity(raw, meta),

    // Equity settlement ledgers
    zerodha_weekly_equity: (raw, meta) => normalizeZerodhaEquity(raw, meta),
    zerodha_quarterly_equity: (raw, meta) => normalizeZerodhaEquity(raw, meta),
    zerodha_retention: (raw, meta) => normalizeZerodhaEquity(raw, meta),

    // Balance/holdings snapshots
    bse_funds_balance: (raw, meta) => normalizeBseFundsBalance(raw, meta),
    nse_funds_balance: (raw, meta) => normalizeNseFundsBalance(raw, meta),
    icici_demat_statement: (raw, meta) => normalizeIciciDemat(raw, meta),

    // Trade confirmations
    nse_trade_confirmation: (raw, meta) => normalizeNseTradeConfirmation(raw, meta),

    // Broker statements
    indmoney_weekly_statement: (raw, meta) => normalizeIndmoneyStatement(raw, meta),

    // MF-specific (declarative parsers)
    kfintech_mf_valuation: (raw, meta) => normalizeKfintechValuation(raw, meta),
    kfintech_mf_redemption: (raw, meta) => normalizeKfintechRedemption(raw, meta),
    zerodha_coin_redemption: (raw, meta) => normalizeZerodhaCoinRedemption(raw, meta),
    zerodha_coin_sell_order: (raw, meta) => normalizeZerodhaCoinSellOrder(raw, meta),
    zerodha_demat_amc: (raw, meta) => normalizeZerodhaDematAmc(raw, meta),

    // Dividends
    dividend_apollo: (raw, meta) => normalizeDividend(raw, meta),
    dividend_polycab: (raw, meta) => normalizeDividend(raw, meta),
    dividend_trent: (raw, meta) => normalizeDividend(raw, meta),
};

export function getNormalizer(parserSlug: string): NormalizerFn | null {
    return NORMALIZER_REGISTRY[parserSlug] || null;
}

export function getInvestmentNormalizer(parserSlug: string): InvestmentNormalizerFn | null {
    return INVESTMENT_NORMALIZER_REGISTRY[parserSlug] || null;
}

export function getRegisteredNormalizers(): string[] {
    return Object.keys(NORMALIZER_REGISTRY);
}

export function getRegisteredInvestmentNormalizers(): string[] {
    return Object.keys(INVESTMENT_NORMALIZER_REGISTRY);
}

export function isInvestmentParser(parserSlug: string): boolean {
    return parserSlug in INVESTMENT_NORMALIZER_REGISTRY;
}
