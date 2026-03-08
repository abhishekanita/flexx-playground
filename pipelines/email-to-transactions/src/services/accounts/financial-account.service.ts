import { IFinancialAccountDoc, FinancialAccountModel } from '@/schema/financial-account.schema';
import { BaseService } from '../base-service';

class FinancialAccountService extends BaseService<IFinancialAccountDoc> {
    constructor() {
        super(FinancialAccountModel);
    }

    async findByIdentifier(userId: string, accountIdentifier: string) {
        return this.model.findOne({ user_id: userId, account_identifier: accountIdentifier });
    }

    async findByVpa(userId: string, vpa: string) {
        return this.model.findOne({ user_id: userId, upi_vpa: vpa });
    }

    async upsertAccount(userId: string, provider: string, accountIdentifier: string, data: Partial<IFinancialAccountDoc>) {
        return this.model.findOneAndUpdate(
            { user_id: userId, provider, account_identifier: accountIdentifier },
            {
                $set: { ...data, last_seen_at: new Date() },
                $setOnInsert: { first_seen_at: new Date(), is_active: true },
            },
            { upsert: true, new: true }
        );
    }
}

export const financialAccountService = new FinancialAccountService();
