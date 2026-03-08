/**
 * Deep scrape ALL credit cards from SaveSage
 * - Gets full card list from search-by-bank
 * - Gets card-info for every card
 * - Gets card-benefits (earn/benefit/lounge/redeem) for every card
 * - Gets loyalty program data
 * - Gets recommendation questionnaire flow
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

async function safeApi(method: string, endpoint: string, opts: any = {}): Promise<any> {
  try {
    return await api(method, endpoint, opts);
  } catch { return null; }
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // ══════════════════════════════════════════════════════════════
  // 1. Get ALL cards from bank search
  // ══════════════════════════════════════════════════════════════
  console.log("=== Getting full card database ===\n");

  const banks = [
    "HDFC", "ICICI", "SBI", "Axis", "Kotak", "Yes Bank", "RBL", "Amex",
    "IndusInd", "BOB", "SC", "Indian", "PNB", "IDFC", "Canara", "HSBC",
    "DBS", "IDBI", "AU", "Equitas", "CSB", "Federal", "SBM", "South Indian",
    "Utkarsh", "Suryoday Bank", "Union Bank", "Unity SFB", "DCB",
    "Bank Of India", "J&K Bank", "CUB", "Slice SFB"
  ];

  // First get all cards from the bank card list endpoint
  const bankCardList = await safeApi("GET", "v3/card/get-list");
  if (bankCardList) save("bank-card-list-full", bankCardList);

  // Collect all unique cardIds from search
  const allCardMap = new Map<number, any>();

  for (const bank of banks) {
    const res = await safeApi("GET", "v1/user-card/search", { query: { key: bank } });
    if (res?.items && Array.isArray(res.items)) {
      for (const card of res.items) {
        if (card.cardId && !allCardMap.has(card.cardId)) {
          allCardMap.set(card.cardId, { ...card, searchBank: bank });
        }
      }
      console.log(`  ${bank}: ${res.items.length} cards (unique total: ${allCardMap.size})`);
    }
  }

  const allCards = Array.from(allCardMap.values());
  save("ALL-CARDS-DATABASE", allCards);
  console.log(`\n  Total unique cards: ${allCards.length}\n`);

  // ══════════════════════════════════════════════════════════════
  // 2. Get card-info for every card
  // ══════════════════════════════════════════════════════════════
  console.log("=== Getting card info for all cards ===\n");

  const allCardInfo: any[] = [];
  let infoCount = 0;

  for (const card of allCards) {
    const cardId = String(card.cardId);
    const info = await safeApi("GET", "v3/card-recommendation/card-info", { query: { cardId } });
    if (info) {
      allCardInfo.push({
        cardId: card.cardId,
        bankName: card.bankName,
        cardName: card.cardName,
        ...info
      });
      infoCount++;
    }
    if (infoCount % 20 === 0) {
      console.log(`  Progress: ${infoCount}/${allCards.length}`);
      // Save incrementally
      save("ALL-CARD-INFO", allCardInfo);
    }
    await new Promise(r => setTimeout(r, 50));
  }

  save("ALL-CARD-INFO", allCardInfo);
  console.log(`  Got info for ${allCardInfo.length} cards\n`);

  // ══════════════════════════════════════════════════════════════
  // 3. Get card benefits (earn, benefit, lounge, redeem) for all
  // ══════════════════════════════════════════════════════════════
  console.log("=== Getting card benefits ===\n");

  const allBenefits: any[] = [];
  let benefitCount = 0;

  for (const card of allCards) {
    const cardId = String(card.cardId);
    const cardBenefits: any = {
      cardId: card.cardId,
      bankName: card.bankName,
      cardName: card.cardName,
    };

    for (const type of ["earn", "benefit", "lounge", "redeem"]) {
      const res = await safeApi("GET", "v1/card-recommendation/card-benefit", {
        query: { cardId, type }
      });
      if (res) {
        cardBenefits[type] = res;
      }
      await new Promise(r => setTimeout(r, 30));
    }

    allBenefits.push(cardBenefits);
    benefitCount++;

    if (benefitCount % 20 === 0) {
      console.log(`  Progress: ${benefitCount}/${allCards.length}`);
      save("ALL-CARD-BENEFITS-FULL", allBenefits);
    }
  }

  save("ALL-CARD-BENEFITS-FULL", allBenefits);
  console.log(`  Got benefits for ${allBenefits.length} cards\n`);

  // ══════════════════════════════════════════════════════════════
  // 4. Loyalty Programs - complete list with details
  // ══════════════════════════════════════════════════════════════
  console.log("=== Loyalty Programs ===\n");

  const flightLP = await safeApi("GET", "v4/loyalty-program/getlist", { query: { type: "flight" } });
  const hotelLP = await safeApi("GET", "v4/loyalty-program/getlist", { query: { type: "hotels" } });

  save("LOYALTY-PROGRAMS-FLIGHT", flightLP);
  save("LOYALTY-PROGRAMS-HOTELS", hotelLP);

  const allLP: any[] = [];
  for (const src of [flightLP, hotelLP]) {
    if (!src) continue;
    // Try different response shapes
    const items = src?.data || src?.loyaltyPrograms || src?.items || [];
    if (Array.isArray(items)) allLP.push(...items);
  }
  save("ALL-LOYALTY-PROGRAMS", allLP);
  console.log(`  Total loyalty programs: ${allLP.length}`);

  // ══════════════════════════════════════════════════════════════
  // 5. Card Recommendation Questionnaire (for reverse engineering)
  // ══════════════════════════════════════════════════════════════
  console.log("\n=== Card Recommendation Algo Data ===\n");

  const crData: any = {};

  crData.modeSelection = await safeApi("GET", "v3/card-recommendation/mode-selection");
  crData.preferredRewards = await safeApi("GET", "v1/cr/preferred-reward");
  crData.lifestylePreference = await safeApi("GET", "v1/cr/lifestyle-preference");
  crData.incomeSalaried = await safeApi("GET", "v1/cr/income-profile", { query: { type: "Salaried" } });
  crData.incomeBusiness = await safeApi("GET", "v1/cr/income-profile", { query: { type: "Business" } });
  crData.expenseCategory = await safeApi("GET", "v1/cr/expense-category");
  crData.onboardingManual = await safeApi("GET", "v2/card-recommendation/questions", { query: { type: "manual" } });
  crData.onboardingAutoFetch = await safeApi("GET", "v2/card-recommendation/questions", { query: { type: "auto-fetch" } });
  crData.manualQuestions = await safeApi("GET", "v1/card-recommendation/questions/manual");
  crData.result = await safeApi("GET", "v4/card-recommendation/result");
  crData.polling = await safeApi("GET", "v2/card-recommendation/polling");
  crData.portfolio = await safeApi("GET", "v1/cr/card-portfolio");

  save("CARD-RECOMMENDATION-ALGO-DATA", crData);

  console.log("  Saved complete recommendation engine data");

  // ══════════════════════════════════════════════════════════════
  // Summary
  // ══════════════════════════════════════════════════════════════
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith(".json"));
  const totalSize = files.reduce((sum, f) => sum + fs.statSync(path.join(OUTPUT_DIR, f)).size, 0);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`DEEP SCRAPE COMPLETE`);
  console.log(`${"=".repeat(60)}`);
  console.log(`📁 ${files.length} files, ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`🃏 ${allCards.length} unique credit cards in database`);
  console.log(`📊 ${allCardInfo.length} card info pages`);
  console.log(`🎁 ${allBenefits.length} card benefit sets (earn/benefit/lounge/redeem)`);
  console.log(`✈️  ${allLP.length} loyalty programs`);
  console.log(`🧠 Card recommendation engine data saved`);
  console.log(`📂 ${OUTPUT_DIR}`);
}

main().catch(console.error);
