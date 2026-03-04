import mongoose, { Document, Schema, Types } from 'mongoose';
import type { LineItem } from '@/types/financial.types';

export interface IInvoice {
    userId: Types.ObjectId;
    rawEmailId: Types.ObjectId;
    transactionId?: Types.ObjectId;

    merchantName: string;
    externalOrderId?: string;
    orderDate: Date;

    subtotal?: number;
    taxes?: number;
    deliveryFee?: number;
    discount?: number;
    totalAmount: number;

    lineItems: LineItem[];
    paymentMethod?: string;

    senderKey: string;
    parserConfigId: string;
}

export interface IInvoiceDoc extends Document, IInvoice {
    createdAt: Date;
    updatedAt: Date;
}

const LineItemSchema = new Schema(
    {
        name: { type: String, required: true },
        quantity: Number,
        unitPrice: Number,
        totalPrice: { type: Number, required: true },
    },
    { _id: false }
);

const InvoiceSchema = new Schema<IInvoiceDoc>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        rawEmailId: { type: Schema.Types.ObjectId, ref: 'RawEmail', required: true },
        transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },

        merchantName: { type: String, required: true },
        externalOrderId: String,
        orderDate: { type: Date, required: true },

        subtotal: Number,
        taxes: Number,
        deliveryFee: Number,
        discount: Number,
        totalAmount: { type: Number, required: true },

        lineItems: [LineItemSchema],
        paymentMethod: String,

        senderKey: { type: String, required: true },
        parserConfigId: { type: String, required: true },
    },
    { timestamps: true, versionKey: false, collection: 'invoices' }
);

InvoiceSchema.index({ userId: 1, rawEmailId: 1 }, { unique: true });
InvoiceSchema.index({ userId: 1, merchantName: 1, orderDate: -1 });
InvoiceSchema.index({ userId: 1, externalOrderId: 1 });

export const Invoice = mongoose.model<IInvoiceDoc>('Invoice', InvoiceSchema);
