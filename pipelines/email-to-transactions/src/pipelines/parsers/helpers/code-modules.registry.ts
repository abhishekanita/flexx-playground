// =============================================================================
// Code Module Registry — maps codeModule slugs to parser functions
// =============================================================================
// For parsers with strategy: "code", this registry resolves the codeModule
// string from MongoDB to the actual TypeScript function.

import { parseKotakStatement } from '../providers/banks/kotak-statement.parser';
import { parseSbiStatement } from '../providers/banks/sbi-statement.parser';
import { parseHdfcCcStatement } from '../providers/banks/hdfc-cc-statement.parser';
import { parseSbiCardCcStatement } from '../providers/banks/sbicard-cc-statement.parser';
import { parseSwiggyFoodEmail } from '../providers/invoices/swiggy-food.parser';
import { parseSwiggyInstamartEmail } from '../providers/invoices/swiggy-instamart.parser';
import { parseUberTripEmail } from '../providers/invoices/uber-trip.parser';
import { parseAppleInvoiceEmail } from '../providers/invoices/apple-invoice.parser';
import { parseMakeMyTripEmail } from '../providers/invoices/makemytrip-flight.parser';
import { parsePaytmStatement } from '../providers/upi/paytm-statement.parser';
import { parsePhonePeStatement } from '../providers/upi/phonepe-statement.parser';
import { parseLiciousOrderEmail } from '../providers/invoices/licious-order.parser';
import { parseNsdlCas } from '../providers/investments/nsdl-cas.parser';
import { parseIciciSecEquity } from '../providers/investments/icici-sec-equity.parser';
import { parseZerodhaDematStatement } from '../providers/investments/zerodha-demat.parser';
import { parseZerodhaEquityStatement } from '../providers/investments/zerodha-equity.parser';
import { parseBseFundsBalance } from '../providers/investments/bse-funds-balance.parser';
import { parseIndmoneyStatement } from '../providers/investments/indmoney-statement.parser';
import { parseNseFundsBalance } from '../providers/investments/nse-funds-balance.parser';
import { parseNseTradeConfirmation } from '../providers/investments/nse-trade-confirmation.parser';
import { parseIciciDematStatement } from '../providers/investments/icici-demat.parser';
import { parseIndigoTaxInvoice } from '../providers/invoices/indigo-tax-invoice.parser';
import { parseHdfcSmartEmi } from '../providers/banks/hdfc-smart-emi.parser';
import { parseSbiInterestCert } from '../providers/banks/sbi-interest-cert.parser';

export type CodeModuleFn = (content: string | Buffer) => unknown;

const CODE_MODULES: Record<string, CodeModuleFn> = {
    'kotak-statement': text => parseKotakStatement(text as string),
    'sbi-statement': text => parseSbiStatement(text as string),
    'hdfc-cc-statement': text => parseHdfcCcStatement(text as string),
    'sbicard-cc-statement': text => parseSbiCardCcStatement(text as string),
    'swiggy-food': html => parseSwiggyFoodEmail(html as string),
    'swiggy-instamart': html => parseSwiggyInstamartEmail(html as string),
    'uber-trip': html => parseUberTripEmail(html as string),
    'apple-invoice': html => parseAppleInvoiceEmail(html as string),
    'makemytrip-flight': html => parseMakeMyTripEmail(html as string),
    'paytm-statement': buffer => parsePaytmStatement(buffer as Buffer),
    'phonepe-statement': text => parsePhonePeStatement(text as string),
    'licious-order': html => parseLiciousOrderEmail(html as string),
    'nsdl-cas': text => parseNsdlCas(text as string),
    'icici-sec-equity': text => parseIciciSecEquity(text as string),
    'zerodha-demat': text => parseZerodhaDematStatement(text as string),
    'zerodha-equity': text => parseZerodhaEquityStatement(text as string),
    'bse-funds-balance': text => parseBseFundsBalance(text as string),
    'indmoney-statement': text => parseIndmoneyStatement(text as string),
    'nse-funds-balance': text => parseNseFundsBalance(text as string),
    'nse-trade-confirmation': text => parseNseTradeConfirmation(text as string),
    'icici-demat': text => parseIciciDematStatement(text as string),
    'indigo-tax-invoice': text => parseIndigoTaxInvoice(text as string),
    'hdfc-smart-emi': text => parseHdfcSmartEmi(text as string),
    'sbi-interest-cert': text => parseSbiInterestCert(text as string),
};

export function getCodeModule(moduleId: string): CodeModuleFn | null {
    return CODE_MODULES[moduleId] || null;
}

export function getRegisteredModules(): string[] {
    return Object.keys(CODE_MODULES);
}
