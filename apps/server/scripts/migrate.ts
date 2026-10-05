import "dotenv/config";
import { getDb } from "../src/db";

process.env.AUTO_MIGRATE = "true";
getDb()
  .then(() => {
    console.log("✓ database migrated and seeded");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
