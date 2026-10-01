import { PrismaClient, RoleCode } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `pbkdf2$${salt}$${hash}`;
}

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Seed Roles
  const rolesData = [
    { code: RoleCode.ADMIN, name: 'System Administrator', description: 'Full system configuration & control' },
    { code: RoleCode.CEO, name: 'Executive / CEO', description: 'Executive read-only matrix & financial access' },
    { code: RoleCode.BD, name: 'Business Development', description: 'Master commercial schedule management' },
    { code: RoleCode.FINANCE, name: 'Finance', description: 'Cash flow & advance tracking' },
    { code: RoleCode.SHELLPLAN, name: 'Shellplan', description: 'Pre-design coordination' },
    { code: RoleCode.DESIGN, name: 'Design', description: 'Design engineering execution' },
    { code: RoleCode.PLANNING, name: 'Planning', description: 'Factory sequence planning' },
    { code: RoleCode.PRODUCTION, name: 'Production', description: 'Manufacturing & progress tracking' },
    { code: RoleCode.DISPATCH, name: 'Dispatch', description: 'Logistics & shipment verification' },
  ];

  for (const role of rolesData) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description },
      create: role,
    });
  }
  console.log('✅ 9 Roles seeded');

  // 2. Seed 7 Departments
  const departmentsData = [
    { code: RoleCode.BD, name: 'Business Development', description: 'Contract specifications & commercial data' },
    { code: RoleCode.FINANCE, name: 'Finance', description: 'Payments & financial terms' },
    { code: RoleCode.SHELLPLAN, name: 'Shellplan', description: 'Consultant drawing statuses & submissions' },
    { code: RoleCode.DESIGN, name: 'Design', description: 'Engineering design status & order quantities' },
    { code: RoleCode.PLANNING, name: 'Planning', description: 'Production series & processing stages' },
    { code: RoleCode.PRODUCTION, name: 'Production', description: 'Manufacturing output tracking' },
    { code: RoleCode.DISPATCH, name: 'Dispatch', description: 'Logistics, delivery, and sailing actuals' },
  ];

  for (const dept of departmentsData) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name, description: dept.description },
      create: dept,
    });
  }
  console.log('✅ 7 Departments seeded');

  // 3. Seed Admin User
  const adminEmail = 'admin@mfeformwork.com';
  const passwordHash = hashPassword('Admin@123456');

  const adminRole = await prisma.role.findUnique({
    where: { code: RoleCode.ADMIN },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      fullName: 'System Administrator',
      passwordHash,
      status: 'ACTIVE',
      isActive: true,
    },
    create: {
      email: adminEmail,
      fullName: 'System Administrator',
      passwordHash,
      status: 'ACTIVE',
      isActive: true,
    },
  });

  if (adminRole) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: adminUser.id,
          roleId: adminRole.id,
        },
      },
      update: {},
      create: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    });
  }
  console.log(`✅ Admin user seeded (${adminEmail})`);

  // 4. Seed MR11 Config Singleton
  await prisma.mr11Config.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      visibleColumns: [],
    },
  });
  console.log('✅ MR11 configuration initialized');

  console.log('🚀 Seeding complete! Database is ready.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });