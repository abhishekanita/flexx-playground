import { Document, Model, ObjectId, PipelineStage } from 'mongoose';

export abstract class BaseService<T extends Document> {
    model: Model<T>;
    paginatedResultsLabel: string = 'docs';

    constructor(model: Model<T>) {
        this.model = model;
    }

    async findOne(conditions: any): Promise<T | null> {
        return await this.model.findOne(conditions);
    }

    async findById(id: string | ObjectId): Promise<T | null> {
        return await this.model.findById(id).exec();
    }

    async find(conditions: any): Promise<T[]> {
        return await this.model.find(conditions);
    }

    async create(data: Partial<T>): Promise<T> {
        const doc = new this.model(data);
        await doc.save();
        return doc;
    }

    async update(conditions: any, update: any): Promise<any> {
        return await this.model.updateOne(conditions, update);
    }

    async updateMany(conditions: any, update: any): Promise<any> {
        return await this.model.updateMany(conditions, update);
    }
    async insertMany(items: any[]): Promise<any[]> {
        return await this.model.insertMany(items);
    }

    async findByIdAndUpdate(id: any, update: any): Promise<T | null> {
        return this.model.findByIdAndUpdate(id, update, { new: true }).exec();
    }

    async findOneAndUpdate(conditions: any, update: any, options: any = { new: true, upsert: true }): Promise<any> {
        return await this.model.findOneAndUpdate(conditions, update, options);
    }

    async findOrCreate(conditions: any, document: any): Promise<T | null> {
        const doc = await this.model.findOne(conditions).exec();
        if (doc) return doc;
        const newDoc = await this.create(document);
        return newDoc;
    }

    async deleteOne(conditions: any): Promise<any> {
        return await this.model.deleteOne(conditions);
    }

    async deleteById(id: string): Promise<T | null> {
        return await this.model.findByIdAndDelete(id);
    }

    async getAggregatedResults(aggregateOptions: any): Promise<Array<any>> {
        try {
            const result = await this.model.aggregate(aggregateOptions, {});
            return result;
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    async getAggregatedCount(aggregateOptions: PipelineStage[]): Promise<number> {
        try {
            const options = [
                ...aggregateOptions.filter((stage: PipelineStage) => {
                    if (stage['$skip'] || stage['$limit'] || stage['$sort'] || stage['$lookup'] || stage['$project']) return false;
                    return true;
                }),
                { $count: 'count' },
            ];
            const result = await this.model.aggregate(options);
            if (!result || result.length === 0) return 0;
            return result[0].count;
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    async bulkWrite(operations: any[], options: any = {}): Promise<any> {
        try {
            const result = await this.model.bulkWrite(operations, options);
            return result;
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    async findPaginated(searchQuery: any = {}, sortQuery: any = {}, page = 1, limit = 10, populateQuery: any | string = {}): Promise<any> {
        const skip = (page - 1) * limit;
        const data: any = await this.model.find(searchQuery).collation({ locale: 'en' }).sort(sortQuery).skip(skip).limit(limit);

        if (populateQuery) {
            await data.populate(populateQuery);
        }
        return data;
    }
}
