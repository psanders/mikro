/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create sample members
  const member1 = await prisma.member.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: {
      email: "alice@example.com",
      name: "Alice Smith"
    }
  });

  const member2 = await prisma.member.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: {
      email: "bob@example.com",
      name: "Bob Johnson"
    }
  });

  console.log("Created members:", { member1, member2 });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
