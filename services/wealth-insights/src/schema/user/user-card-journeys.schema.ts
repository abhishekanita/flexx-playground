import { CardJourney } from '@/types/advisory/card-journey.type';
import { Document, Schema, model } from 'mongoose';

export interface ICardJourneyDoc extends Document, Omit<CardJourney, '_id'> {}

const schema = new Schema<ICardJourneyDoc>(
    {
        pan: { type: String, required: true },
        insightKey: { type: String, required: true },
        cards: [Schema.Types.Mixed],
        assembledAt: { type: Date, default: Date.now },
        snapshotValues: Schema.Types.Mixed,
    },
    {
        timestamps: true,
        versionKey: false,
        collection: 'mfs.user.card-journeys',
    }
);

schema.index({ pan: 1, insightKey: 1 }, { unique: true });

export const CardJourneyModel = model<ICardJourneyDoc>('mfs.user.card-journeys', schema);
