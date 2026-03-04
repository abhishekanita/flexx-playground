import resetMandates from './reset-mandates';
import parseAppleEmails from './parse-apple-emails';

export const runTests = async () => {
    // await seedAiChat.start();
    // await seedCoachingPrograms.run(true);
    // await seedTesterAccount.seed();
    // await seedVideoClips.run(true);
    // await seedCourses.run(true);
    // await seedExperiments.seed();
    // await generateCourses();
    // await seedAiChat.uploadCoachImages();
    // await testAiChat.start();
    // await testCoaching.run();
    // await testAiChat.start();
    // Seed scripts
    // await testNotifications.sendTestToUser();
    // await new TestOTPLess().testSendOtp();
    // await seedExperts.run(true);
    // await seedTesterAccount.seed();
    // Subscription tests - uncomment the one you want to run
    // await testSubscription.testGetRazorpayPlan();
    // await testSubscription.testGetActivePlan();
    // await testSubscription.listAllPlans();
    // await testSubscription.testCreateSubscription();
    // await testSubscription.testGetActiveSubscription('USER_ID');
    // await testSubscription.testGetRazorpaySubscription('sub_xxxxx');
    // await testSubscription.testSyncSubscription('SUBSCRIPTION_ID');
    // await testSubscription.testCancelSubscription('USER_ID', 'SUBSCRIPTION_ID', true);
    // await testSubscription.testGetPaymentHistory('RAZORPAY_SUBSCRIPTION_ID');
    // await testSubscription.testGetRazorpayInvoices('sub_xxxxx');
    // await testSubscription.listAllSubscriptions();
    // await testSubscription.runFullFlowTest('USER_ID', 'PHONE_NUMBER');
    // await testSubscription.cleanupTestData(false); // false = only test user, true = all data
    // Notification tests - uncomment the one you want to run
    // await testNotifications.listUsersWithTokens();
    // await testNotifications.sendTestToUser('USER_ID');
    // await testNotifications.sendDeepLinkNotification('USER_ID');
    // await testNotifications.sendBulkToAll();
    // await testNotifications.sendBulkToSubscribed();
    // await testNotifications.testRegisterToken('USER_ID');
    // await testNotifications.testRemoveToken('USER_ID');
    // await testNotifications.runQuickTest(); // finds a user with tokens and sends a test
    // Account Aggregator tests
    // await testAccountAggregator.testLogin();
    // await testAccountAggregator.testGetConsentStatus('RID_HERE', '9453103854@finvu');
    // await testAccountAggregator.testFetchFIData('CONSENT_HANDLE', 'SESSION_ID');
    // await testAccountAggregator.runFullFlowTest();

    // Credit Score tests
    // await testCreditScore.testInitiate();
    // await testCreditScore.testAuthorize('de986f0d-ca16-4c09-b5be-6790acf63a58', 'CCR260219CR385144884');
    // await testCreditScore.testFetchReport('de986f0d-ca16-4c09-b5be-6790acf63a58', 'CCR260219CR385144884');
    // await testCreditScore.runFullFlowTest();

    // Mandate tools
    // await resetMandates.run();
    // await parseAppleEmails.run();

    console.log('done-scripts');
};

// {
//   "orderId": "de986f0d-ca16-4c09-b5be-6790acf63a58",
//   "reportId": "",
//   "status": "PENDING",
//   "rawResponse": "{\"redirectURL\":\"https://cir.crifhighmark.com/Inquiry/B2B/secureService.action\",\"reportId\":\"CCR260219CR385144884\",\"orderId\":\"de986f0d-ca16-4c09-b5be-6790acf63a58\",\"status\":\"S06\"}"
// }
