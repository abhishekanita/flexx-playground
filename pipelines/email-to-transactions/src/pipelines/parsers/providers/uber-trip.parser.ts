// =============================================================================
// Uber Trip Receipt — HTML Email Parser
// =============================================================================
// Parses trip receipt emails from noreply@uber.com
// Uses data-testid attributes for reliable extraction.

import * as cheerio from 'cheerio';

export interface UberFareItem {
    label: string;
    amount: number;
}

export interface UberTrip {
    date: string;           // "Mar 3, 2026"
    time: string;           // "1:16 pm"
    rideType: string;       // "Go Sedan", "UberXL", "Auto"
    driverName: string;
    driverRating: number;
    licensePlate: string;
    distanceKm: number;
    durationMinutes: number;
    pickup: string;
    pickupTime: string;
    dropoff: string;
    dropoffTime: string;
    total: number;
    fareBreakdown: UberFareItem[];
    paymentMethod: string;  // "Cash", "UPI"
}

function parseAmount(str: string): number {
    return parseFloat(str.replace(/[₹,\s]/g, '').replace(/^-/, '')) || 0;
}

export function parseUberTripEmail(html: string): UberTrip {
    const $ = cheerio.load(html);

    // Total fare
    const totalText = $('[data-testid="total_fare_amount"]').first().text().trim();
    const total = parseAmount(totalText);

    // Ride type
    const rideType = $('[data-testid="vehicle_type"]').first().text().trim();

    // Distance and duration: "15.25 kilometres, 21 minutes"
    const distDur = $('[data-testid="distance_duration"]').first().text().trim();
    const distMatch = distDur.match(/([\d.]+)\s*kilometres?,\s*(\d+)\s*minutes?/);
    const distanceKm = parseFloat(distMatch?.[1] || '0');
    const durationMinutes = parseInt(distMatch?.[2] || '0');

    // Pickup (take first occurrence — duplicates exist for mobile layout)
    const pickup = $('[data-testid="address_point_0_address"]').first().text().trim();
    const pickupTime = $('[data-testid="address_point_0_time"]').first().text().trim();

    // Dropoff
    const dropoff = $('[data-testid="address_point_1_address"]').first().text().trim();
    const dropoffTime = $('[data-testid="address_point_1_time"]').first().text().trim();

    // Driver
    const driverRaw = $('[data-testid="driverInfo_title"]').first().text().trim();
    const driverName = driverRaw.replace(/^You rode with\s*/i, '');
    const driverRating = parseFloat($('[data-testid="driverInfo_rating"]').first().text().trim()) || 0;

    // Payment method
    const paymentMethod = $('[data-testid="payments_0_Card.String"]').first().text().trim();

    // Fare breakdown — all fare_line_item elements
    const fareBreakdown: UberFareItem[] = [];
    $('[data-testid^="fare_line_item_label_"]').each((_, el) => {
        const label = $(el).text().trim();
        const slug = ($(el).attr('data-testid') || '').replace('fare_line_item_label_', '');
        const amountEl = $(`[data-testid="fare_line_item_amount_${slug}"]`).first();
        const amountText = amountEl.text().trim();
        const isNegative = amountText.startsWith('-');
        const amount = parseAmount(amountText) * (isNegative ? -1 : 1);
        fareBreakdown.push({ label, amount });
    });

    // Date/time and license plate from full text
    $('style, script').remove();
    const text = $.root().text().replace(/\s+/g, ' ').trim();
    const dateTimeMatch = text.match(/([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})\s*(\d{1,2}:\d{2}\s*[ap]m)/i);
    const date = dateTimeMatch?.[1] || '';
    const time = dateTimeMatch?.[2] || '';

    const plateMatch = text.match(/License Plate:\s*([A-Z]{2}\d{2}[A-Z]*\d+)/i);
    const licensePlate = plateMatch?.[1] || '';

    return {
        date,
        time,
        rideType,
        driverName,
        driverRating,
        licensePlate,
        distanceKm,
        durationMinutes,
        pickup,
        pickupTime,
        dropoff,
        dropoffTime,
        total,
        fareBreakdown,
        paymentMethod,
    };
}
