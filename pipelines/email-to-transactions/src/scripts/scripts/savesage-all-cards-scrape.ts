/**
 * SaveSage ALL Cards Scraper
 * Extracts all 627 cardIds from bank-card-list, then fetches:
 * - card-info (fees, features, eligibility)
 * - card-benefits for each type: earn, benefit, lounge, redeem
 */

import { SaveSageClient } from "./savesage-api";
import * as fs from "fs";
import * as path from "path";

const OUTPUT_DIR = path.join(__dirname, "../../../output/savesage-data");
const client = new SaveSageClient();

const token = process.env.SAVESAGE_TOKEN;
if (!token) { console.error("Set SAVESAGE_TOKEN"); process.exit(1); }
client.setToken(token);

async function api(method: string, endpoint: string, opts: any = {}) {
  return (client as any).request(method, endpoint, opts);
}

async function safeApi(method: string, endpoint: string, opts: any = {}): Promise<any> {
  try {
    return await api(method, endpoint, opts);
  } catch { return null; }
}

function save(name: string, data: any) {
  fs.writeFileSync(path.join(OUTPUT_DIR, `${name}.json`), JSON.stringify(data, null, 2));
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // ── Step 1: Extract ALL cardIds from bank-card-list ──────────────
  const bankListPath = path.join(OUTPUT_DIR, "bank-card-list-full.json");
  let bankList: any;

  if (fs.existsSync(bankListPath)) {
    bankList = JSON.parse(fs.readFileSync(bankListPath, "utf8"));
  } else {
    console.log("Fetching bank card list...");
    bankList = await api("GET", "v3/card/get-list");
    save("bank-card-list-full", bankList);
  }

  const allCards: { cardId: number; name: string; bank: string; imageUrl: string }[] = [];
  const cards = bankList.cards;

  for (const [bank, bankData] of Object.entries(cards) as any) {
    const top = bankData.topCards?.items || [];
    const left = bankData.leftCards?.items || [];
    for (const c of [...top, ...left]) {
      allCards.push({ cardId: c.cardId, name: c.name, bank, imageUrl: c.imageUrl || "" });
    }
  }

  save("ALL-CARDS-MASTER-LIST", allCards);
  console.log(`Total cards to scrape: ${allCards.length}\n`);

  // ── Step 2: Fetch card-info for every card ───────────────────────
  console.log("=== Fetching card-info ===\n");

  const allCardInfo: any[] = [];
  const failedInfo: number[] = [];

  for (let i = 0; i < allCards.length; i++) {
    const card = allCards[i];
    const cardId = String(card.cardId);

    // v1 works for ALL cards, v3 only works for recommended cards
    const info = await safeApi("GET", "v1/card-recommendation/card-info", { query: { cardId } });
    if (info) {
      allCardInfo.push({ ...card, info });
    } else {
      failedInfo.push(card.cardId);
    }

    if ((i + 1) % 50 === 0) {
      console.log(`  card-info: ${i + 1}/${allCards.length} (${allCardInfo.length} ok, ${failedInfo.length} failed)`);
      save("ALL-CARD-INFO-FULL", allCardInfo);
    }

    await new Promise(r => setTimeout(r, 40));
  }

  save("ALL-CARD-INFO-FULL", allCardInfo);
  console.log(`\n  card-info done: ${allCardInfo.length} ok, ${failedInfo.length} failed\n`);

  // ── Step 3: Fetch card-benefits (earn/benefit/lounge/redeem) ─────
  console.log("=== Fetching card-benefits ===\n");

  const benefitTypes = ["earn", "benefit", "lounge", "redeem"];
  const allBenefits: any[] = [];

  for (let i = 0; i < allCards.length; i++) {
    const card = allCards[i];
    const cardId = String(card.cardId);
    const cardBenefits: any = { ...card, benefits: {} };

    for (const type of benefitTypes) {
      const res = await safeApi("GET", "v1/card-recommendation/card-benefit", {
        query: { cardId, type }
      });
      if (res) {
        cardBenefits.benefits[type] = res;
      }
      await new Promise(r => setTimeout(r, 25));
    }

    allBenefits.push(cardBenefits);

    if ((i + 1) % 50 === 0) {
      console.log(`  benefits: ${i + 1}/${allCards.length}`);
      save("ALL-CARD-BENEFITS-FULL-V2", allBenefits);
    }
  }

  save("ALL-CARD-BENEFITS-FULL-V2", allBenefits);
  console.log(`\n  benefits done: ${allBenefits.length} cards\n`);

  // ── Step 4: Loyalty Programs ─────────────────────────────────────
  console.log("=== Fetching loyalty programs ===\n");

  const flightLP = await safeApi("GET", "v4/loyalty-program/getlist", { query: { type: "flight" } });
  const hotelLP = await safeApi("GET", "v4/loyalty-program/getlist", { query: { type: "hotels" } });
  save("LOYALTY-PROGRAMS-FLIGHT", flightLP);
  save("LOYALTY-PROGRAMS-HOTELS", hotelLP);

  // User's loyalty programs
  const userFlightLP = await safeApi("GET", "v3/user/loyalty-program", { query: { type: "flight" } });
  const userHotelLP = await safeApi("GET", "v3/user/loyalty-program", { query: { type: "hotels" } });
  save("USER-LOYALTY-FLIGHT", userFlightLP);
  save("USER-LOYALTY-HOTELS", userHotelLP);

  console.log(`  Flight programs: ${JSON.stringify(flightLP).length} bytes`);
  console.log(`  Hotel programs: ${JSON.stringify(hotelLP).length} bytes\n`);

  // ── Step 5: Card Recommendation Algo Data ──────────────────────
  console.log("=== Card recommendation algo ===\n");

  const crData: any = {};
  crData.modeSelection = await safeApi("GET", "v3/card-recommendation/mode-selection");
  crData.preferredRewards = await safeApi("GET", "v1/cr/preferred-reward");
  crData.lifestylePreference = await safeApi("GET", "v1/cr/lifestyle-preference");
  crData.incomeSalaried = await safeApi("GET", "v1/cr/income-profile", { query: { type: "Salaried" } });
  crData.incomeBusiness = await safeApi("GET", "v1/cr/income-profile", { query: { type: "Business" } });
  crData.expenseCategory = await safeApi("GET", "v1/cr/expense-category");
  crData.manualQuestions = await safeApi("GET", "v1/card-recommendation/questions/manual");
  crData.onboardingManual = await safeApi("GET", "v2/card-recommendation/questions", { query: { type: "manual" } });
  crData.onboardingEmail = await safeApi("GET", "v2/card-recommendation/questions", { query: { type: "email" } });
  crData.onboardingSms = await safeApi("GET", "v2/card-recommendation/questions", { query: { type: "sms" } });
  crData.resultV4 = await safeApi("GET", "v4/card-recommendation/result");
  crData.polling = await safeApi("GET", "v2/card-recommendation/polling");
  crData.portfolio = await safeApi("GET", "v1/cr/card-portfolio");
  save("CARD-RECOMMENDATION-ALGO-DATA", crData);
  console.log("  Saved recommendation engine data\n");

  // ── Summary ──────────────────────────────────────────────────────
  console.log("=".repeat(60));
  console.log("ALL CARDS SCRAPE COMPLETE");
  console.log("=".repeat(60));
  console.log(`Cards in database: ${allCards.length}`);
  console.log(`Card info fetched: ${allCardInfo.length}`);
  console.log(`Card benefits fetched: ${allBenefits.length}`);
  console.log(`Output: ${OUTPUT_DIR}`);
}

main().catch(console.error);
