import { PrismaClient, Role, UnitStatus, ReadinessStage } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding for Horizex Property Pro...');

  // 1. Create Default Master Company
  const company = await prisma.company.upsert({
    where: { code: 'HRZX' },
    update: {},
    create: {
      name: 'Horizex Real Estate Corp',
      code: 'HRZX',
      contactEmail: 'admin@horizex.com',
      contactPhone: '+1 (514) 555-0199',
      taxNumber: 'QC-12345678-RT0001',
    },
  });
  console.log(`✅ Company provisioned: ${company.name} (${company.id})`);

  // 2. Create Master Super Admin User
  const passwordHash = await bcrypt.hash('Admin@123456', 10);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@horizex.com' },
    update: {
      role: Role.ADMIN,
    },
    create: {
      companyId: company.id,
      email: 'admin@horizex.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'Administrator',
      phone: '+1 (514) 555-0100',
      role: Role.ADMIN,
    },
  });
  console.log(`✅ Super Admin created: ${superAdmin.email} (Password: Admin@123456)`);

  // 3. Create Standard Unit Types
  const unitTypesData = [
    { name: 'Studio Suite', code: 'STUDIO', marketRent: 1250 },
    { name: '1 Bedroom + 1 Bath', code: '1B1B', marketRent: 1650 },
    { name: '2 Bedroom + 2 Bath', code: '2B2B', marketRent: 2200 },
    { name: '3 Bedroom Penthouse', code: '3B2B', marketRent: 3100 },
  ];

  for (const ut of unitTypesData) {
    await prisma.unitType.upsert({
      where: { code: ut.code },
      update: { marketRent: ut.marketRent },
      create: ut,
    });
  }
  console.log('✅ Unit Types configured: Studio, 1B1B, 2B2B, 3B2B.');

  // 4. Create Corporate Bank Account
  const bankAccount = await prisma.bankAccount.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      companyId: company.id,
      bankName: 'National Bank of Canada',
      accountName: 'Horizex Main Operating Account',
      accountNumber: '9876-5432-10',
      routingNumber: '006-12345',
      balance: 150000.0,
    },
  });
  console.log(`✅ Operating Bank Account configured: ${bankAccount.accountName}`);

  // 5. Create Demo Property
  const property = await prisma.property.create({
    data: {
      companyId: company.id,
      name: 'Le Mirage Condominiums & Suites',
      address: '1450 Boulevard René-Lévesque Ouest',
      city: 'Montréal',
      state: 'QC',
      postalCode: 'H3G 1T7',
      totalUnits: 12,
    },
  });
  console.log(`✅ Demo Property created: ${property.name}`);

  // 6. Create Demo Units with different statuses
  const studioType = await prisma.unitType.findUnique({ where: { code: 'STUDIO' } });
  const twoBedType = await prisma.unitType.findUnique({ where: { code: '2B2B' } });

  // Unit 101: VACANT
  await prisma.unit.create({
    data: {
      propertyId: property.id,
      unitTypeId: studioType?.id,
      unitNumber: '101',
      floor: 1,
      bedrooms: 1,
      bathrooms: 1.0,
      baseRent: 1250.0,
      status: UnitStatus.VACANT,
      readiness: {
        create: {
          stage: ReadinessStage.READY_TO_LEASE,
          cleaningComplete: true,
          paintComplete: true,
          repairComplete: true,
        },
      },
    },
  });

  // Unit 102: TURNOVER (in pipeline)
  await prisma.unit.create({
    data: {
      propertyId: property.id,
      unitTypeId: twoBedType?.id,
      unitNumber: '102',
      floor: 1,
      bedrooms: 2,
      bathrooms: 2.0,
      baseRent: 2200.0,
      status: UnitStatus.TURNOVER,
      readiness: {
        create: {
          stage: ReadinessStage.MAINTENANCE_REPAIRS,
          cleaningComplete: true,
          paintComplete: false,
          repairComplete: false,
          notes: 'Drywall patching required in master bedroom.',
        },
      },
    },
  });

  console.log('✅ Demo Units initialized (Unit 101: Vacant, Unit 102: Turnover Pipeline).');
  // 7. Seed Demo Tenant & Owner Users
  const userPasswordHash = await bcrypt.hash('123456', 10);
  const tenantUser = await prisma.user.upsert({
    where: { email: 'tenant@property.com' },
    update: { passwordHash: userPasswordHash, role: Role.TENANT, isActive: true },
    create: {
      email: 'tenant@property.com',
      passwordHash: userPasswordHash,
      firstName: 'Demo',
      lastName: 'Tenant',
      role: Role.TENANT,
      phone: '+1 (514) 555-0191',
      companyId: company.id,
      isActive: true,
    },
  });

  const tenantRecord = await prisma.tenant.upsert({
    where: { email: 'tenant@property.com' },
    update: { isActive: true },
    create: {
      id: tenantUser.id,
      companyId: company.id,
      firstName: 'Demo',
      lastName: 'Tenant',
      email: 'tenant@property.com',
      phone: '+1 (514) 555-0191',
      isActive: true,
    },
  });

  const ownerUser = await prisma.user.upsert({
    where: { email: 'owner@property.com' },
    update: { passwordHash: userPasswordHash, role: Role.OWNER, isActive: true },
    create: {
      email: 'owner@property.com',
      passwordHash: userPasswordHash,
      firstName: 'Demo',
      lastName: 'Owner',
      role: Role.OWNER,
      phone: '+1 (514) 555-0192',
      companyId: company.id,
      isActive: true,
    },
  });
  console.log('✅ Demo Tenant & Owner seeded (tenant@property.com, owner@property.com / 123456).');

  console.log('🎉 Seeding successfully completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

