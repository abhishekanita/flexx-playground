import { SaveSageClient } from "./savesage-api";
import * as fs from "fs";

const dir = "output/savesage-data";
const client = new SaveSageClient();
const token = process.env.SAVESAGE_TOKEN;
if (!token) { console.error("Set SAVESAGE_TOKEN"); process.exit(1); }
client.setToken(token);

async function save(name: string, fn: () => Promise<any>) {
  try {
    const r = await fn();
    fs.writeFileSync(`${dir}/${name}.json`, JSON.stringify(r, null, 2));
    console.log("✓", name);
  } catch (e: any) { console.log("✗", name, e.message); }
}

async function main() {
  // Fix credit cards with correct sortBy
  await save("credit-cards-reward", () => (client as any).request("GET", "v10/user-card/overview", { query: { sortBy: "reward_point" } }));
  await save("credit-cards-due-date", () => (client as any).request("GET", "v10/user-card/overview", { query: { sortBy: "due_date" } }));

  // Fix loyalty programs with correct type
  await save("loyalty-programs-flight", () => client.getLoyaltyPrograms("flight"));
  await save("loyalty-programs-hotels", () => client.getLoyaltyPrograms("hotels"));
  await save("loyalty-program-list-flight", () => client.getLoyaltyProgramList("flight"));
  await save("loyalty-program-list-hotels", () => client.getLoyaltyProgramList("hotels"));

  // Gift card details
  try {
    const gc = JSON.parse(fs.readFileSync(`${dir}/gift-cards-home.json`, "utf8"));
    const cards = gc?.data?.giftCards || gc?.giftCards || [];
    for (const c of cards.slice(0, 15)) {
      if (c.id) await save(`gift-card-${c.id}`, () => client.getGiftCardDetails(c.id));
    }
  } catch {}

  // More gift card pages
  await save("gift-cards-page-2", () => client.getGiftCardsHome("", "", "2"));
  await save("gift-cards-page-3", () => client.getGiftCardsHome("", "", "3"));

  // All recommendation cards pages
  await save("all-cards-page-3", () => client.getAllCards(3));
  await save("all-cards-page-4", () => client.getAllCards(4));
  await save("all-cards-page-5", () => client.getAllCards(5));

  // Income profile types
  await save("income-profile-salaried", () => client.getIncomeProfile("salaried"));
  await save("income-profile-business", () => client.getIncomeProfile("business"));

  console.log("\n✓ Done - additional data fetched");
}

main().catch(console.error);
