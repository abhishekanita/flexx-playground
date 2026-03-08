// =============================================================================
// Swiggy Food & Gourmet — HTML Email Parser
// =============================================================================
// Parses delivery confirmation emails from noreply@swiggy.in
// Same format for Swiggy Food and Swiggy Gourmet orders.

import * as cheerio from 'cheerio';

export interface SwiggyFoodItem {
    name: string;
    quantity: number;
    price: number;
}

export interface SwiggyFoodOrder {
    orderId: string;
    restaurant: string;
    restaurantAddress: string;
    deliveryAddress: string;
    orderedAt: string;      // "Feb 25, 8:54 PM"
    deliveredAt: string;    // "Feb 25, 9:53 PM"
    items: SwiggyFoodItem[];
    itemTotal: number;
    packagingFee: number;
    platformFee: number;
    deliveryFee: number;
    discount: number;
    discountCode: string;
    taxes: number;
    orderTotal: number;
    paidVia: string;        // "Bank" | "UPI" etc.
    isGourmet: boolean;
}

function parseAmount(str: string): number {
    const cleaned = str.replace(/[₹,\s]/g, '');
    return parseFloat(cleaned) || 0;
}

export function parseSwiggyFoodEmail(html: string): SwiggyFoodOrder {
    const $ = cheerio.load(html);
    const text = $.root().text().replace(/\s+/g, ' ').trim();

    // Order ID
    const orderIdMatch = text.match(/Order No:\s*(\d+)/);
    const orderId = orderIdMatch?.[1] || '';

    // Restaurant
    const restaurantMatch = text.match(/(?:Restaurant|Ordered from:)\s+(.+?)(?:\s+Your Order Summary|\s+Shop No|\s+\d|$)/);
    const orderedFromMatch = text.match(/Ordered from:\s+(.+?)(?:\s+Shop No|\s+Lg-|\s+\d{1,3}(?:st|nd|rd|th)|\s+Ground|\s+First|\s+Second|\s+Delivery To)/);
    const restaurant = orderedFromMatch?.[1]?.trim() || restaurantMatch?.[1]?.trim() || '';

    // Restaurant address
    const restAddrMatch = text.match(/Ordered from:\s+.+?\s+((?:Shop No|Lg-|Ground|First|Second|\d).+?)\s+Delivery To/);
    const restaurantAddress = restAddrMatch?.[1]?.trim() || '';

    // Delivery address
    const delivAddrMatch = text.match(/Delivery To:\s+(?:Abhishek Aggarwal\s+)?(.+?)(?:\s+(?:Gurugram|Item Name))/);
    const deliveryAddress = delivAddrMatch?.[1]?.trim() || '';

    // Times
    const orderedAtMatch = text.match(/Order placed at:\s+(.+?)(?:\s+Order delivered)/);
    const orderedAt = orderedAtMatch?.[1]?.trim() || '';

    const deliveredAtMatch = text.match(/Order delivered at:\s+(.+?)(?:\s+Order Status)/);
    const deliveredAt = deliveredAtMatch?.[1]?.trim() || '';

    // Items — parse from HTML table structure
    const items: SwiggyFoodItem[] = [];
    // Items are between "Item Name Quantity Price" and "Item Total"
    const itemSection = text.match(/Item Name\s+Quantity\s+Price\s+(.+?)\s+Item Total/);
    if (itemSection) {
        // Split on the "qty ₹ price" pattern, each segment before it is the item name
        // Format: "Name1 qty1 ₹ price1 Name2 qty2 ₹ price2 ..."
        const parts = itemSection[1].split(/\s+(\d+)\s+₹\s*([\d,.]+)\s*/);
        // parts = [name1, qty1, price1, name2, qty2, price2, ...]
        for (let i = 0; i < parts.length - 2; i += 3) {
            let name = parts[i].trim();
            // If this is the first item, the name may contain preamble text
            // Take only the last meaningful segment (after the last sentence-ending pattern)
            if (i === 0 && name.length > 80) {
                // Find the last occurrence of a pattern that looks like end of preamble
                const lastParen = name.lastIndexOf('(');
                if (lastParen > 0) {
                    // Back-track to find the start of the actual item name
                    const beforeParen = name.substring(0, lastParen).trimEnd();
                    const lastSpace = beforeParen.lastIndexOf(' ');
                    name = name.substring(lastSpace + 1).trim();
                } else {
                    // Fallback: take last 50 chars max
                    name = name.substring(name.length - 50).trim();
                }
            }
            const qty = parseInt(parts[i + 1]);
            const price = parseAmount(parts[i + 2]);
            if (name && qty && price) {
                items.push({ name, quantity: qty, price });
            }
        }
    }

    // Amounts
    const itemTotal = parseAmount(text.match(/Item Total:\s*₹\s*([\d,.]+)/)?.[1] || '0');
    const packagingFee = parseAmount(text.match(/(?:Restaurant )?Packaging:\s*₹\s*([\d,.]+)/)?.[1] || '0');
    const platformFee = parseAmount(text.match(/Platform Fee:\s*₹\s*([\d,.]+)/)?.[1] || '0');

    const deliveryFeeMatch = text.match(/Delivery Fee.*?:\s*(FREE|₹\s*[\d,.]+)/);
    const deliveryFee = deliveryFeeMatch?.[1] === 'FREE' ? 0 : parseAmount(deliveryFeeMatch?.[1] || '0');

    const discountMatch = text.match(/Discount Applied\s*(?:\((\w+)\))?\s*:\s*-?\s*₹\s*([\d,.]+)/);
    const discount = parseAmount(discountMatch?.[2] || '0');
    const discountCode = discountMatch?.[1] || '';

    const taxes = parseAmount(text.match(/Taxes:\s*₹\s*([\d,.]+)/)?.[1] || '0');
    const orderTotal = parseAmount(text.match(/Order Total:\s*₹\s*([\d,.]+)/)?.[1] || '0');

    const paidViaMatch = text.match(/Paid Via\s+(\w+):\s*₹/);
    const paidVia = paidViaMatch?.[1] || '';

    const isGourmet = /Gourmet/i.test(text);

    return {
        orderId,
        restaurant,
        restaurantAddress,
        deliveryAddress,
        orderedAt,
        deliveredAt,
        items,
        itemTotal,
        packagingFee,
        platformFee,
        deliveryFee,
        discount,
        discountCode,
        taxes,
        orderTotal,
        paidVia,
        isGourmet,
    };
}
