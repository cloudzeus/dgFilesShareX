import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET: List all companies. Super Admin only.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      country: true,
      address: true,
      afm: true,
      activity: true,
      bunnyStorageZoneName: true,
      defaultDataRetentionPolicyId: true,
      _count: {
        select: { users: true, departments: true, files: true, folders: true },
      },
    },
  });

  return NextResponse.json({ companies });
}
