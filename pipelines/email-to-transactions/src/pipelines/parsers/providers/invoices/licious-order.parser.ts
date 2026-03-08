import * as cheerio from 'cheerio';

export interface LiciousItem {
    name: string;
    price: number;
}

export interface LiciousOrder {
    orderId: string;
    items: LiciousItem[];
    discount: number;
    deliveryCharges: number;
    handlingFee: number;
    expressCharge: number;
    orderTotal: number;
}

export function parseLiciousOrderEmail(html: string): LiciousOrder {
    const $ = cheerio.load(html);
    const text = $.root().text().replace(/\s+/g, ' ').trim();

    // Order ID
    const orderMatch = text.match(/Order\s*#\s*(\S+)/);
    const orderId = orderMatch?.[1] || '';

    // Items — each product row has an img with alt=product name and a price cell with ₹
    const items: LiciousItem[] = [];
    $('img.product_image, img[class*="product"]').each((_, el) => {
        const name = $(el).attr('alt');
        if (!name) return;
        // Find the price in the same row
        const row = $(el).closest('tr');
        const priceText = row.find('td').last().text().trim();
        const priceMatch = priceText.match(/₹?\s*([\d,.]+)/);
        const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;
        items.push({ name, price });
    });

    // Bill details
    const extract = (pattern: RegExp): number => {
        const m = text.match(pattern);
        return m ? parseFloat(m[1].replace(/,/g, '')) : 0;
    };

    return {
        orderId,
        items,
        discount: extract(/Discount applied\s+-?₹?\s*([\d,.]+)/i),
        deliveryCharges: extract(/Delivery Charges\s+₹?\s*([\d,.]+)/i),
        handlingFee: extract(/Handling Fee\s+₹?\s*([\d,.]+)/i),
        expressCharge: extract(/Express Charge\s+₹?\s*([\d,.]+)/i),
        orderTotal: extract(/Order total\s+₹?\s*([\d,.]+)/i),
    };
}
