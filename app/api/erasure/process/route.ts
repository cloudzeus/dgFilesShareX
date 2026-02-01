import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManagePolicies } from "@/lib/rbac";
import { deleteFile as deleteBunnyFile, getFile } from "@/lib/bunny";
import { createHash } from "crypto";

/**
 * Process files with deletionStatus PENDING_ERASURE: delete from Bunny, create ErasureProof, set ERASED.
 * Skips files under legal hold. Admin/DPO only.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = {
    id: session.user.id,
    role: session.user.role,
    companyId: session.user.companyId,
    departmentId: session.user.departmentId,
  };
  if (!canManagePolicies(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dueFiles = await prisma.file.findMany({
    where: {
      companyId: session.user.companyId,
      deletionStatus: "PENDING_ERASURE",
    },
    include: { retentions: true },
  });

  const toErase = dueFiles.filter((f) => !f.retentions.some((r) => r.underLegalHold));
  const results: { fileId: number; ok: boolean; error?: string }[] = [];

  for (const file of toErase) {
    const content = await getFile(file.bunnyStoragePath);
    const hashBefore = content ? createHash("sha256").update(content).digest("hex") : null;
    const deleteResult = await deleteBunnyFile(file.bunnyStoragePath);

    if (!deleteResult.ok) {
      results.push({ fileId: file.id, ok: false, error: deleteResult.error });
      continue;
    }

    const policyId = file.retentions[0]?.policyId ?? null;
    const proof = await prisma.erasureProof.create({
      data: {
        companyId: file.companyId,
        fileId: file.id,
        policyId,
        erasedAt: new Date(),
        erasedBySystemUserId: session.user.id,
        method: "bunny-storage-delete",
        bunnyDeleteResponse: { ok: true },
        hashBeforeDelete: hashBefore,
      },
    });

    await prisma.file.update({
      where: { id: file.id },
      data: { deletionStatus: "ERASED", deletionProofId: proof.id },
    });

    results.push({ fileId: file.id, ok: true });
  }

  return NextResponse.json({
    processed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
