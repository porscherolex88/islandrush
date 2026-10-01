import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

async function main() {
  const { seedAdventure } = await import("@/server/content/adventure-seed");
  const created = await seedAdventure((msg) => console.log(`  ${msg}`));
  if (!created) console.log("Adventure content already present, nothing to do.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
