import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Company: Acme
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

  // Company: I4ria + admin user gkozyris@i4ria.com
  const companyI4ria = await prisma.company.upsert({
    where: { slug: "i4ria" },
    update: {},
    create: {
      name: "I4ria",
      slug: "i4ria",
      country: "GR",
    },
  });

  const hashedAdminPassword = await hash("1f1femsk", 10);
  const userI4ria = await prisma.user.upsert({
    where: { email: "gkozyris@i4ria.com" },
    update: { hashedPassword: hashedAdminPassword, role: "SUPER_ADMIN", isActive: true },
    create: {
      email: "gkozyris@i4ria.com",
      name: "Admin",
      companyId: companyI4ria.id,
      departmentId: null,
      role: "SUPER_ADMIN",
      hashedPassword: hashedAdminPassword,
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
        createdByUserId: userI4ria.id,
      },
    });
  }

  console.log("Seed done.");
  console.log("  Login (Acme): admin@acme.com / admin123");
  console.log("  Login (Admin): gkozyris@i4ria.com / 1f1femsk");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
