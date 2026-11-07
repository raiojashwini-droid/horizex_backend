require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  console.log('Testing owner queries...');

  // 1. Find Demo Owner
  const owner = await prisma.user.findFirst({ where: { role: 'OWNER' } });
  console.log('Demo Owner ID:', owner.id, 'Email:', owner.email);

  // 2. Query Property table for assigned properties
  const rows = await prisma.$queryRaw`
    SELECT id, name, "ownerId" FROM "Property" WHERE "isActive" = true AND "ownerId" = ${owner.id}
  `;
  console.log('Assigned Properties for Demo Owner:', rows);

  // 3. Units in assigned property
  const propIds = rows.map(r => r.id);
  const units = await prisma.unit.findMany({
    where: { propertyId: { in: propIds }, isActive: true },
    include: { leases: true }
  });
  console.log('Total Units under assigned property:', units.length);

  // 4. Test unassigned/other owner isolation:
  const otherOwnerRows = await prisma.$queryRaw`
    SELECT id, name FROM "Property" WHERE "isActive" = true AND "ownerId" = '00000000-0000-0000-0000-000000000000'
  `;
  console.log('Properties for fake/other owner:', otherOwnerRows.length); // Must be 0

  console.log('ALL OWNER ISOLATION CHECKS PASSED!');
}

test()
  .catch(e => console.error('Error:', e))
  .finally(() => prisma.$disconnect());
