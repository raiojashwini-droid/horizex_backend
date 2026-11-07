require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Running owner migration...');
  
  // 1. Add ownerId column to Property
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
  `);
  console.log('✓ Added ownerId column to Property table');

  // 2. Add foreign key constraint if not exists
  try {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'Property_ownerId_fkey'
        ) THEN
          ALTER TABLE "Property" 
          ADD CONSTRAINT "Property_ownerId_fkey" 
          FOREIGN KEY ("ownerId") REFERENCES "User"("id") 
          ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
    console.log('✓ Added Property_ownerId_fkey constraint');
  } catch (err) {
    console.log('Notice on FK constraint:', err.message);
  }

  // 3. Add index on ownerId
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Property_ownerId_idx" ON "Property"("ownerId");
  `);
  console.log('✓ Created index on Property(ownerId)');

  // 4. Assign Demo Owner to the first Property if not assigned
  const demoOwner = await prisma.user.findFirst({ where: { role: 'OWNER' } });
  if (demoOwner) {
    const res = await prisma.$executeRawUnsafe(`
      UPDATE "Property" SET "ownerId" = '${demoOwner.id}' WHERE "ownerId" IS NULL;
    `);
    console.log(`✓ Assigned unassigned properties to Demo Owner (${demoOwner.email})`);
  }

  const assigned = await prisma.$queryRawUnsafe(`
    SELECT id, name, "ownerId" FROM "Property";
  `);
  console.log('Assigned properties:', assigned);
  console.log('Owner migration completed successfully!');
}

main()
  .catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
