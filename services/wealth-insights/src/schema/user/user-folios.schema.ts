import { MFUserFolio } from '@/types/storage/user-folio.type';
import { Document, Schema, model } from 'mongoose';

export interface IMFUserFolioDoc extends Document, Omit<MFUserFolio, '_id'> {}

const schema = new Schema<IMFUserFolioDoc>(
    {
        pan: { type: String, required: true, index: true },
        email: { type: String, required: true, index: true },
        folioNumber: { type: String, required: true },
        fundHouse: { type: String, required: true },
        scheme: {
            schemeName: { type: String },
            schemeCode: { type: String },
            isin: { type: String },
            currentName: { type: String },
            plan: { type: String, enum: ['Direct', 'Regular'] },
            option: { type: String },
            dematStatus: { type: String },
            registrar: { type: String, enum: ['CAMS', 'KFINTECH'] },
            advisor: { type: String },
        },
        investor: {
            holderName: { type: String },
            nominees: { type: [String], default: [] },
            kycOk: { type: Boolean, default: false },
            panOk: { type: Boolean, default: false },
        },
        openingUnitBalance: { type: Number, default: 0 },
        closingUnitBalance: { type: Number, default: 0 },
        snapshot: {
            navDate: { type: String },
            nav: { type: Number },
            costValue: { type: Number },
            marketValue: { type: Number },
        },
        status: { type: String, enum: ['active', 'closed'], default: 'active' },
        stampDutyTotal: { type: Number, default: 0 },
        transactionCount: { type: Number, default: 0 },
        firstTransactionDate: { type: String },
        lastTransactionDate: { type: String },
        lastSyncedAt: { type: Date },
    },
    {
        timestamps: true,
        versionKey: false,
        collection: 'mfs.user.folios',
    }
);

schema.index({ pan: 1, folioNumber: 1 }, { unique: true });
schema.index({ pan: 1, status: 1 });

export const MFUserFolioModel = model<IMFUserFolioDoc>('mfs.user.folios', schema);
