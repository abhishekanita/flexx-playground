/**
 * SaveSage API Client
 * Reverse-engineered from com.savesage.club Android APK (decompiled with jadx)
 *
 * Base URL: https://api.savesage.club/
 * Auth: Bearer token from OTP verification
 * Headers: User-Agent, Platform, versionCode, Content-Type
 */

const BASE_URL = "https://api.savesage.club";

// Mimic the Android app's headers
const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  "User-Agent": "SaveSage-Android/3.0.0 (Build/300)",
  Platform: "Android",
  versionCode: "300",
};

// ─── Auth ────────────────────────────────────────────────────────────────────

interface LoginRequest {
  mobile: string;
  referralCode: string;
  gcmId: string;
  udId: string;
  adId: string;
  isOptin: boolean;
  campaignName: string;
  stageName: string;
}

interface OtpVerifyRequest {
  mobile: string;
  otp: string;
  referralCode: string;
}

interface WhatsappOtpRequest {
  mobile: string;
}

// ─── API Client ──────────────────────────────────────────────────────────────

class SaveSageClient {
  private token: string | null = null;

  private async request<T = any>(
    method: string,
    path: string,
    options: {
      body?: any;
      query?: Record<string, string | number | boolean>;
      auth?: boolean;
      formEncoded?: boolean;
    } = {}
  ): Promise<T> {
    const { body, query, auth = true, formEncoded = false } = options;

    const url = new URL(`${BASE_URL}/${path.replace(/^\//, "")}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = { ...DEFAULT_HEADERS };
    if (auth && this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    if (formEncoded) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }

    const fetchOptions: RequestInit = { method, headers };
    if (body) {
      fetchOptions.body = formEncoded
        ? new URLSearchParams(body).toString()
        : JSON.stringify(body);
    }

    console.log(`→ ${method} ${url.pathname}${url.search}`);
    const res = await fetch(url.toString(), fetchOptions);
    const text = await res.text();

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!res.ok) {
      console.error(`✗ ${res.status} ${res.statusText}`);
      console.error(typeof data === "string" ? data : JSON.stringify(data, null, 2));
      throw new Error(`API error ${res.status}: ${res.statusText}`);
    }

    console.log(`✓ ${res.status}`);
    return data as T;
  }

  // ── Auth Flow ───────────────────────────────────────────────────────

  /** Step 1: Send OTP to mobile number */
  async login(mobile: string) {
    return this.request("POST", "/auth/login", {
      auth: false,
      body: {
        mobile,
        referralCode: "",
        gcmId: "dummy-gcm-id",
        udId: "dummy-device-id",
        adId: "dummy-ad-id",
        isOptin: true,
        campaignName: "",
        stageName: "",
      } satisfies LoginRequest,
    });
  }

  /** Step 1 (alt): Send OTP via WhatsApp */
  async whatsappOtp(mobile: string) {
    return this.request("POST", "auth/whatsapp-otp", {
      auth: false,
      body: { mobile } satisfies WhatsappOtpRequest,
    });
  }

  /** Step 2: Verify OTP and get auth token */
  async verifyOtp(mobile: string, otp: string) {
    const res = await this.request<any>("POST", "/auth/verify", {
      auth: false,
      body: { mobile, otp, referralCode: "" } satisfies OtpVerifyRequest,
    });
    // Extract token from response and store it
    const token = res?.access_token || res?.data?.token || res?.token;
    if (token) {
      this.token = token;
      console.log("🔑 Token saved:", this.token?.slice(0, 30) + "...");
    }
    return res;
  }

  /** Set token directly (if you already have one) */
  setToken(token: string) {
    this.token = token.replace(/\s+/g, "");
    console.log("🔑 Token set:", this.token.slice(0, 30) + "...");
  }

  // ── User ────────────────────────────────────────────────────────────

  async getUserProfile() {
    return this.request("GET", "v2/users/me");
  }

  async getUserStatus() {
    return this.request("GET", "v3/user/status");
  }

  async getUserSettings(timezone: string = "Asia/Kolkata") {
    return this.request("GET", "users/setting", { query: { timezone } });
  }

  async updateUser(data: Record<string, any>) {
    return this.request("PATCH", "users/update", { body: data });
  }

  // ── Home & Dashboard ───────────────────────────────────────────────

  async getHomeScreen() {
    return this.request("GET", "v14/home-page");
  }

  async getMenuScreen() {
    return this.request("GET", "v11/home-page/menu");
  }

  async getHomePagePolling() {
    return this.request("GET", "v2/home-page/polling");
  }

  async getPendingActions() {
    return this.request("GET", "v2/pending-actions");
  }

  async getConfig() {
    return this.request("GET", "v1/config");
  }

  // ── Credit Cards ───────────────────────────────────────────────────

  async getCreditCards(page?: number, sortBy?: string) {
    return this.request("GET", "v10/user-card/overview", {
      query: { ...(page && { page }), ...(sortBy && { sortBy }) },
    });
  }

  async getMyCards() {
    return this.request("GET", "user-card/list");
  }

  async addUserCard() {
    return this.request("GET", "v3/card/get-list");
  }

  async saveUserCard(data: { cardId: string; lastFourDigit: string; cardTypeId?: string }) {
    return this.request("POST", "v2/user-card/add", { body: data });
  }

  async removeCard(data: { userCardId: string; reason?: string }) {
    return this.request("POST", "user-card/remove", { body: data });
  }

  async searchCard(key: string) {
    return this.request("GET", "v1/user-card/search", { query: { key } });
  }

  async getCardSettings(userCardId: string) {
    return this.request("GET", "v2/user-card/card-settings", { query: { userCardId } });
  }

  async getCardInfo(cardId: string) {
    return this.request("GET", "v3/card-recommendation/card-info", { query: { cardId } });
  }

  async getCardBenefits(cardId: string) {
    return this.request("GET", "v1/card-recommendation/card-benefit", { query: { cardId } });
  }

  async getKeyCharges(userCardId: string) {
    return this.request("GET", "card/charges", { query: { userCardId } });
  }

  async getViewStatement(userCardId: string, type?: string) {
    return this.request("GET", "v2/user-card/view-statement", {
      query: { userCardId, ...(type && { type }) },
    });
  }

  async getUnmappedCards(userCardId?: string) {
    return this.request("GET", "user-card/unmapped-cards", {
      query: { ...(userCardId && { userCardId }) },
    });
  }

  async mapCard(data: { userCardId: string; cardTypeId: string }) {
    return this.request("POST", "v3/user-card/map-card-type", { body: data });
  }

  async getTransactionHistory(userCardId: string, page: number = 1) {
    return this.request("GET", "transaction/history", { query: { userCardId, page } });
  }

  async getMilestones(cardId: string, userCardId: string, type: string) {
    return this.request("GET", "v3/user-card/milestones", { query: { cardId, userCardId, type } });
  }

  async getAnnualBillCycle(userCardId: string) {
    return this.request("GET", "v9/user-card/card-annual-cycle", { query: { userCardId } });
  }

  // ── Rewards & Benefits ─────────────────────────────────────────────

  async getRewardPoints(userCardId: string, type?: string) {
    return this.request("GET", "v3/user-card/earn-sources", {
      query: { userCardId, ...(type && { type }) },
    });
  }

  async getRewardsBenefits(userCardId?: string) {
    return this.request("GET", "v2/user-card/benefits", {
      query: { ...(userCardId && { userCardId }) },
    });
  }

  async getRewardOverview() {
    return this.request("GET", "v1/total-reward-value");
  }

  async editRewardPoints(userCardId: string, points: string) {
    return this.request("PATCH", "/user-card/edit-reward-point", {
      query: { userCardId, points },
    });
  }

  async getRedemptionData(userCardId: string, categoryType: string) {
    return this.request("GET", "v2/user-card/burn-category", {
      query: { userCardId, categoryType },
    });
  }

  async getRedemptionCategoryItems(userCardId: string, categoryType: string) {
    return this.request("GET", "v2/user-card/burn-category-items", {
      query: { userCardId, categoryType },
    });
  }

  async getVouchers(userCardId: string, type: string) {
    return this.request("GET", "card/vouchers", { query: { userCardId, type } });
  }

  // ── Spending Analysis ──────────────────────────────────────────────

  async getSpendAnalysis(type: string, current: string) {
    return this.request("GET", "v2/transaction/spend-analysis", { query: { type, current } });
  }

  async getSpendingCategory(
    type: string,
    current: string,
    categoryId: string,
    amount: string,
    filterType: string,
    page: number = 1
  ) {
    return this.request("GET", "v2/transaction/category-spend", {
      query: { type, current, categoryId, amount, filterType, page },
    });
  }

  async getDuesOverview() {
    return this.request("GET", "user-card/dues-overview");
  }

  async getUnbilledOverview() {
    return this.request("GET", "user-card/unbilled-overview");
  }

  // ── Loyalty Programs ───────────────────────────────────────────────

  async getLoyaltyPrograms(type: string) {
    return this.request("GET", "v3/user/loyalty-program", { query: { type } });
  }

  async getLoyaltyProgramList(type: string) {
    return this.request("GET", "v4/loyalty-program/getlist", { query: { type } });
  }

  async getLoyaltyProgramDetails(userLoyaltyProgramId: string) {
    return this.request("GET", "v4/user-loyalty-program/get", {
      query: { userLoyaltyProgramId },
    });
  }

  async addLoyaltyProgram(data: any) {
    return this.request("POST", "v3/user/loyalty-program/add", { body: data });
  }

  async editLoyaltyProgram(data: any) {
    return this.request("PATCH", "v2/user-loyalty-program/edit", { body: data });
  }

  async deleteLoyaltyProgram(userLoyaltyProgramId: string) {
    return this.request("PATCH", "v1/user-loyalty-program/delete", {
      query: { userLoyaltyProgramId },
    });
  }

  async getLoyaltyProgramCharges(userLoyaltyProgramId: string) {
    return this.request("GET", "v1/user-loyalty-program/charges", {
      query: { userLoyaltyProgramId },
    });
  }

  async getEarnData(userLoyaltyProgramId: string) {
    return this.request("GET", "v3/user-loyalty-program/earn", {
      query: { userLoyaltyProgramId },
    });
  }

  async getRedeemData(userLoyaltyProgramId: string) {
    return this.request("GET", "v3/user-loyalty-program/redeem", {
      query: { userLoyaltyProgramId },
    });
  }

  async getTransferIn(userLoyaltyProgramId: string) {
    return this.request("GET", "v4/user-loyalty-program/transfer-in", {
      query: { userLoyaltyProgramId },
    });
  }

  async getTransferOut(userLoyaltyProgramId: string) {
    return this.request("GET", "v3/user-loyalty-program/transfer-out", {
      query: { userLoyaltyProgramId },
    });
  }

  async getCheckTransferOption(userLoyaltyProgramId: string) {
    return this.request("GET", "v1/user-loyalty-program/transfer-option/get", {
      query: { userLoyaltyProgramId },
    });
  }

  async getTierBenefits(userLoyaltyProgramId: string) {
    return this.request("GET", "v2/user-loyalty-program/tier-list", {
      query: { userLoyaltyProgramId },
    });
  }

  // ── Credit Score ───────────────────────────────────────────────────

  async getCreditScoreLanding() {
    return this.request("GET", "v1/credit-score/landing-page");
  }

  async initiateCreditScore(data: any) {
    return this.request("POST", "v1/credit-score/initiate", { body: data });
  }

  async getCachedCreditScore(reportId: string) {
    return this.request("GET", "v1/credit-score", { query: { reportId } });
  }

  async refreshCreditScore(reportId: string) {
    return this.request("POST", "v1/credit-score/refresh", { query: { reportId } });
  }

  async getCreditScoreFaq() {
    return this.request("GET", "v1/credit-score/faq");
  }

  async getCreditScoreGuide() {
    return this.request("GET", "v1/credit-score/improve-guide");
  }

  async getCreditPaymentHistory(reportId: string) {
    return this.request("GET", "v1/credit-score/payment-history", { query: { reportId } });
  }

  async getCreditUsage(reportId: string) {
    return this.request("GET", "v1/credit-score/credit-usage", { query: { reportId } });
  }

  async getCreditAge(reportId: string) {
    return this.request("GET", "v1/credit-score/credit-age", { query: { reportId } });
  }

  async getCreditEnquiry(reportId: string) {
    return this.request("GET", "v1/credit-score/credit-enquiry", { query: { reportId } });
  }

  async deleteCreditScore() {
    return this.request("POST", "v1/credit-score/delete-user-data");
  }

  // ── Card Recommendations ───────────────────────────────────────────

  async getRecommendations() {
    return this.request("GET", "v4/card-recommendation/result");
  }

  async getRecommendationModeSelection() {
    return this.request("GET", "v3/card-recommendation/mode-selection");
  }

  async getPreferredRewards() {
    return this.request("GET", "v1/cr/preferred-reward");
  }

  async getLifestylePreference() {
    return this.request("GET", "v1/cr/lifestyle-preference");
  }

  async getIncomeProfile(type: string) {
    return this.request("GET", "v1/cr/income-profile", { query: { type } });
  }

  async getExpenseCategory() {
    return this.request("GET", "v1/cr/expense-category");
  }

  async getCardPortfolio() {
    return this.request("GET", "v1/cr/card-portfolio");
  }

  async getPortfolioComparison() {
    return this.request("GET", "v1/cr/card-comparison");
  }

  async getAllCards(page?: number) {
    return this.request("GET", "v1/cr/all-cards", { query: { ...(page && { page }) } });
  }

  async getCardRecommendationPolling() {
    return this.request("GET", "v2/card-recommendation/polling");
  }

  // ── Offers ─────────────────────────────────────────────────────────

  async getUserCardOffers(userCardId: string) {
    return this.request("GET", "v1/user-card/live-offers", { query: { userCardId } });
  }

  async getUserCardOffersByCategory(userCardId: string, category: string, page: string) {
    return this.request("GET", "v1/user-card/live-offers/category", {
      query: { userCardId, category, page },
    });
  }

  async getOfferDetails(offerCode: string, brandCode: string, userCardIds: string[]) {
    const url = new URL(`${BASE_URL}/v1/user-card/live-offers/details`);
    url.searchParams.set("offerCode", offerCode);
    url.searchParams.set("brandCode", brandCode);
    userCardIds.forEach((id) => url.searchParams.append("userCardIds[]", id));
    return this.request("GET", url.pathname + url.search);
  }

  async searchOffers(userCardId: string, search: string, page: string) {
    return this.request("GET", "v1/user-card/live-offers/search", {
      query: { userCardId, search, page },
    });
  }

  // ── Lounge ─────────────────────────────────────────────────────────

  async getLoungeScreen(userCardId: string) {
    return this.request("GET", "v2/lounge/get", { query: { userCardId } });
  }

  async getLoungeHistory(userCardId: string) {
    return this.request("GET", "v2/lounge/get-history", { query: { userCardId } });
  }

  // ── Gift Cards ─────────────────────────────────────────────────────

  async getGiftCardsHome(filter: string = "", search: string = "", page: string = "1", sort: string = "") {
    return this.request("GET", "v1/gift-cards/home", {
      query: { filter, search, page, sort },
    });
  }

  async getGiftCardDetails(id: number) {
    return this.request("GET", "v1/gift-cards/details", { query: { id } });
  }

  async getGiftCardsRedeem(id: number, fromMyCard: boolean = false) {
    return this.request("GET", "v1/gift-cards/redeem", { query: { id, fromMyCard } });
  }

  async getMyGiftCards() {
    return this.request("GET", "v1/gift-cards/user-gift-cards");
  }

  async initiateGiftCardPayment(data: any) {
    return this.request("POST", "v1/gift-cards/payment-initiate", { body: data });
  }

  async getGiftCardPaymentStatus(data: any) {
    return this.request("POST", "v2/gift-cards/payment-status", { body: data });
  }

  // ── Bill Payments (BBPS) ───────────────────────────────────────────

  async getBbpsCategories() {
    return this.request("GET", "v2/bbps/categories");
  }

  async getBillersByCategory(categoryId: string, page: string = "1") {
    return this.request("GET", "v1/bbps/get-billers-by-category", {
      query: { categoryId, page },
    });
  }

  async getBillerDetails(billerId: string) {
    return this.request("GET", "v1/bbps/get-biller-by-id", { query: { billerId } });
  }

  async searchBiller(categoryId: string, text: string) {
    return this.request("GET", "v1/bbps/search", { query: { categoryId, text } });
  }

  async fetchBill(data: any) {
    return this.request("POST", "v1/bbps/fetching-bill", { body: data });
  }

  async bbpsPaymentInitiate(data: {
    userCardId?: string;
    amount?: string;
    bbpsBillFetchRequestId?: string;
    paymentMode?: string;
  }) {
    return this.request("POST", "v1/bbps/payment-initiate", { body: data, formEncoded: true });
  }

  async getPaymentHistory(params?: Record<string, string>) {
    return this.request("GET", "v1/common-payments/unified-payment-history", { query: params });
  }

  async getPaymentModes(amount: string, bbpsBillFetchRequestId: string, userCardId: string) {
    return this.request("GET", "v2/bbps/payment-mode", {
      query: { amount, bbpsBillFetchRequestId, userCardId },
    });
  }

  // ── Chatbot ────────────────────────────────────────────────────────

  async getChatBotInterface() {
    return this.request("GET", "v1/chatbot/interface");
  }

  async getChatBotPreviousChat(page: string = "1") {
    return this.request("GET", "v1/chatbot/previous-chat", { query: { page } });
  }

  async sendChatBotMessage(sessionId: string, userResponse: string, userResponseType: string) {
    return this.request("POST", "v3/chatbot", {
      body: { sessionId, userResponse, userResponseType },
    });
  }

  async searchChatBotRewards(q: string) {
    return this.request("GET", "v3/chatbot/search", { query: { q } });
  }

  // ── Email Linking ──────────────────────────────────────────────────

  async getLinkedEmails() {
    return this.request("GET", "v3/linked-email/list");
  }

  async getGoogleAuthUrl() {
    return this.request("GET", "auth/google-url");
  }

  async sendGoogleAuthCode(data: any) {
    return this.request("POST", "v2/auth/google-callback", { body: data });
  }

  async getMicrosoftSignIn() {
    return this.request("GET", "auth/microsoft-signin");
  }

  async deleteLinkedEmail(id: number) {
    return this.request("DELETE", "v1/linked-email/delete", { body: { id } });
  }

  // ── Travel / Plan Trip ─────────────────────────────────────────────

  async planTrip(params: {
    type: string;
    from: string;
    to: string;
    destination: string;
    destinationType: string;
    subText?: string;
  }) {
    return this.request("GET", "v3/plan-trip/onboarding", { query: params as any });
  }

  async planTripSearch(key: string, from?: string, to?: string) {
    return this.request("GET", "v2/plan-trip/all-airport", {
      query: { key, ...(from && { from }), ...(to && { to }) },
    });
  }

  async planTripHotelSearch(searchKey: string) {
    return this.request("GET", "v1/plan-trip/hotel-search", { query: { searchKey } });
  }

  async getUserTrips(type: string, tripType: string) {
    return this.request("GET", "v1/plan-trip/user-trips", { query: { type, tripType } });
  }

  async getAllRedemptionFlights(params: {
    from: string;
    to: string;
    date: string;
    passenger: string;
    sortBy: string;
  }) {
    return this.request("GET", "v1/plan-trip/all-redemption", { query: params as any });
  }

  // ── Subscriptions & Plans ──────────────────────────────────────────

  async getPlanDetails(coupon: string = "", planId: number = 0, cashbackSelected: string = "") {
    return this.request("GET", "v5/plan/details", {
      query: { coupon, planId, cashbackSelected },
    });
  }

  async getPayWall(planId: string, fromPaywall: string = "true", cashbackSelected: string = "", coupon: string = "", billingCycle: string = "") {
    return this.request("GET", "v7/plan/details", {
      query: { planId, fromPaywall, cashbackSelected, coupon, billingCycle },
    });
  }

  async getManageSubscription() {
    return this.request("GET", "v1/plan/manage");
  }

  async getFreeTrial() {
    return this.request("GET", "v2/plan/free-trial");
  }

  async startFreeTrial() {
    return this.request("GET", "/payment/free-trial");
  }

  async initiatePayment(data: {
    planId: string;
    amount: string;
    coupon: string;
    useCashback: boolean;
    cashbackAmount: number;
  }) {
    return this.request("POST", "payment/initiate", { body: data, formEncoded: true });
  }

  // ── Referral ───────────────────────────────────────────────────────

  async getReferralData() {
    return this.request("GET", "v4/refer/home");
  }

  // ── My Space / Feed ────────────────────────────────────────────────

  async getMySpace(page: string = "1") {
    return this.request("GET", "v1/my-space/feeds", { query: { page } });
  }

  async getFeedDetails(id: string, newUser: string = "false") {
    return this.request("GET", "v1/my-space/feed", { query: { id, newUser } });
  }

  async getSavedFeeds(page: string = "1") {
    return this.request("GET", "v1/my-space/my-saved-feeds", { query: { page } });
  }

  // ── Wallet ─────────────────────────────────────────────────────────

  async getWalletPage(page: string = "1") {
    return this.request("GET", "v1/cashback/wallet-page", { query: { page } });
  }

  // ── Support ────────────────────────────────────────────────────────

  async getMyQueries(page: string = "1") {
    return this.request("GET", "v1/fetch/user-query", { query: { page } });
  }

  async getReportFeedback(category: string, paymentId: string = "", page: string = "1") {
    return this.request("GET", "v3/report/feedback", {
      query: { category, paymentId, page },
    });
  }

  async getBuddyDetails() {
    return this.request("GET", "buddy");
  }

  // ── Sessions ───────────────────────────────────────────────────────

  async getBookSession(type: string, page: string = "1") {
    return this.request("GET", "v3/book-session/home", { query: { type, page } });
  }

  async getSessionLink() {
    return this.request("GET", "v2/book-session/get-scheduling-link");
  }

  async checkSessionAccess() {
    return this.request("GET", "v1/book-session/check-access");
  }
}

// ─── Usage ───────────────────────────────────────────────────────────────────

async function main() {
  const client = new SaveSageClient();

  // Step 1: Login with phone number (sends OTP)
  const phoneNumber = process.argv[2];
  if (!phoneNumber) {
    console.log("Usage: npx tsx savesage-api.ts <phone_number> [otp]");
    console.log("  First run:  npx tsx savesage-api.ts 9876543210");
    console.log("  Second run: npx tsx savesage-api.ts 9876543210 123456");
    console.log("");
    console.log("Or set SAVESAGE_TOKEN env var to skip auth:");
    console.log("  SAVESAGE_TOKEN=xxx npx tsx savesage-api.ts");

    if (process.env.SAVESAGE_TOKEN) {
      client.setToken(process.env.SAVESAGE_TOKEN);
      console.log("\n--- Using SAVESAGE_TOKEN ---\n");
      const home = await client.getHomeScreen();
      console.log(JSON.stringify(home, null, 2));
    }
    return;
  }

  const otp = process.argv[3];

  if (!otp) {
    // Send OTP
    console.log(`\nSending OTP to ${phoneNumber}...`);
    const loginRes = await client.login(phoneNumber);
    console.log("Login response:", JSON.stringify(loginRes, null, 2));
    console.log(`\nNow run: npx tsx savesage-api.ts ${phoneNumber} <OTP>`);
  } else {
    // Verify OTP
    console.log(`\nVerifying OTP for ${phoneNumber}...`);
    const verifyRes = await client.verifyOtp(phoneNumber, otp);
    console.log("Verify response:", JSON.stringify(verifyRes, null, 2));

    // Now make authenticated calls
    console.log("\n--- Fetching Home Screen ---");
    const home = await client.getHomeScreen();
    console.log(JSON.stringify(home, null, 2));
  }
}

main().catch(console.error);

export { SaveSageClient };
