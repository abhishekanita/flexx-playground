// =============================================================================
// Apple Invoice — HTML Email Parser
// =============================================================================
// Parses invoice/receipt emails from Apple (App Store subscriptions, purchases)

import * as cheerio from 'cheerio';

export interface AppleInvoiceItem {
    name: string;
    description: string;
    price: number;
    renewDate: string;
    device: string;
}

export interface AppleInvoice {
    invoiceDate: string;    // "22 January 2026"
    orderId: string;
    documentId: string;
    appleAccount: string;
    items: AppleInvoiceItem[];
    subtotal: number;
    igst: number;
    igstRate: string;
    total: number;
    paymentMethod: string;
    billingName: string;
    billingAddress: string;
}

function parseAmount(str: string): number {
    return parseFloat(str.replace(/[₹,\s]/g, '')) || 0;
}

export function parseAppleInvoiceEmail(html: string): AppleInvoice {
    const $ = cheerio.load(html);

    // Header — extract from text
    const text = $.root().text().replace(/\s+/g, ' ').trim();

    const dateMatch = text.match(/Tax Invoice\s*(\d{1,2}\s+\w+\s+\d{4})/);
    const invoiceDate = dateMatch?.[1] || '';

    const orderIdMatch = text.match(/Order ID:\s*([A-Z0-9]+)/);
    const orderId = orderIdMatch?.[1] || '';

    const docIdMatch = text.match(/Document:\s*(\d+)/);
    const documentId = docIdMatch?.[1] || '';

    // Extract from HTML to avoid concatenation with next element
    const accountEl = $('*:contains("Apple Account")').filter((_, el) => {
        const ownText = $(el).clone().children().remove().end().text().trim();
        return ownText.includes('Apple Account');
    }).last();
    const accountSibling = accountEl.next();
    let appleAccount = accountSibling.text().trim();
    if (!appleAccount.includes('@')) {
        const accountMatch = text.match(/Apple Account:\s*([\w.+-]+@[\w.]+\.\w+)/);
        appleAccount = accountMatch?.[1] || '';
    }

    // Items — use the product image alt text as the app name
    const items: AppleInvoiceItem[] = [];
    $('img[alt]').each((_, img) => {
        const alt = $(img).attr('alt') || '';
        const src = $(img).attr('src') || '';
        if (!src.includes('is1-ssl.mzstatic.com')) return;

        // The item container is the closest table row
        const row = $(img).closest('table, tr');
        const rowText = row.text().replace(/\s+/g, ' ').trim();

        // Price
        const priceMatch = rowText.match(/₹\s*([\d,.]+)/);
        const price = parseAmount(priceMatch?.[1] || '0');

        // Description — the text after app name but before SAC/Renews
        const descMatch = rowText.match(/(?:SAC:\s*\d+\s*)?(.+?)(?:SAC:|Renews|₹)/);
        let description = '';
        if (descMatch) {
            // Remove the app name from the captured text
            description = descMatch[1].replace(alt, '').trim();
        }

        // Renew date
        const renewMatch = rowText.match(/Renews\s+(\d{1,2}\s+\w+\s+\d{4})/);
        const renewDate = renewMatch?.[1]?.trim() || '';

        // Device
        const deviceMatch = rowText.match(/([A-Za-z]+'s\s+(?:iPhone|iPad|Mac|Apple Watch)[\w\s]*)/);
        const device = deviceMatch?.[1]?.trim() || '';

        items.push({ name: alt, description, price, renewDate, device });
    });

    // Totals
    const subtotal = parseAmount(text.match(/Subtotal\s*₹\s*([\d,.]+)/)?.[1] || '0');
    const igstMatch = text.match(/IGST charged at\s*(\d+%)\s*₹\s*([\d,.]+)/);
    const igst = parseAmount(igstMatch?.[2] || '0');
    const igstRate = igstMatch?.[1] || '';
    const total = subtotal + igst;

    // Payment method (UPI VPA)
    const paymentMatch = text.match(/([\w.]+@\w+)\s*₹\s*[\d,.]+\s*You can/);
    const paymentMethod = paymentMatch?.[1] || '';

    // Billing
    const billingMatch = text.match(/Billing and Payment\s*(.+?)\s*Subtotal/);
    const billingText = billingMatch?.[1] || '';
    const nameMatch = billingText.match(/^([A-Za-z\s]+?)(?:#|\d)/);
    const billingName = nameMatch?.[1]?.trim() || '';
    const billingAddress = billingText.replace(billingName, '').trim();

    return {
        invoiceDate,
        orderId,
        documentId,
        appleAccount,
        items,
        subtotal,
        igst,
        igstRate,
        total,
        paymentMethod,
        billingName,
        billingAddress,
    };
}
