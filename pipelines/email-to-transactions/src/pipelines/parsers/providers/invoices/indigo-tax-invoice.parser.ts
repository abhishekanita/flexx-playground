// IndiGo Tax Invoice PDF parser (stub — format TBD after PDF extraction)

export interface IndigoTaxInvoice {
    bookingRef: string;
    invoiceNumber: string;
    invoiceDate: string;
    passengerName: string;
    route: string;
    baseFare: number;
    taxes: number;
    total: number;
    gstDetails: Array<{
        type: string; // CGST, SGST, IGST
        rate: number;
        amount: number;
    }>;
}

export function parseIndigoTaxInvoice(text: string): IndigoTaxInvoice {
    const result: IndigoTaxInvoice = {
        bookingRef: '',
        invoiceNumber: '',
        invoiceDate: '',
        passengerName: '',
        route: '',
        baseFare: 0,
        taxes: 0,
        total: 0,
        gstDetails: [],
    };

    const refMatch = text.match(/(?:PNR|Booking Ref|Reference)\s*:?\s*([A-Z0-9]{6})/i);
    if (refMatch) result.bookingRef = refMatch[1];

    const invMatch = text.match(/Invoice\s*(?:No|Number)\s*:?\s*(\S+)/i);
    if (invMatch) result.invoiceNumber = invMatch[1];

    const dateMatch = text.match(/Invoice\s*Date\s*:?\s*(\d{2}[\/-]\w+[\/-]\d{4})/i);
    if (dateMatch) result.invoiceDate = dateMatch[1];

    const nameMatch = text.match(/(?:Passenger|Name)\s*:?\s*([A-Z][A-Z\s]+)/);
    if (nameMatch) result.passengerName = nameMatch[1].trim();

    const totalMatch = text.match(/(?:Grand Total|Total Amount|Net Amount)\s*:?\s*(?:INR|Rs\.?)?\s*([\d,]+\.?\d*)/i);
    if (totalMatch) result.total = parseFloat(totalMatch[1].replace(/,/g, '')) || 0;

    return result;
}
