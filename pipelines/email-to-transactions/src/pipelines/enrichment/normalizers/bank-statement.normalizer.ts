import { SignalSourceType, TransactionCategory, TransactionChannel, TransactionType } from '@/types/financial-data/transactions.enums';
import { NormalizedSignal } from './normalizer.types';

interface PaymentRefs {
    upiRef?: string;
    neftUtr?: string;
    impsRef?: string;
    channel: TransactionChannel;
    merchantName?: string;
    upiReceiverVpa?: string;
}

// Parses UPI ref, NEFT UTR, IMPS ref from bank narrations
// UPI narration format: UPI/(DR|CR)/{12-digit-ref}/{merchant}/{bank}/{vpa}/{note}
// Also handles: UPI-312345678901, UPILITE variants
function extractPaymentRefs(narration: string): PaymentRefs {
    const refs: PaymentRefs = {
        channel: TransactionChannel.Unknown,
    };

    // UPI full format: UPI/DR/514428728270/Blinkit/HDFC/blinkit.pa/UPIInt
    const upiFullMatch = narration.match(/UPI\/(DR|CR)\/(\d{12,})\/([^\/]*)(?:\/([^\/]*))?(?:\/([^\/]*))?(?:\/(.*))?/i);
    if (upiFullMatch) {
        refs.upiRef = upiFullMatch[2];
        refs.channel = TransactionChannel.UPI;
        const merchant = upiFullMatch[3]?.trim();
        if (merchant && merchant !== 'UPILITE') {
            refs.merchantName = merchant;
        }
        const vpa = upiFullMatch[5]?.trim();
        if (vpa && vpa.includes('.')) {
            refs.upiReceiverVpa = vpa;
        }
        return refs;
    }

    // Kotak UPI format: UPI/NAME/ref/note (no DR/CR prefix)
    const upiKotakMatch = narration.match(/^UPI\/([^\/]+)\/(\d{12,})\/(.*)$/i);
    if (upiKotakMatch) {
        refs.upiRef = upiKotakMatch[2];
        refs.channel = TransactionChannel.UPI;
        const name = upiKotakMatch[1]?.trim();
        if (name && !/^Bank Account/i.test(name)) {
            refs.merchantName = name;
        }
        return refs;
    }

    // UPI short format: UPI-312345678901 or UPI/312345678901
    const upiShortMatch = narration.match(/UPI[-\/](\d{12,})/i);
    if (upiShortMatch) {
        refs.upiRef = upiShortMatch[1];
        refs.channel = TransactionChannel.UPI;
        return refs;
    }

    // UPILITE (wallet load, no full ref)
    if (/UPILITE/i.test(narration)) {
        refs.channel = TransactionChannel.UPI;
        return refs;
    }

    // NEFT: "NEFT-...", "NEFT/...", "NEFT*BANKCODE*UTR*..."
    const neftMatch = narration.match(/NEFT[-\/\*](\w{16,})/i);
    if (neftMatch) {
        refs.neftUtr = neftMatch[1];
        refs.channel = TransactionChannel.NEFT;
        return refs;
    }
    // NEFT with * delimiter: NEFT*IDFB0010201*IDFBH25060699803*RZPX...
    if (/^NEFT\*/i.test(narration)) {
        const parts = narration.split('*');
        if (parts.length >= 3) {
            refs.neftUtr = parts[2]; // UTR is typically 3rd segment
            refs.channel = TransactionChannel.NEFT;
            return refs;
        }
    }

    // IMPS
    const impsMatch = narration.match(/IMPS[-\/](\w{12,})/i);
    if (impsMatch) {
        refs.impsRef = impsMatch[1];
        refs.channel = TransactionChannel.IMPS;
        return refs;
    }

    // NACH / auto-debit
    if (/NACH/i.test(narration)) {
        refs.channel = TransactionChannel.NACH;
        return refs;
    }

    // ATM
    if (/ATM/i.test(narration)) {
        refs.channel = TransactionChannel.ATM;
        return refs;
    }

    return refs;
}

// Detect if a narration represents an internal/self transfer or P2P
function isSelfTransfer(narration: string, merchantName?: string, receiverVpa?: string): boolean {
    // NEFT sent via internet banking (IB:Sent)
    if (/^IB:SENT\s+NEFT/i.test(narration)) return true;

    // FD maturity / internal bank operations
    if (/FD MATURITY|FIXED DEPOSIT|FD REDEMPTION/i.test(narration)) return true;

    // MICR/CLG — inter-bank cheque clearing
    if (/MICR INWARD|CLG TO/i.test(narration)) return true;

    // Sweep transfers (Kotak auto-sweep to FD)
    if (/SWEEP TRANSFER/i.test(narration)) return true;

    // Transfer to own Kotak account
    if (receiverVpa && /^abhishek|^7838237658/i.test(receiverVpa)) return true;

    // Kotak UPI format: "UPI/NAME/ref/Payment from Ph" — wallet loads from PhonePe
    if (/Payment from Ph/i.test(narration)) return true;

    // Kotak UPI format: "UPI/NAME/ref/Sent using" — P2P transfers
    if (/\/Sent using/i.test(narration)) return true;

    // SBI UPI format: merchant name is user's own name going to own bank
    if (merchantName && receiverVpa) {
        if (/^ABHISHEK$/i.test(merchantName) && /kkbk|kotak/i.test(receiverVpa)) return true;
    }

    return false;
}

// Detect P2P transfers (money sent to individuals, not merchants)
function isP2PTransfer(narration: string, merchantName?: string): boolean {
    // UPI narration with "Sent" or "Payment" to a person (short name, no business VPA)
    if (merchantName && merchantName.length <= 12 && /^[A-Z\s]+$/i.test(merchantName)) {
        // Short all-caps names are likely people, not merchants
        // But exclude known merchants that are short
        if (!/SWIGGY|UBER|BLINKIT|ZEPTO|GROWW|CRED|APPLE/i.test(merchantName)) {
            if (/\/Sent|\/Payme|\/NA$/i.test(narration)) return true;
        }
    }
    return false;
}

function inferCategory(narration: string, merchantName?: string, receiverVpa?: string): TransactionCategory {
    const n = narration.toUpperCase();

    // Self-transfers and P2P first (highest priority)
    if (isSelfTransfer(narration, merchantName, receiverVpa)) return TransactionCategory.Transfer;
    if (isP2PTransfer(narration, merchantName)) return TransactionCategory.Transfer;

    // Food delivery
    if (/SWIGGY|ZOMATO/i.test(n)) return TransactionCategory.FoodDelivery;

    // Groceries
    if (/BLINKIT|BIGBASKET|ZEPTO|DUNZO|GROFERS|DMART|INSTAMART/i.test(n)) return TransactionCategory.Groceries;

    // Cab / ride
    if (/\bUBER\b|RAPIDO|\bOLA\b/i.test(n)) return TransactionCategory.CabRide;

    // Ecommerce
    if (/AMAZON|FLIPKART|MYNTRA|AJIO|MEESHO|NYKAA/i.test(n)) return TransactionCategory.Ecommerce;

    // Food & beverages (cafes, restaurants)
    if (/TEA TIME|CHAAYOS|STARBUCKS|DAALCHINI|MCDONALD|KFC|DOMINO|BURGER KING/i.test(n)) return TransactionCategory.Restaurant;

    // Subscriptions / OTT
    if (/NETFLIX|HOTSTAR|PRIME VIDEO|DISNEY/i.test(n)) return TransactionCategory.OTT;
    if (/SPOTIFY|YOUTUBE|APPLE\.COM|GOOGLE PLAY/i.test(n)) return TransactionCategory.Subscription;

    // EMI / loans / auto-debit
    if (/NACH|LAZYPAY|SIMPL|LOAN|EMI/i.test(n)) return TransactionCategory.EMI;

    // Travel
    if (/IRCTC/i.test(n)) return TransactionCategory.Train;
    if (/MAKEMYTRIP|GOIBIBO|CLEARTRIP|YATRA/i.test(n)) return TransactionCategory.Flight;
    if (/AIRBNB/i.test(n)) return TransactionCategory.Hotel;

    // Transfers (wallet loads, P2P)
    if (/UPILITE/i.test(n)) return TransactionCategory.Transfer;

    // ATM
    if (/ATM/i.test(n)) return TransactionCategory.ATMWithdrawal;

    // Utilities
    if (/BESCOM|TATA POWER/i.test(n)) return TransactionCategory.Electricity;
    if (/AIRTEL|JIO|VODAFONE/i.test(n)) return TransactionCategory.MobileRecharge;
    if (/BROADBAND/i.test(n)) return TransactionCategory.Broadband;

    // Financial
    if (/INTEREST CREDIT|INT\.CREDIT/i.test(n)) return TransactionCategory.Investment;
    if (/SALARY|PAYROLL/i.test(n)) return TransactionCategory.Salary;
    if (/GROWW|ZERODHA|KUVERA|COIN|MUTUAL FUND|SIP/i.test(n)) return TransactionCategory.Investment;
    if (/RENT/i.test(n)) return TransactionCategory.Rent;
    if (/INSURANCE|LIC|HDFC LIFE|ICICI PRUD/i.test(n)) return TransactionCategory.Insurance;

    // Pharmacy
    if (/PHARMEASY|1MG|NETMEDS|APOLLO PHARMACY/i.test(n)) return TransactionCategory.Pharmacy;

    return TransactionCategory.Unknown;
}

// Kotak statement normalizer
export function normalizeKotakStatement(raw: Record<string, any>, _emailMeta?: any): NormalizedSignal[] {
    const signals: NormalizedSignal[] = [];
    const accountNumber = raw.accountNumber || '';
    const accountLast4 = accountNumber.slice(-4);

    for (const txn of raw.transactions || []) {
        const isDebit = txn.withdrawal != null && txn.withdrawal > 0;
        const amount = isDebit ? txn.withdrawal : txn.deposit;
        if (!amount || amount === 0) continue;

        const refs = extractPaymentRefs(txn.description || '');
        const category = inferCategory(txn.description || '', refs.merchantName, refs.upiReceiverVpa);

        signals.push({
            amount,
            txDate: new Date(txn.date),
            accountLast4,
            ...refs,
            type: isDebit ? TransactionType.Debit : TransactionType.Credit,
            rawNarration: txn.description,
            balanceAfter: txn.balance,
            merchantName: refs.merchantName,
            upiReceiverVpa: refs.upiReceiverVpa,
            category,
            sourceType: SignalSourceType.BankStatement,
            confidence: 1,
            rawParsed: txn,
            enrichmentScoreDelta: 30,
            isReconciliation: true,
        });
    }

    return signals;
}

// SBI statement normalizer — SBI has multiple accounts per statement
export function normalizeSbiStatement(raw: Record<string, any>, _emailMeta?: any): NormalizedSignal[] {
    const signals: NormalizedSignal[] = [];

    for (const account of raw.accounts || []) {
        const accountLast4 = (account.accountNumber || '').slice(-4);

        for (const txn of account.transactions || []) {
            const isDebit = txn.debit != null && txn.debit > 0;
            const amount = isDebit ? txn.debit : txn.credit;
            if (!amount || amount === 0) continue;

            const refs = extractPaymentRefs(txn.description || '');
            const category = inferCategory(txn.description || '', refs.merchantName, refs.upiReceiverVpa);

            signals.push({
                amount,
                txDate: new Date(txn.date),
                accountLast4,
                ...refs,
                type: isDebit ? TransactionType.Debit : TransactionType.Credit,
                rawNarration: txn.description,
                balanceAfter: txn.balance,
                merchantName: refs.merchantName,
                upiReceiverVpa: refs.upiReceiverVpa,
                category,
                sourceType: SignalSourceType.BankStatement,
                confidence: 1,
                rawParsed: txn,
                enrichmentScoreDelta: 30,
                isReconciliation: true,
            });
        }
    }

    return signals;
}
