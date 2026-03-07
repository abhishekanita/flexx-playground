// =============================================================================
// MakeMyTrip Flight E-Ticket — HTML Email Parser
// =============================================================================
// Parses flight booking confirmation emails from MakeMyTrip

import * as cheerio from 'cheerio';

export interface FlightSegment {
    airline: string;
    flightNumber: string;
    pnr: string;
    from: string;
    fromAirport: string;
    fromTerminal: string;
    departureTime: string;
    to: string;
    toAirport: string;
    toTerminal: string;
    arrivalTime: string;
    duration: string;
    cabinClass: string;
    cabinBaggage: string;
    checkinBaggage: string;
}

export interface FlightBooking {
    bookingId: string;
    route: string;          // "Bengaluru - New Delhi"
    tripType: string;       // "One Way"
    travelDate: string;     // "Wed, 17 Dec"
    bookedOn: string;       // "15 Dec 2025"
    travelers: string[];
    segments: FlightSegment[];
    totalAmount: number;
    paidVia: string;        // "UPI"
    amountPaid: number;
    discountCode: string;
    discountAmount: number;
}

function parseAmount(str: string): number {
    return parseFloat(str.replace(/[₹,\s]/g, '')) || 0;
}

export function parseMakeMyTripEmail(html: string): FlightBooking {
    const $ = cheerio.load(html);
    $('style, script').remove();
    const text = $.root().text().replace(/\s+/g, ' ').trim();

    // Booking ID
    const bookingIdMatch = text.match(/Booking ID:\s*([A-Z0-9]+)/);
    const bookingId = bookingIdMatch?.[1] || '';

    // Route and trip type
    const routeMatch = text.match(/Booking Confirmed\s*(.+?)\s*(One Way|Round Trip|Multi City)/i);
    const route = routeMatch?.[1]?.trim() || '';
    const tripType = routeMatch?.[2] || '';

    // Travel date
    const dateMatch = text.match(/(?:One Way|Round Trip),\s*(.+?)\s*Booking ID/);
    const travelDate = dateMatch?.[1]?.trim() || '';

    // Booked on
    const bookedOnMatch = text.match(/Booked on\s+(.+?)\)/);
    const bookedOn = bookedOnMatch?.[1]?.trim() || '';

    // Flight details
    const segments: FlightSegment[] = [];
    const flightMatch = text.match(/(Air India Express|Air India|IndiGo|SpiceJet|Vistara|Akasa Air|GoAir|Alliance Air|AirAsia India|Star Air)\s+([A-Z0-9]{2}\s*\d+)\s+PNR:\s*([A-Z0-9]+)/);
    if (flightMatch) {
        const airline = flightMatch[1];
        const flightNumber = flightMatch[2].replace(/\s+/g, ' ');
        const pnr = flightMatch[3];

        // Departure/Arrival
        const depMatch = text.match(/(\w+)\s+([A-Z]{3})\s+(\d{2}:\d{2})\s*hrs\s+\w+,\s+\w+\s+\d+\s+(.+?Terminal\s*\w+)\s+(\d+\s*h\s*\d+\s*m)/);
        const arrMatch = text.match(/(\d+\s*h\s*\d+\s*m)\s+(.+?)\s+(\d{2}:\d{2})\s*hrs\s+([A-Z]{3})\s+\w+,\s+\w+\s+\d+\s+(.+?Terminal\s*\w+)/);

        // Simpler extraction
        const fromMatch = text.match(/(\w+)\s+([A-Z]{3})\s+(\d{2}:\d{2})\s*hrs/);
        const toMatch = text.match(/(\d{2}\s*h\s*\d{2}\s*m)\s+(.+?)\s+(\d{2}:\d{2})\s*hrs\s+([A-Z]{3})/);
        const durationMatch = text.match(/(\d{2}\s*h\s*\d{2}\s*m)/);

        // Baggage
        const cabinBagMatch = text.match(/Cabin Baggage:\s*(.+?)(?:\s+Check-in)/);
        const checkinBagMatch = text.match(/Check-in Baggage:\s*(.+?)(?:\s+TRAVELLER)/);

        segments.push({
            airline,
            flightNumber,
            pnr,
            from: fromMatch?.[1] || '',
            fromAirport: '',
            fromTerminal: '',
            departureTime: fromMatch?.[3] || '',
            to: toMatch?.[2]?.trim() || '',
            toAirport: '',
            toTerminal: '',
            arrivalTime: toMatch?.[3] || '',
            duration: durationMatch?.[1] || '',
            cabinClass: 'Economy',
            cabinBaggage: cabinBagMatch?.[1]?.trim() || '',
            checkinBaggage: checkinBagMatch?.[1]?.trim() || '',
        });
    }

    // Travelers
    const travelers: string[] = [];
    const travelerMatch = text.match(/TRAVELLER.*?(?:Mr|Mrs|Ms)\s+([A-Za-z\s]+?)(?:\s+\(ADULT\)|\s+-)/);
    if (travelerMatch) travelers.push(travelerMatch[1].trim());

    // Payment
    const totalMatch = text.match(/Total Amount\s*₹\s*([\d,.]+)/);
    const totalAmount = parseAmount(totalMatch?.[1] || '0');

    const paidViaMatch = text.match(/Paid by\s+(\w+)\s*₹\s*([\d,.]+)/);
    const paidVia = paidViaMatch?.[1] || '';
    const amountPaid = parseAmount(paidViaMatch?.[2] || '0');

    const discountMatch = text.match(/You saved\s*₹\s*([\d,.]+)\s*with\s+(\w+)\s+coupon/);
    const discountAmount = parseAmount(discountMatch?.[1] || '0');
    const discountCode = discountMatch?.[2] || '';

    return {
        bookingId,
        route,
        tripType,
        travelDate,
        bookedOn,
        travelers,
        segments,
        totalAmount,
        paidVia,
        amountPaid,
        discountCode,
        discountAmount,
    };
}
