/**
 * SaveSage Deep Scraper - Credit Cards, Recommendations, Loyalty Programs
 */

import { SaveSageClient } from "./savesage-api";
import * as fs from "fs";
import * as path from "path";

const OUTPUT_DIR = path.join(__dirname, "../../../output/savesage-data");
const client = new SaveSageClient();

const token = process.env.SAVESAGE_TOKEN;
if (!token) { console.error("Set SAVESAGE_TOKEN"); process.exit(1); }
client.setToken(token);

function save(name: string, data: any) {
  fs.writeFileSync(path.join(OUTPUT_DIR, `${name}.json`), JSON.stringify(data, null, 2));
}

async function api(method: string, endpoint: string, opts: any = {}) {
  return (client as any).request(method, endpoint, opts);
}

async function safeApi(label: string, method: string, endpoint: string, opts: any = {}): Promise<any> {
  try {
    const r = await api(method, endpoint, opts);
    save(label, r);
    return r;
  } catch (e: any) {
    console.error(`  ✗ ${label}: ${e.message}`);
    return null;
  }
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // ══════════════════════════════════════════════════════════════════
  // 1. ALL CREDIT CARDS - paginate through all pages
  // ══════════════════════════════════════════════════════════════════
  console.log("\n=== All Credit Cards (paginated) ===\n");

  const allCards: any[] = [];
  let page = 1;
  while (true) {
    const res = await safeApi(`all-cards-page-${page}`, "GET", "v1/cr/all-cards", { query: { page } });
    if (!res || !res.items || res.items.length === 0) break;
    allCards.push(...res.items);
    console.log(`  Page ${page}: ${res.items.length} cards (total: ${allCards.length})`);
    if (!res.hasNextPage) break;
    page++;
  }
  save("ALL-CARDS-COMPLETE", allCards);
  console.log(`\n  Total cards: ${allCards.length}`);

  // ══════════════════════════════════════════════════════════════════
  // 2. CARD INFO + BENEFITS for every card
  // ══════════════════════════════════════════════════════════════════
  console.log("\n=== Card Details & Benefits ===\n");

  const cardDetails: any[] = [];
  const cardBenefits: any[] = [];

  for (const card of allCards) {
    const cardId = String(card.cardId);
    process.stdout.write(`  ${card.bankName} ${card.cardName} (${cardId})...`);

    const info = await safeApi(`card-info-${cardId}`, "GET", "v3/card-recommendation/card-info", { query: { cardId } });
    if (info) {
      cardDetails.push({ cardId, bankName: card.bankName, cardName: card.cardName, ...info });
    }

    const benefits = await safeApi(`card-benefits-${cardId}`, "GET", "v1/card-recommendation/card-benefit", { query: { cardId } });
    if (benefits) {
      cardBenefits.push({ cardId, bankName: card.bankName, cardName: card.cardName, ...benefits });
    }

    console.log(` ${info ? '✓info' : '✗'} ${benefits ? '✓benefits' : '✗'}`);

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  save("ALL-CARD-DETAILS", cardDetails);
  save("ALL-CARD-BENEFITS", cardBenefits);
  console.log(`\n  ${cardDetails.length} card details, ${cardBenefits.length} card benefits`);

  // ══════════════════════════════════════════════════════════════════
  // 3. CARD RECOMMENDATION ENGINE - full flow
  // ══════════════════════════════════════════════════════════════════
  console.log("\n=== Card Recommendation Engine ===\n");

  // Step 1: Mode selection
  await safeApi("cr-mode-selection", "GET", "v3/card-recommendation/mode-selection");

  // Step 2: Preferred rewards screen
  const rewards = await safeApi("cr-step1-preferred-rewards", "GET", "v1/cr/preferred-reward");

  // Step 3: Lifestyle preferences
  const lifestyle = await safeApi("cr-step2-lifestyle", "GET", "v1/cr/lifestyle-preference");

  // Step 4: Income profile
  await safeApi("cr-step3-income-salaried", "GET", "v1/cr/income-profile", { query: { type: "Salaried" } });
  await safeApi("cr-step3-income-business", "GET", "v1/cr/income-profile", { query: { type: "Business" } });

  // Step 5: Expense categories
  const expenses = await safeApi("cr-step4-expense-category", "GET", "v1/cr/expense-category");

  // Step 6: Onboarding questions (v2)
  await safeApi("cr-onboarding-questions-email", "GET", "v2/card-recommendation/questions", { query: { type: "email" } });
  await safeApi("cr-onboarding-questions-manual", "GET", "v2/card-recommendation/questions", { query: { type: "manual" } });
  await safeApi("cr-onboarding-questions-sms", "GET", "v2/card-recommendation/questions", { query: { type: "sms" } });

  // Step 7: Manual questions
  await safeApi("cr-manual-questions", "GET", "v1/card-recommendation/questions/manual");

  // Step 8: Results
  await safeApi("cr-result-v3", "GET", "v3/card-recommendation/result", { query: { type: "", category: "" } });
  await safeApi("cr-result-v4", "GET", "v4/card-recommendation/result");

  // Step 9: Polling
  await safeApi("cr-polling", "GET", "v2/card-recommendation/polling");

  // Step 10: Card portfolio
  await safeApi("cr-portfolio", "GET", "v1/cr/card-portfolio");

  // Step 11: All cards with comparison
  await safeApi("cr-comparison", "GET", "v1/cr/card-comparison");

  // Step 12: User response endpoint (GET to see structure)
  await safeApi("cr-user-response", "GET", "v1/cr/user-response");

  // ══════════════════════════════════════════════════════════════════
  // 4. LOYALTY PROGRAMS - complete data
  // ══════════════════════════════════════════════════════════════════
  console.log("\n=== Loyalty Programs ===\n");

  // All loyalty programs the user can add
  const flightLP = await safeApi("loyalty-list-flight", "GET", "v4/loyalty-program/getlist", { query: { type: "flight" } });
  const hotelLP = await safeApi("loyalty-list-hotels", "GET", "v4/loyalty-program/getlist", { query: { type: "hotels" } });

  // User's loyalty programs
  const userFlightLP = await safeApi("user-loyalty-flight", "GET", "v3/user/loyalty-program", { query: { type: "flight" } });
  const userHotelLP = await safeApi("user-loyalty-hotels", "GET", "v3/user/loyalty-program", { query: { type: "hotels" } });

  // Combine all loyalty program data
  const allLoyaltyPrograms: any[] = [];

  for (const source of [flightLP, hotelLP]) {
    if (!source) continue;
    const items = source?.data?.loyaltyPrograms || source?.loyaltyPrograms || source?.data || [];
    if (Array.isArray(items)) {
      allLoyaltyPrograms.push(...items);
    }
  }
  save("ALL-LOYALTY-PROGRAMS", allLoyaltyPrograms);
  console.log(`  Total loyalty programs available: ${allLoyaltyPrograms.length}`);

  // Get details for user's loyalty programs
  const userLPIds: string[] = [];
  for (const source of [userFlightLP, userHotelLP]) {
    if (!source) continue;
    const items = source?.data?.userLoyaltyPrograms || source?.userLoyaltyPrograms || source?.data || [];
    if (Array.isArray(items)) {
      for (const lp of items) {
        const id = lp.userLoyaltyProgramId || lp.id;
        if (id) userLPIds.push(String(id));
      }
    }
  }

  for (const lpId of userLPIds) {
    console.log(`  User LP ${lpId}:`);
    await safeApi(`user-lp-${lpId}-details`, "GET", "v4/user-loyalty-program/get", { query: { userLoyaltyProgramId: lpId } });
    await safeApi(`user-lp-${lpId}-earn`, "GET", "v3/user-loyalty-program/earn", { query: { userLoyaltyProgramId: lpId } });
    await safeApi(`user-lp-${lpId}-redeem`, "GET", "v3/user-loyalty-program/redeem", { query: { userLoyaltyProgramId: lpId } });
    await safeApi(`user-lp-${lpId}-transfer-in`, "GET", "v4/user-loyalty-program/transfer-in", { query: { userLoyaltyProgramId: lpId } });
    await safeApi(`user-lp-${lpId}-transfer-out`, "GET", "v3/user-loyalty-program/transfer-out", { query: { userLoyaltyProgramId: lpId } });
    await safeApi(`user-lp-${lpId}-charges`, "GET", "v1/user-loyalty-program/charges", { query: { userLoyaltyProgramId: lpId } });
    await safeApi(`user-lp-${lpId}-tiers`, "GET", "v2/user-loyalty-program/tier-list", { query: { userLoyaltyProgramId: lpId } });
    await safeApi(`user-lp-${lpId}-transfer-option`, "GET", "v1/user-loyalty-program/transfer-option/get", { query: { userLoyaltyProgramId: lpId } });
  }

  // ══════════════════════════════════════════════════════════════════
  // 5. AVAILABLE CARDS - bank-wise card lists
  // ══════════════════════════════════════════════════════════════════
  console.log("\n=== Bank Card Lists ===\n");

  const banksRes = await safeApi("bank-card-list", "GET", "v3/card/get-list");
  // Extract all banks
  const allBanks: string[] = [];
  if (banksRes) {
    const topBanks = banksRes?.bank?.topBanks?.items || [];
    const otherBanks = banksRes?.bank?.leftBanks?.items || [];
    for (const b of [...topBanks, ...otherBanks]) {
      if (b.name) allBanks.push(b.name);
    }
  }
  console.log(`  Banks: ${allBanks.join(", ")}`);

  // ══════════════════════════════════════════════════════════════════
  // 6. SEARCH ALL CARDS
  // ══════════════════════════════════════════════════════════════════
  console.log("\n=== Search Cards ===\n");

  // Search with empty string to get all searchable cards
  await safeApi("search-all-cards", "GET", "v1/user-card/search", { query: { key: "" } });

  // Search by popular bank names
  for (const bank of ["HDFC", "ICICI", "SBI", "Axis", "Kotak", "Amex", "RBL", "IndusInd", "IDFC", "Yes Bank", "SC", "HSBC", "AU", "BOB"]) {
    await safeApi(`search-cards-${bank.toLowerCase().replace(/\s+/g, "-")}`, "GET", "v1/user-card/search", { query: { key: bank } });
  }

  // ══════════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════════
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith(".json"));
  const totalSize = files.reduce((sum, f) => sum + fs.statSync(path.join(OUTPUT_DIR, f)).size, 0);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`SCRAPE COMPLETE`);
  console.log(`${"=".repeat(60)}`);
  console.log(`📁 ${files.length} files`);
  console.log(`💾 ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`🃏 ${allCards.length} credit cards scraped`);
  console.log(`📊 ${cardDetails.length} card detail pages`);
  console.log(`🎁 ${cardBenefits.length} card benefit pages`);
  console.log(`✈️  ${allLoyaltyPrograms.length} loyalty programs`);
  console.log(`📂 ${OUTPUT_DIR}`);
}

main().catch(console.error);
