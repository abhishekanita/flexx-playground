import { UserModel, UserSubscriptionModel, SubscriptionPlanModel } from '@/schema';
import { SubscriptionStatus } from '@backend/types/enum';

class SeedTesterAccount {
    private readonly TESTER_PHONE = 9999900000;
    private readonly TESTER_USERNAME = 'Play Store Reviewer';

    async seed() {
        console.log('[SeedTesterAccount] Seeding play store test account...');

        // 1. Upsert test user
        const user = await UserModel.findOneAndUpdate(
            { phoneNumber: this.TESTER_PHONE },
            {
                $set: {
                    phoneNumber: this.TESTER_PHONE,
                    username: this.TESTER_USERNAME,
                    isTester: true,
                    isOnboarded: true,
                    isSubscribed: true,
                    isAdmin: false,
                    attributes: {},
                    experiments: {},
                    referralCount: 0,
                    expoPushTokens: [],
                },
                $setOnInsert: {
                    avatar: '',
                },
            },
            { upsert: true, new: true }
        );

        console.log(`[SeedTesterAccount] User upserted: ${user._id}`);

        // 2. Find an existing active plan, or use a placeholder ID
        const plan = await SubscriptionPlanModel.findOne({ isActive: true });
        const planId = plan?._id?.toString() || 'test_plan_playstore';

        // 3. Upsert subscription with far-future expiry
        const now = new Date();
        const tenYearsFromNow = new Date(now);
        tenYearsFromNow.setFullYear(tenYearsFromNow.getFullYear() + 10);

        const subscription = await UserSubscriptionModel.findOneAndUpdate(
            { razorpaySubscriptionId: 'test_sub_playstore' },
            {
                $set: {
                    userId: user._id.toString(),
                    planId,
                    razorpaySubscriptionId: 'test_sub_playstore',
                    status: SubscriptionStatus.Active,
                    currentPeriodStart: now,
                    currentPeriodEnd: tenYearsFromNow,
                    totalCount: 999,
                    paidCount: 999,
                    remainingCount: 0,
                },
            },
            { upsert: true, new: true }
        );

        console.log(`[SeedTesterAccount] Subscription upserted: ${subscription._id}`);
        console.log('[SeedTesterAccount] Done. Test account ready:');
        console.log(`  Phone: ${this.TESTER_PHONE}`);
        console.log('  OTP: 123456');
    }
}

export default new SeedTesterAccount();
