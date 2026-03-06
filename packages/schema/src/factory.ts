import { Model } from 'mongoose';
import { IUserAccountDoc, UserSchema } from './users';
import { GmailConnectionSchema, IGmailConnectionDoc } from './users/gmail-connection.schema';

function getModel<T>(model: any, name: string, schema: any): Model<T> {
    const model_ = model(name, schema);
    return model_;
}

export class ModelFactory {
    static getAllModel(model: any) {
        const result = {
            UserModel: getModel<IUserAccountDoc>(model, 'users', UserSchema),
            GmailConnectionModel: getModel<IGmailConnectionDoc>(model, 'connections.gmail', GmailConnectionSchema),
        };
        return result;
    }
}
