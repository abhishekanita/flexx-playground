// =============================================================================
// Code Module Registry — maps codeModule slugs to parser functions
// =============================================================================
// For parsers with strategy: "code", this registry resolves the codeModule
// string from MongoDB to the actual TypeScript function.

import { parseKotakStatement } from '../providers/kotak-statement.parser';
import { parseSbiStatement } from '../providers/sbi-statement.parser';
import { parseSwiggyFoodEmail } from '../providers/swiggy-food.parser';
import { parseSwiggyInstamartEmail } from '../providers/swiggy-instamart.parser';
import { parseUberTripEmail } from '../providers/uber-trip.parser';
import { parseAppleInvoiceEmail } from '../providers/apple-invoice.parser';
import { parseMakeMyTripEmail } from '../providers/makemytrip-flight.parser';
import { parsePaytmStatement } from '../providers/paytm-statement.parser';
import { parsePhonePeStatement } from '../providers/phonepe-statement.parser';

export type CodeModuleFn = (content: string | Buffer) => unknown;

const CODE_MODULES: Record<string, CodeModuleFn> = {
    'kotak-statement': text => parseKotakStatement(text as string),
    'sbi-statement': text => parseSbiStatement(text as string),
    'swiggy-food': html => parseSwiggyFoodEmail(html as string),
    'swiggy-instamart': html => parseSwiggyInstamartEmail(html as string),
    'uber-trip': html => parseUberTripEmail(html as string),
    'apple-invoice': html => parseAppleInvoiceEmail(html as string),
    'makemytrip-flight': html => parseMakeMyTripEmail(html as string),
    'paytm-statement': buffer => parsePaytmStatement(buffer as Buffer),
    'phonepe-statement': text => parsePhonePeStatement(text as string),
};

export function getCodeModule(moduleId: string): CodeModuleFn | null {
    return CODE_MODULES[moduleId] || null;
}

export function getRegisteredModules(): string[] {
    return Object.keys(CODE_MODULES);
}
