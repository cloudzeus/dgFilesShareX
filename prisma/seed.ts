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
  // ----- Default company: ΑΦΟΙ ΚΟΛΛΕΡΗΣ ΙΚΕ (single company for DR file share & GDPR) -----
  const companyKolleris = await prisma.company.upsert({
    where: { slug: "kolleris_ike" },
    update: {
      name: "ΑΦΟΙ ΚΟΛΛΕΡΗΣ ΙΚΕ",
      country: "GR",
      address: "K. Mavromichali 4",
      isDefault: true,
    },
    create: {
      name: "ΑΦΟΙ ΚΟΛΛΕΡΗΣ ΙΚΕ",
      slug: "kolleris_ike",
      country: "GR",
      address: "K. Mavromichali 4",
      isDefault: true,
    },
  });

  const deptKolleris = await prisma.department.findFirst({
    where: { companyId: companyKolleris.id, name: "Γενικό" },
  }) ?? await prisma.department.create({
    data: {
      companyId: companyKolleris.id,
      name: "Γενικό",
      description: "Default department",
    },
  });

  const hashedKollerisAdmin = await hash("admin123", 10);
  const adminKolleris = await prisma.user.upsert({
    where: { email: "admin@kolleris.gr" },
    update: {
      name: "Admin User",
      companyId: companyKolleris.id,
      departmentId: deptKolleris.id,
      role: "COMPANY_ADMIN",
      hashedPassword: hashedKollerisAdmin,
      isActive: true,
    },
    create: {
      email: "admin@kolleris.gr",
      name: "Admin User",
      companyId: companyKolleris.id,
      departmentId: deptKolleris.id,
      role: "COMPANY_ADMIN",
      hashedPassword: hashedKollerisAdmin,
      isActive: true,
    },
  });

  await prisma.company.update({
    where: { id: companyKolleris.id },
    data: {
      dpoUserId: adminKolleris.id,
      securityOfficerUserId: adminKolleris.id,
    },
  });

  const rootKolleris = await prisma.folder.findFirst({
    where: { companyId: companyKolleris.id, parentFolderId: null },
  });
  if (!rootKolleris) {
    await prisma.folder.create({
      data: {
        companyId: companyKolleris.id,
        parentFolderId: null,
        name: "Αρχεία",
        path: "/Αρχεία",
        isDepartmentRoot: false,
        createdByUserId: adminKolleris.id,
      },
    });
  }
  const rootFolderKolleris = await prisma.folder.findFirst({
    where: { companyId: companyKolleris.id, parentFolderId: null },
  });
  if (!rootFolderKolleris) throw new Error("Kolleris root folder missing");

  // Report samples for default company only
  const seedPrefixKolleris = "seed/reports-demo-kolleris";
  const existingKollerisSeed = await prisma.file.findMany({
    where: { companyId: companyKolleris.id, bunnyStoragePath: { startsWith: seedPrefixKolleris } },
    select: { id: true },
  });
  if (existingKollerisSeed.length === 0) {
    const now = new Date();
    const daysAgo = (d: number) => {
      const d2 = new Date(now);
      d2.setDate(d2.getDate() - d);
      return d2;
    };
    const filesK = await Promise.all([
      prisma.file.create({
        data: {
          companyId: companyKolleris.id,
          folderId: rootFolderKolleris.id,
          departmentId: deptKolleris.id,
          name: "Sample Report.pdf",
          extension: "pdf",
          sizeBytes: 102400,
          mimeType: "application/pdf",
          bunnyStoragePath: `${seedPrefixKolleris}/sample-report.pdf`,
          createdByUserId: adminKolleris.id,
          gdprRiskLevel: "POSSIBLE_PII",
          malwareStatus: "CLEAN",
          deletionStatus: "ACTIVE",
        },
      }),
      prisma.file.create({
        data: {
          companyId: companyKolleris.id,
          folderId: rootFolderKolleris.id,
          departmentId: deptKolleris.id,
          name: "Internal Doc.docx",
          extension: "docx",
          sizeBytes: 25600,
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          bunnyStoragePath: `${seedPrefixKolleris}/internal-doc.docx`,
          createdByUserId: adminKolleris.id,
          gdprRiskLevel: "NO_PII_DETECTED",
          malwareStatus: "CLEAN",
          deletionStatus: "ACTIVE",
        },
      }),
      prisma.file.create({
        data: {
          companyId: companyKolleris.id,
          folderId: rootFolderKolleris.id,
          departmentId: deptKolleris.id,
          name: "Erased File (proof).pdf",
          extension: "pdf",
          sizeBytes: 8192,
          mimeType: "application/pdf",
          bunnyStoragePath: `${seedPrefixKolleris}/erased-file.pdf`,
          createdByUserId: adminKolleris.id,
          gdprRiskLevel: "UNKNOWN",
          malwareStatus: "CLEAN",
          deletionStatus: "ERASED",
        },
      }),
    ]);
    const fIds = filesK.map((f) => f.id);
    await prisma.auditLog.createMany({
      data: [
        { companyId: companyKolleris.id, actorUserId: adminKolleris.id, eventType: "FILE_UPLOAD", targetType: "FILE", targetId: fIds[0], createdAt: daysAgo(3) },
        { companyId: companyKolleris.id, actorUserId: adminKolleris.id, eventType: "FILE_UPLOAD", targetType: "FILE", targetId: fIds[1], createdAt: daysAgo(2) },
        { companyId: companyKolleris.id, actorUserId: adminKolleris.id, eventType: "FILE_DOWNLOAD", targetType: "FILE", targetId: fIds[0], createdAt: daysAgo(1) },
        { companyId: companyKolleris.id, actorUserId: adminKolleris.id, eventType: "FILE_DELETE", targetType: "FILE", targetId: fIds[2], createdAt: daysAgo(1) },
        { companyId: companyKolleris.id, actorUserId: adminKolleris.id, eventType: "USER_LOGIN", targetType: "USER", targetId: null, createdAt: daysAgo(2) },
        { companyId: companyKolleris.id, actorUserId: adminKolleris.id, eventType: "GDPR_ERASURE_COMPLETED", targetType: "FILE", targetId: fIds[2], createdAt: daysAgo(1) },
      ],
    });
    const epK = await prisma.erasureProof.create({
      data: {
        companyId: companyKolleris.id,
        fileId: fIds[2],
        erasedAt: daysAgo(1),
        erasedBySystemUserId: adminKolleris.id,
        method: "seed-demo",
        hashBeforeDelete: "sha256:seed-kolleris",
      },
    });
    await prisma.file.update({ where: { id: fIds[2] }, data: { deletionProofId: epK.id } });
    const shareK = await prisma.fileShare.create({
      data: {
        companyId: companyKolleris.id,
        fileId: fIds[0],
        createdByUserId: adminKolleris.id,
        shareType: "EXTERNAL_OTP",
        requireOtp: true,
        expiresAt: daysAgo(-7),
        maxDownloads: 5,
        remainingDownloads: 3,
      },
    });
    await prisma.fileShareAccess.createMany({
      data: [
        { shareId: shareK.id, fileId: fIds[0], accessedAt: daysAgo(2), success: true, download: true, reason: "OK" },
        { shareId: shareK.id, fileId: fIds[0], accessedAt: daysAgo(1), success: true, download: true, reason: "OK" },
      ],
    });
    const polK = await prisma.retentionPolicy.create({
      data: {
        companyId: companyKolleris.id,
        name: "Default 7 years",
        description: "Standard retention",
        durationDays: 365 * 7,
        autoDelete: false,
        legalHoldAllowed: true,
      },
    });
    await prisma.fileRetention.create({ data: { fileId: fIds[0], policyId: polK.id, effectiveFrom: daysAgo(10) } });
    await prisma.fileRetention.create({ data: { fileId: fIds[1], policyId: polK.id, effectiveFrom: daysAgo(5) } });
    await prisma.erasureProof.create({
      data: {
        companyId: companyKolleris.id,
        fileId: fIds[2],
        policyId: polK.id,
        erasedAt: daysAgo(1),
        erasedBySystemUserId: adminKolleris.id,
        method: "seed-demo-policy",
        hashBeforeDelete: null,
      },
    });
    console.log("  Report samples created for default company (Kolleris).");
  }

  // ----- I4ria: non-default company (for sharing / Super Admin) -----
  const companyI4ria = await prisma.company.upsert({
    where: { slug: "i4ria" },
    update: { isDefault: false },
    create: {
      name: "I4ria",
      slug: "i4ria",
      country: "GR",
      isDefault: false,
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
  const rootFolderI4riaResolved = await prisma.folder.findFirst({
    where: { companyId: companyI4ria.id, parentFolderId: null },
  });
  if (!rootFolderI4riaResolved) throw new Error("I4ria root folder missing");

  // ----- Report samples for I4ria (so Super Admin sees reports) -----
  const seedPrefixI4ria = "seed/reports-demo-i4ria";
  const existingI4riaSeedFiles = await prisma.file.findMany({
    where: { companyId: companyI4ria.id, bunnyStoragePath: { startsWith: seedPrefixI4ria } },
    select: { id: true },
  });
  if (existingI4riaSeedFiles.length === 0) {
    const now = new Date();
    const daysAgo = (d: number) => {
      const d2 = new Date(now);
      d2.setDate(d2.getDate() - d);
      return d2;
    };
    const filesI4ria = await Promise.all([
      prisma.file.create({
        data: {
          companyId: companyI4ria.id,
          folderId: rootFolderI4riaResolved.id,
          departmentId: null,
          name: "Sample Report.pdf",
          extension: "pdf",
          sizeBytes: 102400,
          mimeType: "application/pdf",
          bunnyStoragePath: `${seedPrefixI4ria}/sample-report.pdf`,
          createdByUserId: superAdminUser.id,
          gdprRiskLevel: "POSSIBLE_PII",
          malwareStatus: "CLEAN",
          deletionStatus: "ACTIVE",
        },
      }),
      prisma.file.create({
        data: {
          companyId: companyI4ria.id,
          folderId: rootFolderI4riaResolved.id,
          departmentId: null,
          name: "Internal Doc.docx",
          extension: "docx",
          sizeBytes: 25600,
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          bunnyStoragePath: `${seedPrefixI4ria}/internal-doc.docx`,
          createdByUserId: superAdminUser.id,
          gdprRiskLevel: "NO_PII_DETECTED",
          malwareStatus: "CLEAN",
          deletionStatus: "ACTIVE",
        },
      }),
      prisma.file.create({
        data: {
          companyId: companyI4ria.id,
          folderId: rootFolderI4riaResolved.id,
          departmentId: null,
          name: "Erased File (proof).pdf",
          extension: "pdf",
          sizeBytes: 8192,
          mimeType: "application/pdf",
          bunnyStoragePath: `${seedPrefixI4ria}/erased-file.pdf`,
          createdByUserId: superAdminUser.id,
          gdprRiskLevel: "UNKNOWN",
          malwareStatus: "CLEAN",
          deletionStatus: "ERASED",
        },
      }),
    ]);
    const fIds = filesI4ria.map((f) => f.id);

    await prisma.auditLog.createMany({
      data: [
        { companyId: companyI4ria.id, actorUserId: superAdminUser.id, eventType: "FILE_UPLOAD", targetType: "FILE", targetId: fIds[0], createdAt: daysAgo(3) },
        { companyId: companyI4ria.id, actorUserId: superAdminUser.id, eventType: "FILE_UPLOAD", targetType: "FILE", targetId: fIds[1], createdAt: daysAgo(2) },
        { companyId: companyI4ria.id, actorUserId: superAdminUser.id, eventType: "FILE_DOWNLOAD", targetType: "FILE", targetId: fIds[0], createdAt: daysAgo(1) },
        { companyId: companyI4ria.id, actorUserId: superAdminUser.id, eventType: "FILE_DELETE", targetType: "FILE", targetId: fIds[2], createdAt: daysAgo(1) },
        { companyId: companyI4ria.id, actorUserId: superAdminUser.id, eventType: "USER_LOGIN", targetType: "USER", targetId: null, createdAt: daysAgo(2) },
        { companyId: companyI4ria.id, actorUserId: superAdminUser.id, eventType: "GDPR_ERASURE_COMPLETED", targetType: "FILE", targetId: fIds[2], createdAt: daysAgo(1) },
      ],
    });

    const ep = await prisma.erasureProof.create({
      data: {
        companyId: companyI4ria.id,
        fileId: fIds[2],
        erasedAt: daysAgo(1),
        erasedBySystemUserId: superAdminUser.id,
        method: "seed-demo",
        hashBeforeDelete: "sha256:seed-i4ria",
      },
    });
    await prisma.file.update({ where: { id: fIds[2] }, data: { deletionProofId: ep.id } });

    const shareI4ria = await prisma.fileShare.create({
      data: {
        companyId: companyI4ria.id,
        fileId: fIds[0],
        createdByUserId: superAdminUser.id,
        shareType: "EXTERNAL_OTP",
        requireOtp: true,
        expiresAt: daysAgo(-7),
        maxDownloads: 5,
        remainingDownloads: 3,
      },
    });
    await prisma.fileShareAccess.createMany({
      data: [
        { shareId: shareI4ria.id, fileId: fIds[0], accessedAt: daysAgo(2), success: true, download: true, reason: "OK" },
        { shareId: shareI4ria.id, fileId: fIds[0], accessedAt: daysAgo(1), success: true, download: true, reason: "OK" },
      ],
    });

    const polI4ria = await prisma.retentionPolicy.create({
      data: {
        companyId: companyI4ria.id,
        name: "Default 7 years",
        description: "Standard retention",
        durationDays: 365 * 7,
        autoDelete: false,
        legalHoldAllowed: true,
      },
    });
    await prisma.fileRetention.create({
      data: { fileId: fIds[0], policyId: polI4ria.id, effectiveFrom: daysAgo(10) },
    });
    await prisma.fileRetention.create({
      data: { fileId: fIds[1], policyId: polI4ria.id, effectiveFrom: daysAgo(5) },
    });
    await prisma.erasureProof.create({
      data: {
        companyId: companyI4ria.id,
        fileId: fIds[2],
        policyId: polI4ria.id,
        erasedAt: daysAgo(1),
        erasedBySystemUserId: superAdminUser.id,
        method: "seed-demo-policy",
        hashBeforeDelete: null,
      },
    });

    console.log("  Report samples created for I4ria (Super Admin company).");
  }

  console.log("Seed done.");
  console.log("  Super Admin (deployment): gkozyris@i4ria.com / 1f1femsk");
  console.log("  Default company (Kolleris IKE): admin@kolleris.gr / admin123");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
