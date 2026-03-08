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
