import { IInvestmentAccountDoc, InvestmentAccountModel } from '@/schema/investment-account.schema';
import { BaseService } from '../base-service';

class InvestmentAccountService extends BaseService<IInvestmentAccountDoc> {
    constructor() {
        super(InvestmentAccountModel);
    }

    async findByDpId(userId: string, dpId: string) {
        return this.model.findOne({ user_id: userId, dp_id: dpId });
    }

    async findByPlatformAndAccountId(userId: string, platform: string, accountId: string) {
        return this.model.findOne({ user_id: userId, platform, account_id: accountId });
    }

    async upsertAccount(userId: string, key: { platform: string; account_id?: string; dp_id?: string }, data: Partial<IInvestmentAccountDoc>) {
        const filter: any = { user_id: userId, platform: key.platform };
        if (key.account_id) filter.account_id = key.account_id;
        else if (key.dp_id) filter.dp_id = key.dp_id;

        return this.model.findOneAndUpdate(
            filter,
            {
                $set: { ...data, last_seen_at: new Date() },
                $setOnInsert: { first_seen_at: new Date(), is_active: true },
            },
            { upsert: true, new: true }
        );
    }
}

export const investmentAccountService = new InvestmentAccountService();
