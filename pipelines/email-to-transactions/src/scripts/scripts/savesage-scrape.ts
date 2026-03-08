/**
 * SaveSage Full Data Scraper
 * Calls all API endpoints and saves responses locally
 */

import { SaveSageClient } from "./savesage-api";
import * as fs from "fs";
import * as path from "path";

const OUTPUT_DIR = path.join(__dirname, "../../../output/savesage-data");

function save(name: string, data: any) {
  const filePath = path.join(OUTPUT_DIR, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`  💾 Saved ${name}.json`);
}

async function safeCall<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    const result = await fn();
    save(label, result);
    return result;
  } catch (e: any) {
    console.error(`  ✗ ${label}: ${e.message}`);
    save(`${label}__error`, { error: e.message });
    return null;
  }
}

async function main() {
  const token = process.env.SAVESAGE_TOKEN;
  if (!token) {
    console.error("Set SAVESAGE_TOKEN env var");
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const client = new SaveSageClient();
  client.setToken(token);

  // ── Phase 1: Top-level endpoints (no params needed) ─────────────

  console.log("\n=== Phase 1: Core Data ===\n");

  const home = await safeCall("home-screen", () => client.getHomeScreen());
  const menu = await safeCall("menu-screen", () => client.getMenuScreen());
  const profile = await safeCall("user-profile", () => client.getUserProfile());
  const status = await safeCall("user-status", () => client.getUserStatus());
  const settings = await safeCall("user-settings", () => client.getUserSettings());
  const config = await safeCall("config", () => client.getConfig());
  const pending = await safeCall("pending-actions", () => client.getPendingActions());
  const polling = await safeCall("home-polling", () => client.getHomePagePolling());

  console.log("\n=== Phase 2: Cards ===\n");

  const cards = await safeCall("credit-cards", () => client.getCreditCards());
  const myCards = await safeCall("my-cards", () => client.getMyCards());
  const addCards = await safeCall("available-cards", () => client.addUserCard());
  const unmapped = await safeCall("unmapped-cards", () => client.getUnmappedCards());
  const duesOverview = await safeCall("dues-overview", () => client.getDuesOverview());
  const unbilledOverview = await safeCall("unbilled-overview", () => client.getUnbilledOverview());
  const rewardOverview = await safeCall("reward-overview", () => client.getRewardOverview());

  // Extract userCardIds from cards response for per-card calls
  const userCardIds: string[] = [];
  try {
    const cardData = cards?.data?.userCards || cards?.userCards || cards?.data || [];
    const cardList = Array.isArray(cardData) ? cardData : [];
    for (const c of cardList) {
      const id = c.userCardId || c.id || c._id;
      if (id) userCardIds.push(String(id));
    }
    console.log(`  Found ${userCardIds.length} user cards`);
  } catch {}

  console.log("\n=== Phase 3: Per-Card Data ===\n");

  for (const ucId of userCardIds) {
    console.log(`  Card ${ucId}:`);
    await safeCall(`card-${ucId}-rewards`, () => client.getRewardPoints(ucId));
    await safeCall(`card-${ucId}-benefits`, () => client.getRewardsBenefits(ucId));
    await safeCall(`card-${ucId}-settings`, () => client.getCardSettings(ucId));
    await safeCall(`card-${ucId}-key-charges`, () => client.getKeyCharges(ucId));
    await safeCall(`card-${ucId}-statement`, () => client.getViewStatement(ucId));
    await safeCall(`card-${ucId}-transactions`, () => client.getTransactionHistory(ucId));
    await safeCall(`card-${ucId}-offers`, () => client.getUserCardOffers(ucId));
    await safeCall(`card-${ucId}-lounge`, () => client.getLoungeScreen(ucId));
    await safeCall(`card-${ucId}-lounge-history`, () => client.getLoungeHistory(ucId));
    await safeCall(`card-${ucId}-annual-cycle`, () => client.getAnnualBillCycle(ucId));
    await safeCall(`card-${ucId}-milestones`, () => client.getMilestones("", ucId, ""));
    await safeCall(`card-${ucId}-redemption`, () => client.getRedemptionData(ucId, ""));
    await safeCall(`card-${ucId}-vouchers`, () => client.getVouchers(ucId, ""));
  }

  console.log("\n=== Phase 4: Spending Analysis ===\n");

  for (const type of ["monthly", "yearly"]) {
    await safeCall(`spend-analysis-${type}`, () => client.getSpendAnalysis(type, "true"));
  }

  console.log("\n=== Phase 5: Loyalty Programs ===\n");

  const loyalty = await safeCall("loyalty-programs", () => client.getLoyaltyPrograms("all"));
  const loyaltyList = await safeCall("loyalty-program-list", () => client.getLoyaltyProgramList("all"));

  // Extract loyalty program IDs
  const loyaltyIds: string[] = [];
  try {
    const lpData = loyalty?.data?.loyaltyPrograms || loyalty?.data || [];
    const lpList = Array.isArray(lpData) ? lpData : [];
    for (const lp of lpList) {
      const id = lp.userLoyaltyProgramId || lp.id || lp._id;
      if (id) loyaltyIds.push(String(id));
    }
    console.log(`  Found ${loyaltyIds.length} loyalty programs`);
  } catch {}

  for (const lpId of loyaltyIds) {
    console.log(`  Loyalty Program ${lpId}:`);
    await safeCall(`loyalty-${lpId}-details`, () => client.getLoyaltyProgramDetails(lpId));
    await safeCall(`loyalty-${lpId}-charges`, () => client.getLoyaltyProgramCharges(lpId));
    await safeCall(`loyalty-${lpId}-earn`, () => client.getEarnData(lpId));
    await safeCall(`loyalty-${lpId}-redeem`, () => client.getRedeemData(lpId));
    await safeCall(`loyalty-${lpId}-transfer-in`, () => client.getTransferIn(lpId));
    await safeCall(`loyalty-${lpId}-transfer-out`, () => client.getTransferOut(lpId));
    await safeCall(`loyalty-${lpId}-transfer-option`, () => client.getCheckTransferOption(lpId));
    await safeCall(`loyalty-${lpId}-tier-benefits`, () => client.getTierBenefits(lpId));
  }

  console.log("\n=== Phase 6: Credit Score ===\n");

  await safeCall("credit-score-landing", () => client.getCreditScoreLanding());
  await safeCall("credit-score-faq", () => client.getCreditScoreFaq());
  await safeCall("credit-score-guide", () => client.getCreditScoreGuide());

  console.log("\n=== Phase 7: Card Recommendations ===\n");

  await safeCall("recommendations", () => client.getRecommendations());
  await safeCall("recommendation-mode", () => client.getRecommendationModeSelection());
  await safeCall("preferred-rewards", () => client.getPreferredRewards());
  await safeCall("lifestyle-preference", () => client.getLifestylePreference());
  await safeCall("expense-category", () => client.getExpenseCategory());
  await safeCall("card-portfolio", () => client.getCardPortfolio());
  await safeCall("portfolio-comparison", () => client.getPortfolioComparison());
  await safeCall("all-cards-page-1", () => client.getAllCards(1));
  await safeCall("all-cards-page-2", () => client.getAllCards(2));
  await safeCall("recommendation-polling", () => client.getCardRecommendationPolling());

  console.log("\n=== Phase 8: Gift Cards ===\n");

  const giftCards = await safeCall("gift-cards-home", () => client.getGiftCardsHome());
  await safeCall("my-gift-cards", () => client.getMyGiftCards());

  // Get details for gift cards
  try {
    const gcList = giftCards?.data?.giftCards || giftCards?.data || [];
    const gcArray = Array.isArray(gcList) ? gcList : [];
    for (const gc of gcArray.slice(0, 20)) {
      const gcId = gc.id || gc._id;
      if (gcId) {
        await safeCall(`gift-card-${gcId}-details`, () => client.getGiftCardDetails(gcId));
        await safeCall(`gift-card-${gcId}-redeem`, () => client.getGiftCardsRedeem(gcId));
      }
    }
  } catch {}

  console.log("\n=== Phase 9: Bill Payments ===\n");

  await safeCall("bbps-categories", () => client.getBbpsCategories());
  await safeCall("payment-history", () => client.getPaymentHistory());

  console.log("\n=== Phase 10: Chatbot ===\n");

  await safeCall("chatbot-interface", () => client.getChatBotInterface());
  await safeCall("chatbot-previous-chat", () => client.getChatBotPreviousChat());

  console.log("\n=== Phase 11: Email & Accounts ===\n");

  await safeCall("linked-emails", () => client.getLinkedEmails());
  await safeCall("google-auth-url", () => client.getGoogleAuthUrl());

  console.log("\n=== Phase 12: Subscriptions & Plans ===\n");

  await safeCall("manage-subscription", () => client.getManageSubscription());
  await safeCall("free-trial", () => client.getFreeTrial());
  await safeCall("plan-details", () => client.getPlanDetails());

  console.log("\n=== Phase 13: Other ===\n");

  await safeCall("referral", () => client.getReferralData());
  await safeCall("my-space-page-1", () => client.getMySpace("1"));
  await safeCall("saved-feeds", () => client.getSavedFeeds());
  await safeCall("wallet", () => client.getWalletPage());
  await safeCall("my-queries", () => client.getMyQueries());
  await safeCall("buddy-details", () => client.getBuddyDetails());
  await safeCall("session-link", () => client.getSessionLink());
  await safeCall("search-card-all", () => client.searchCard(""));

  // ── Summary ─────────────────────────────────────────────────────

  const files = fs.readdirSync(OUTPUT_DIR).filter((f) => f.endsWith(".json"));
  const errors = files.filter((f) => f.includes("__error"));
  console.log(`\n=== Done ===`);
  console.log(`📁 ${files.length} files saved to ${OUTPUT_DIR}`);
  console.log(`✓ ${files.length - errors.length} successful, ✗ ${errors.length} errors`);
}

main().catch(console.error);
