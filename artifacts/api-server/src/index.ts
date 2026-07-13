import app from "./app";
import { logger } from "./lib/logger";
import { db, adminUsersTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { seedConsentText, seedOrderTerms, seedDefaultEventDescription, seedDefaultOrderDescription } from "./routes/settings";

async function seedAdmins() {
  const superusers = [
    "+4531705342",
  ];
  for (const mobile of superusers) {
    await db
      .insert(adminUsersTable)
      .values({ mobile, isSuperuser: true })
      .onConflictDoUpdate({
        target: adminUsersTable.mobile,
        set: { isSuperuser: sql`excluded.is_superuser` },
      });
  }
  logger.info({ count: superusers.length }, "Admin superusers seeded");
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  seedAdmins().catch((err) => logger.error({ err }, "Failed to seed admins"));
  seedConsentText().catch((err) => logger.error({ err }, "Failed to seed consent text"));
  seedOrderTerms().catch((err) => logger.error({ err }, "Failed to seed order terms"));
  seedDefaultEventDescription().catch((err) => logger.error({ err }, "Failed to seed default event description"));
  seedDefaultOrderDescription().catch((err) => logger.error({ err }, "Failed to seed default order description"));
});
