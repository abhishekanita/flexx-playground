// =============================================================================
// Swiggy Instamart — HTML Email Parser
// =============================================================================
// Parses delivery confirmation emails from no-reply@swiggy.in

import * as cheerio from 'cheerio';

export interface InstamartItem {
    name: string;
    quantity: number;
    price: number;
}

export interface InstamartOrder {
    orderId: string;
    deliveryAddress: string;
    items: InstamartItem[];
    itemBill: number;
    handlingFee: number;
    deliveryPartnerFee: number;
    grandTotal: number;
}

function parseAmount(str: string): number {
    return parseFloat(str.replace(/[₹,\s]/g, '')) || 0;
}

export function parseSwiggyInstamartEmail(html: string): InstamartOrder {
    const $ = cheerio.load(html);
    const text = $.root().text().replace(/\s+/g, ' ').trim();

    // Order ID
    const orderIdMatch = text.match(/order id:\s*(\d+)/i);
    const orderId = orderIdMatch?.[1] || '';

    // Delivery address
    const addrMatch = text.match(/Deliver To:\s*(.+?)(?:\s+Order Items)/);
    const deliveryAddress = addrMatch?.[1]?.trim() || '';

    // Items — parse from HTML: "qty x name ₹price"
    const items: InstamartItem[] = [];
    const itemMatches = text.matchAll(/(\d+)\s+x\s+(.+?)\s+₹([\d,.]+)/g);
    for (const m of itemMatches) {
        items.push({
            quantity: parseInt(m[1]),
            name: m[2].trim(),
            price: parseAmount(m[3]),
        });
    }

    // Totals
    const itemBill = parseAmount(text.match(/Item Bill\s*₹([\d,.]+)/)?.[1] || '0');
    const handlingFee = parseAmount(text.match(/Handling Fee\s*₹([\d,.]+)/)?.[1] || '0');
    const deliveryPartnerFee = parseAmount(text.match(/Delivery Partner Fee\s*₹([\d,.]+)/)?.[1] || '0');
    const grandTotal = parseAmount(text.match(/Grand Total\s*₹([\d,.]+)/)?.[1] || '0');

    return {
        orderId,
        deliveryAddress,
        items,
        itemBill,
        handlingFee,
        deliveryPartnerFee,
        grandTotal,
    };
}
