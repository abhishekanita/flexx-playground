import { SignalSourceType, TransactionCategory, TransactionChannel, TransactionType } from '@/types/financial-data/transactions.enums';
import { TransactionContext } from '@/types/financial-data/context.type';
import { NormalizedSignal } from './normalizer.types';

// Parse a date string, using the email's receivedAt as fallback and for year inference
function parseDate(dateStr: string | undefined, receivedAt: string): Date {
    if (!dateStr || dateStr.trim() === '') return new Date(receivedAt);

    let parsed = new Date(dateStr);

    // If parsing failed entirely
    if (isNaN(parsed.getTime())) return new Date(receivedAt);

    // If year defaulted to 2001 (date string had no year, e.g. "Feb 25, 8:54 PM")
    if (parsed.getFullYear() < 2020) {
        const emailYear = new Date(receivedAt).getFullYear();
        parsed.setFullYear(emailYear);

        // If the resulting date is in the future relative to receivedAt, use previous year
        if (parsed.getTime() > new Date(receivedAt).getTime() + 7 * 24 * 60 * 60 * 1000) {
            parsed.setFullYear(emailYear - 1);
        }
    }

    return parsed;
}

// Swiggy Food
export function normalizeSwiggyFood(raw: Record<string, any>, emailMeta: { rawEmailId: string; receivedAt: string }): NormalizedSignal[] {
    const amount = raw.orderTotal;
    if (!amount) return [];

    const context: TransactionContext = {
        swiggy: {
            order_id: raw.orderId,
            restaurant_name: raw.restaurant,
            restaurant_area: raw.restaurantAddress,
            items: (raw.items || []).map((i: any) => ({
                name: i.name,
                qty: i.quantity,
                price: i.price,
            })),
            delivery_fee: raw.deliveryFee || 0,
            platform_fee: raw.platformFee || 0,
            tax: raw.taxes || 0,
            discount: raw.discount || 0,
            delivery_address_label: raw.deliveryAddress,
            cuisine: [],
        },
    };

    return [{
        amount,
        txDate: parseDate(raw.orderedAt, emailMeta.receivedAt),
        merchantOrderId: raw.orderId,
        type: TransactionType.Debit,
        channel: TransactionChannel.Unknown,
        merchantName: 'Swiggy',
        category: TransactionCategory.FoodDelivery,
        subCategory: raw.isGourmet ? 'gourmet' : 'food_delivery',
        context,
        sourceType: SignalSourceType.MerchantInvoice,
        confidence: 1,
        rawParsed: raw,
        enrichmentScoreDelta: 42,
    }];
}

// Swiggy Instamart
export function normalizeSwiggyInstamart(raw: Record<string, any>, emailMeta: { rawEmailId: string; receivedAt: string }): NormalizedSignal[] {
    const amount = raw.grandTotal;
    if (!amount) return [];

    const context: TransactionContext = {
        zepto: {
            order_id: raw.orderId,
            items: (raw.items || []).map((i: any) => ({
                name: i.name,
                qty: i.quantity,
                price: i.price,
            })),
            tax: 0,
            discount: 0,
            delivery_address_label: raw.deliveryAddress,
        },
    };

    return [{
        amount,
        txDate: parseDate(raw.deliveredAt || raw.orderedAt, emailMeta.receivedAt),
        merchantOrderId: raw.orderId,
        type: TransactionType.Debit,
        channel: TransactionChannel.Unknown,
        merchantName: 'Swiggy Instamart',
        category: TransactionCategory.Groceries,
        context,
        sourceType: SignalSourceType.MerchantInvoice,
        confidence: 1,
        rawParsed: raw,
        enrichmentScoreDelta: 40,
    }];
}

// Uber Trip
export function normalizeUberTrip(raw: Record<string, any>, emailMeta: { rawEmailId: string; receivedAt: string }): NormalizedSignal[] {
    const amount = raw.total;
    if (!amount) return [];

    const context: TransactionContext = {
        uber: {
            trip_id: '',
            pickup_location: raw.pickup,
            drop_location: raw.dropoff,
            distance_km: raw.distanceKm,
            ride_type: raw.rideType,
            driver_rating: raw.driverRating,
            toll_charges: (raw.fareBreakdown || []).find((f: any) => /toll/i.test(f.label))?.amount,
        },
    };

    return [{
        amount,
        txDate: parseDate(raw.date, emailMeta.receivedAt),
        type: TransactionType.Debit,
        channel: TransactionChannel.Unknown,
        merchantName: 'Uber',
        category: TransactionCategory.CabRide,
        subCategory: raw.rideType,
        context,
        sourceType: SignalSourceType.MerchantInvoice,
        confidence: 1,
        rawParsed: raw,
        enrichmentScoreDelta: 44,
    }];
}

// Apple Invoice
export function normalizeAppleInvoice(raw: Record<string, any>, emailMeta: { rawEmailId: string; receivedAt: string }): NormalizedSignal[] {
    const amount = raw.total;
    if (!amount) return [];

    const context: TransactionContext = {
        subscription: {
            service_name: 'Apple',
            plan_name: (raw.items || []).map((i: any) => i.name).join(', '),
            billing_cycle: 'monthly',
        },
    };

    return [{
        amount,
        txDate: parseDate(raw.invoiceDate, emailMeta.receivedAt),
        merchantOrderId: raw.orderId,
        type: TransactionType.Debit,
        channel: TransactionChannel.Unknown,
        merchantName: 'Apple',
        category: TransactionCategory.Subscription,
        context,
        sourceType: SignalSourceType.MerchantInvoice,
        confidence: 1,
        rawParsed: raw,
        enrichmentScoreDelta: 35,
    }];
}

// Zomato Order
export function normalizeZomatoOrder(raw: Record<string, any>, emailMeta: { rawEmailId: string; receivedAt: string }): NormalizedSignal[] {
    const amount = raw.totalPaid;
    if (!amount) return [];

    const context: TransactionContext = {
        zomato: {
            order_id: raw.orderId,
            restaurant_name: raw.restaurant,
            items: (raw.items || []).map((i: any) => ({
                name: i.name,
                qty: i.quantity || 1,
                price: i.price || 0,
            })),
            delivery_fee: raw.deliveryCharge || 0,
            packaging_fee: raw.packagingCharge || 0,
            tax: raw.taxes || 0,
            pro_discount: raw.discount || 0,
        },
    };

    return [{
        amount,
        txDate: parseDate(raw.orderDate, emailMeta.receivedAt),
        merchantOrderId: raw.orderId,
        type: TransactionType.Debit,
        channel: TransactionChannel.Unknown,
        merchantName: 'Zomato',
        category: TransactionCategory.FoodDelivery,
        context,
        sourceType: SignalSourceType.MerchantInvoice,
        confidence: 1,
        rawParsed: raw,
        enrichmentScoreDelta: 42,
    }];
}

// HDFC UPI Alert
export function normalizeHdfcUpiAlert(raw: Record<string, any>, emailMeta: { rawEmailId: string; receivedAt: string }): NormalizedSignal[] {
    const amount = raw.amount;
    if (!amount) return [];

    // Parse DD-MM-YYYY date format
    let txDate: Date;
    if (raw.date && /^\d{2}-\d{2}-\d{4}$/.test(raw.date)) {
        const [dd, mm, yyyy] = raw.date.split('-');
        txDate = new Date(`${yyyy}-${mm}-${dd}`);
    } else {
        txDate = parseDate(raw.date, emailMeta.receivedAt);
    }

    const type = (raw.type || '').toLowerCase().includes('credit') ? TransactionType.Credit : TransactionType.Debit;

    return [{
        amount,
        txDate,
        accountLast4: raw.account,
        upiRef: raw.upiRef || undefined,
        type,
        channel: raw.upiRef ? TransactionChannel.UPI : TransactionChannel.Unknown,
        rawNarration: raw.merchant || raw.payeeName || '',
        merchantName: raw.merchant || raw.payeeName || '',
        category: TransactionCategory.Unknown,
        balanceAfter: raw.availableBalance,
        sourceType: SignalSourceType.BankAlert,
        confidence: 0.9,
        rawParsed: raw,
        enrichmentScoreDelta: 15,
    }];
}

// Rapido Ride
export function normalizeRapidoRide(raw: Record<string, any>, emailMeta: { rawEmailId: string; receivedAt: string }): NormalizedSignal[] {
    const amount = raw.totalAmount;
    if (!amount) return [];

    const context: TransactionContext = {
        ola: {
            trip_id: raw.rideId || '',
            pickup_location: raw.pickup || '',
            drop_location: raw.dropoff || '',
            distance_km: raw.distance ? parseFloat(raw.distance) : undefined,
            ride_type: 'Rapido',
        },
    };

    return [{
        amount,
        txDate: parseDate(raw.rideTime, emailMeta.receivedAt),
        type: TransactionType.Debit,
        channel: TransactionChannel.Unknown,
        merchantName: 'Rapido',
        category: TransactionCategory.CabRide,
        context,
        sourceType: SignalSourceType.MerchantInvoice,
        confidence: 1,
        rawParsed: raw,
        enrichmentScoreDelta: 40,
    }];
}

// Licious Order
export function normalizeLiciousOrder(raw: Record<string, any>, emailMeta: { rawEmailId: string; receivedAt: string }): NormalizedSignal[] {
    const amount = raw.orderTotal;
    if (!amount) return [];

    const context: TransactionContext = {
        zepto: {
            order_id: raw.orderId || '',
            items: (raw.items || []).map((i: any) => ({
                name: i.name,
                qty: i.quantity || 1,
                price: i.price || 0,
            })),
            tax: 0,
            discount: raw.discount || 0,
        },
    };

    return [{
        amount,
        txDate: parseDate(raw.orderDate, emailMeta.receivedAt),
        merchantOrderId: raw.orderId,
        type: TransactionType.Debit,
        channel: TransactionChannel.Unknown,
        merchantName: 'Licious',
        category: TransactionCategory.Groceries,
        subCategory: 'meat_seafood',
        context,
        sourceType: SignalSourceType.MerchantInvoice,
        confidence: 1,
        rawParsed: raw,
        enrichmentScoreDelta: 38,
    }];
}

// Google Play Receipt
export function normalizeGooglePlayReceipt(raw: Record<string, any>, emailMeta: { rawEmailId: string; receivedAt: string }): NormalizedSignal[] {
    // Parse amount from string like "₹130.00/month"
    let amount = 0;
    if (typeof raw.total === 'number') {
        amount = raw.total;
    } else if (typeof raw.total === 'string') {
        const match = raw.total.replace(/,/g, '').match(/[\d.]+/);
        if (match) amount = parseFloat(match[0]);
    }
    if (!amount) return [];

    const context: TransactionContext = {
        subscription: {
            service_name: 'Google Play',
            plan_name: raw.itemName || '',
            billing_cycle: raw.total?.includes('/year') ? 'annual' : 'monthly',
        },
    };

    return [{
        amount,
        txDate: parseDate(raw.orderDate, emailMeta.receivedAt),
        merchantOrderId: raw.orderNumber,
        type: TransactionType.Debit,
        channel: TransactionChannel.CreditCard,
        merchantName: 'Google Play',
        category: TransactionCategory.Subscription,
        context,
        sourceType: SignalSourceType.MerchantInvoice,
        confidence: 1,
        rawParsed: raw,
        enrichmentScoreDelta: 35,
    }];
}

// IndiGo Tax Invoice
export function normalizeIndigoTaxInvoice(raw: Record<string, any>, emailMeta: { rawEmailId: string; receivedAt: string }): NormalizedSignal[] {
    const amount = raw.total;
    if (!amount) return [];

    return [{
        amount,
        txDate: parseDate(raw.invoiceDate || raw.travelDate, emailMeta.receivedAt),
        merchantOrderId: raw.bookingRef,
        type: TransactionType.Debit,
        channel: TransactionChannel.Unknown,
        merchantName: 'IndiGo',
        category: TransactionCategory.Flight,
        context: {
            flight: {
                booking_id: raw.bookingRef,
                route: raw.route || '',
                travelers: raw.passengerName ? [raw.passengerName] : [],
                segments: [],
            },
        },
        sourceType: SignalSourceType.MerchantInvoice,
        confidence: raw.baseFare > 0 ? 1 : 0.7,
        rawParsed: raw,
        enrichmentScoreDelta: 30,
    }];
}

// HDFC Smart EMI
export function normalizeHdfcSmartEmi(raw: Record<string, any>, emailMeta: { rawEmailId: string; receivedAt: string }): NormalizedSignal[] {
    const amount = raw.emiAmount;
    if (!amount) return [];

    const context: TransactionContext = {
        emi: {
            loan_account: raw.loanId || '',
            lender: 'HDFC Bank',
            loan_type: 'credit_card',
            emi_amount: amount,
            total_emis: raw.tenure,
        },
    };

    return [{
        amount,
        txDate: parseDate(undefined, emailMeta.receivedAt),
        accountLast4: raw.cardLast4,
        type: TransactionType.Debit,
        channel: TransactionChannel.CreditCard,
        merchantName: 'HDFC SmartEMI',
        category: TransactionCategory.EMI,
        context,
        sourceType: SignalSourceType.BankAlert,
        confidence: 0.8,
        rawParsed: raw,
        enrichmentScoreDelta: 20,
    }];
}

// Apartment Maintenance
export function normalizeApartmentMaintenance(raw: Record<string, any>, emailMeta: { rawEmailId: string; receivedAt: string }): NormalizedSignal[] {
    const amount = raw.amount;
    if (!amount) return [];

    return [{
        amount,
        txDate: parseDate(raw.date, emailMeta.receivedAt),
        type: TransactionType.Debit,
        channel: TransactionChannel.Unknown,
        merchantName: 'Apartment Maintenance',
        category: TransactionCategory.Rent,
        subCategory: 'maintenance',
        sourceType: SignalSourceType.MerchantInvoice,
        confidence: 0.9,
        rawParsed: raw,
        enrichmentScoreDelta: 20,
    }];
}

// MakeMyTrip Flight
export function normalizeMakeMyTripFlight(raw: Record<string, any>, emailMeta: { rawEmailId: string; receivedAt: string }): NormalizedSignal[] {
    const amount = raw.totalAmount || raw.amountPaid;
    if (!amount) return [];

    // Build a human-readable summary for enrichment questions
    const segments = raw.segments || [];
    const firstSeg = segments[0];
    const routeSummary = raw.route || (firstSeg ? `${firstSeg.from} → ${firstSeg.to}` : '');

    return [{
        amount,
        txDate: parseDate(raw.travelDate || raw.bookedOn, emailMeta.receivedAt),
        merchantOrderId: raw.bookingId,
        type: TransactionType.Debit,
        channel: TransactionChannel.Unknown,
        merchantName: 'MakeMyTrip',
        category: TransactionCategory.Flight,
        subCategory: raw.tripType,
        context: {
            flight: {
                booking_id: raw.bookingId,
                route: routeSummary,
                trip_type: raw.tripType,
                travel_date: raw.travelDate,
                booked_on: raw.bookedOn,
                travelers: raw.travelers || [],
                segments: segments.map((s: any) => ({
                    airline: s.airline,
                    flight_number: s.flightNumber,
                    pnr: s.pnr,
                    from: s.from,
                    from_airport: s.fromAirport,
                    to: s.to,
                    to_airport: s.toAirport,
                    departure_time: s.departureTime,
                    arrival_time: s.arrivalTime,
                    duration: s.duration,
                    cabin_class: s.cabinClass,
                })),
                discount_code: raw.discountCode,
                discount_amount: raw.discountAmount,
                paid_via: raw.paidVia,
            },
        },
        sourceType: SignalSourceType.MerchantInvoice,
        confidence: 1,
        rawParsed: raw,
        enrichmentScoreDelta: 38,
    }];
}
