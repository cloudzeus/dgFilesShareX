import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canReadFolder } from "@/lib/rbac";
import type { Folder } from "@prisma/client";

type FolderNode = {
  id: number;
  name: string;
  path: string;
  isDepartmentRoot: boolean;
  children: FolderNode[];
};

export async function GET() {
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

  const allFolders = await prisma.folder.findMany({
    where: { companyId: session.user.companyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, path: true, parentFolderId: true, isDepartmentRoot: true, departmentId: true, createdByUserId: true },
  });

  const allowed = allFolders.filter((f) => canReadFolder(user, f as Folder));

  function buildTree(parentId: number | null): FolderNode[] {
    return allowed
      .filter((f) => f.parentFolderId === parentId)
      .map((f) => ({
        id: f.id,
        name: f.name,
        path: f.path,
        isDepartmentRoot: f.isDepartmentRoot,
        children: buildTree(f.id),
      }));
  }

  const tree = buildTree(null);
  return NextResponse.json({ tree });
}
