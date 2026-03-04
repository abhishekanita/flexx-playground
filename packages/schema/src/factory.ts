import { Model } from 'mongoose';

function getModel<T>(model: any, name: string, schema: any): Model<T> {
    const model_ = model(name, schema);
    return model_;
}

export class ModelFactory {
    static getAllModel(model: any) {
        const result = {
            // User models
            // UserModel: getModel<IUserAccountDoc>(model, 'users', UserSchema),
        };
        return result;
    }
}
