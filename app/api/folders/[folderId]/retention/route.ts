import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManagePolicies, canWriteFolder } from "@/lib/rbac";
import type { Folder } from "@prisma/client";

/**
 * Recursively get all file IDs under a folder (and its subfolders).
 */
async function getFileIdsInFolder(
  folderId: number,
  companyId: number,
  recursive: boolean
): Promise<number[]> {
  const files = await prisma.file.findMany({
    where: { folderId, companyId, deletionStatus: "ACTIVE" },
    select: { id: true },
  });
  const ids = files.map((f) => f.id);
  if (!recursive) return ids;
  const subfolders = await prisma.folder.findMany({
    where: { parentFolderId: folderId, companyId },
    select: { id: true },
  });
  for (const sub of subfolders) {
    const subIds = await getFileIdsInFolder(sub.id, companyId, true);
    ids.push(...subIds);
  }
  return ids;
}

/**
 * POST: Assign a retention (GDPR) policy to all files in a folder.
 * Body: { policyId: number, recursive?: boolean }
 * Requires canManagePolicies; folder must be writable.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ folderId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const folderId = Number((await params).folderId);
  if (Number.isNaN(folderId)) {
    return NextResponse.json({ error: "Invalid folderId" }, { status: 400 });
  }

  let body: { policyId: number; recursive?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const policyId = Number(body.policyId);
  if (Number.isNaN(policyId) || policyId < 1) {
    return NextResponse.json({ error: "Valid policyId required" }, { status: 400 });
  }

  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
  });
  if (!folder || folder.companyId !== session.user.companyId) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const user = {
    id: session.user.id,
    role: session.user.role,
    companyId: session.user.companyId,
    departmentId: session.user.departmentId,
  };
  if (!canManagePolicies(user) && !canWriteFolder(user, folder as Folder)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const policy = await prisma.retentionPolicy.findFirst({
    where: { id: policyId, companyId: session.user.companyId },
  });
  if (!policy) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }

  const fileIds = await getFileIdsInFolder(
    folderId,
    session.user.companyId,
    body.recursive === true
  );

  if (fileIds.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "No files in folder",
      assignedCount: 0,
    });
  }

  await prisma.fileRetention.createMany({
    data: fileIds.map((fileId) => ({ fileId, policyId })),
    skipDuplicates: false,
  });

  return NextResponse.json({
    ok: true,
    message: "Policy assigned to files in folder",
    assignedCount: fileIds.length,
  });
}
