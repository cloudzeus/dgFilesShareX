/**
 * Seed for FileShareX.
 * For new deployments: run `pnpm run release` (or `prisma db push && prisma db seed`).
 *
 * Deployment Super Admin (always created/updated):
 *   Email: gkozyris@i4ria.com
 *   Password: 1f1femsk
 *   Role: SUPER_ADMIN
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Company: Acme (demo)
  const companyAcme = await prisma.company.upsert({
    where: { slug: "acme" },
    update: {},
    create: {
      name: "Acme Corp",
      slug: "acme",
      country: "US",
    },
  });

  const departmentGeneral = await prisma.department.upsert({
    where: { id: 1 },
    update: {},
    create: {
      companyId: companyAcme.id,
      name: "General",
      description: "Default department",
    },
  });

  const hashedAdmin123 = await hash("admin123", 10);
  const userAcme = await prisma.user.upsert({
    where: { email: "admin@acme.com" },
    update: {},
    create: {
      email: "admin@acme.com",
      name: "Admin User",
      companyId: companyAcme.id,
      departmentId: departmentGeneral.id,
      role: "COMPANY_ADMIN",
      hashedPassword: hashedAdmin123,
      isActive: true,
    },
  });

  const rootFolderAcme = await prisma.folder.findFirst({
    where: { companyId: companyAcme.id, parentFolderId: null },
  });
  if (!rootFolderAcme) {
    await prisma.folder.create({
      data: {
        companyId: companyAcme.id,
        parentFolderId: null,
        name: "Αρχεία",
        path: "/Αρχεία",
        isDepartmentRoot: false,
        createdByUserId: userAcme.id,
      },
    });
  }

  // Deployment Super Admin: gkozyris@i4ria.com / 1f1femsk (SUPER_ADMIN)
  const companyI4ria = await prisma.company.upsert({
    where: { slug: "i4ria" },
    update: {},
    create: {
      name: "I4ria",
      slug: "i4ria",
      country: "GR",
    },
  });

  const superAdminPassword = await hash("1f1femsk", 10);
  const superAdminUser = await prisma.user.upsert({
    where: { email: "gkozyris@i4ria.com" },
    update: {
      hashedPassword: superAdminPassword,
      role: "SUPER_ADMIN",
      isActive: true,
      name: "Super Admin",
    },
    create: {
      email: "gkozyris@i4ria.com",
      name: "Super Admin",
      companyId: companyI4ria.id,
      departmentId: null,
      role: "SUPER_ADMIN",
      hashedPassword: superAdminPassword,
      isActive: true,
    },
  });

  const rootFolderI4ria = await prisma.folder.findFirst({
    where: { companyId: companyI4ria.id, parentFolderId: null },
  });
  if (!rootFolderI4ria) {
    await prisma.folder.create({
      data: {
        companyId: companyI4ria.id,
        parentFolderId: null,
        name: "Αρχεία",
        path: "/Αρχεία",
        isDepartmentRoot: false,
        createdByUserId: superAdminUser.id,
      },
    });
  }

  console.log("Seed done.");
  console.log("  Super Admin (deployment): gkozyris@i4ria.com / 1f1femsk");
  console.log("  Acme (demo): admin@acme.com / admin123");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
