import { IEnrichmentQuestionDoc, EnrichmentQuestionModel } from '@/schema/enrichment-question.schema';
import { BaseService } from '../base-service';

class EnrichmentQuestionService extends BaseService<IEnrichmentQuestionDoc> {
    constructor() {
        super(EnrichmentQuestionModel);
    }

    async findByBatch(batchId: string) {
        return this.model.find({ batch_id: batchId }).sort({ impact: -1 });
    }

    async findPending(userId: string) {
        return this.model.find({ user_id: userId, status: 'pending' }).sort({ impact: -1 });
    }

    async findAnswered(userId: string) {
        return this.model.find({ user_id: userId, status: 'answered' }).sort({ updatedAt: -1 });
    }

    async markAnswered(questionId: string, answer: any) {
        return this.model.findByIdAndUpdate(questionId, {
            status: 'answered',
            answer: { ...answer, answeredAt: new Date() },
        }, { new: true });
    }

    async markApplied(questionId: string) {
        return this.model.findByIdAndUpdate(questionId, { status: 'applied' }, { new: true });
    }
}

export const enrichmentQuestionService = new EnrichmentQuestionService();
