import { NormalizerFn } from './normalizer.types';
import { normalizeKotakStatement, normalizeSbiStatement } from './bank-statement.normalizer';
import { normalizePhonePeStatement, normalizePaytmStatement } from './upi-statement.normalizer';
import {
    normalizeSwiggyFood,
    normalizeSwiggyInstamart,
    normalizeUberTrip,
    normalizeAppleInvoice,
    normalizeMakeMyTripFlight,
} from './invoice.normalizer';

// Maps parser config slug → normalizer function
// The normalizer converts raw parsed output into NormalizedSignal[]
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
};

export function getNormalizer(parserSlug: string): NormalizerFn | null {
    return NORMALIZER_REGISTRY[parserSlug] || null;
}

export function getRegisteredNormalizers(): string[] {
    return Object.keys(NORMALIZER_REGISTRY);
}
