import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canWriteFolder } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { EventType, TargetType } from "@prisma/client";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { parentFolderId?: number | null; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const parentId = body.parentFolderId === undefined || body.parentFolderId === null
    ? null
    : Number(body.parentFolderId);

  const user = {
    id: session.user.id,
    role: session.user.role,
    companyId: session.user.companyId,
    departmentId: session.user.departmentId,
  };

  let parentPath = "";
  if (parentId !== null && !Number.isNaN(parentId)) {
    const parent = await prisma.folder.findUnique({
      where: { id: parentId },
    });
    if (!parent || parent.companyId !== session.user.companyId) {
      return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
    }
    if (!canWriteFolder(user, parent)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    parentPath = parent.path.endsWith("/") ? parent.path : `${parent.path}/`;
  }

  const path = `${parentPath}${name}`;
  const existing = await prisma.folder.findFirst({
    where: {
      companyId: session.user.companyId,
      parentFolderId: parentId,
      name,
    },
  });
  if (existing) {
    return NextResponse.json({ error: "Folder with this name already exists" }, { status: 409 });
  }

  const folder = await prisma.folder.create({
    data: {
      companyId: session.user.companyId,
      parentFolderId: parentId,
      name,
      path,
      isDepartmentRoot: false,
      createdByUserId: session.user.id,
    },
  });

  await createAuditLog({
    companyId: session.user.companyId,
    actorUserId: session.user.id,
    eventType: EventType.FILE_MOVE,
    targetType: TargetType.FOLDER,
    targetId: folder.id,
    metadata: { action: "create", name: folder.name, path: folder.path },
  });

  return NextResponse.json({
    id: folder.id,
    name: folder.name,
    path: folder.path,
    parentFolderId: folder.parentFolderId,
    createdAt: folder.createdAt.toISOString(),
  });
}
