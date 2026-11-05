const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Applying permissions migration to database...');
  
  // 1. Add COWORKER enum value to "Role" if not already present
  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'COWORKER';`);
    console.log('✓ Added COWORKER to Role enum');
  } catch (err) {
    console.log('Notice on Role enum:', err.message);
  }

  // 2. Create permissions table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "permissions" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "moduleName" TEXT NOT NULL,
      "canView" BOOLEAN NOT NULL DEFAULT false,
      "canAdd" BOOLEAN NOT NULL DEFAULT false,
      "canEdit" BOOLEAN NOT NULL DEFAULT false,
      "canDelete" BOOLEAN NOT NULL DEFAULT false,
      CONSTRAINT "permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  console.log('✓ Created permissions table');

  // 3. Create indices
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "permissions_userId_moduleName_key" ON "permissions"("userId", "moduleName");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "permissions_userId_idx" ON "permissions"("userId");
  `);
  console.log('✓ Created permissions indices');
  console.log('Migration complete!');
}

main()
  .catch(e => {
    console.error('Migration error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

