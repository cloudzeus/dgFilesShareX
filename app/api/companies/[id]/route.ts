import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET: Company details. Super Admin only.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = Number((await params).id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      defaultRetentionPolicy: { select: { id: true, name: true, durationDays: true } },
      _count: { select: { users: true, departments: true, files: true, folders: true } },
    },
  });

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  return NextResponse.json({
    company: {
      ...company,
      bunnyStorageAccessKey: company.bunnyStorageAccessKey ? "(set)" : null,
    },
  });
}

/**
 * PATCH: Update company. Super Admin only.
 * Body: { name?, slug?, country?, bunnyStorageZoneName?, bunnyStorageAccessKey?, defaultDataRetentionPolicyId? }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = Number((await params).id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const existing = await prisma.company.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  let body: {
    name?: string;
    slug?: string;
    country?: string | null;
    address?: string | null;
    afm?: string | null;
    activity?: string | null;
    bunnyStorageZoneName?: string | null;
    bunnyStorageAccessKey?: string | null;
    defaultDataRetentionPolicyId?: number | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name.trim();
  if (body.slug !== undefined) updateData.slug = body.slug.trim().toLowerCase().replace(/\s+/g, "-");
  if (body.country !== undefined) updateData.country = body.country?.trim() || null;
  if (body.address !== undefined) updateData.address = body.address?.trim() || null;
  if (body.afm !== undefined) updateData.afm = body.afm?.trim() || null;
  if (body.activity !== undefined) updateData.activity = body.activity?.trim() || null;
  if (body.bunnyStorageZoneName !== undefined) updateData.bunnyStorageZoneName = body.bunnyStorageZoneName?.trim() || null;
  if (body.bunnyStorageAccessKey !== undefined) updateData.bunnyStorageAccessKey = body.bunnyStorageAccessKey === "" ? null : (body.bunnyStorageAccessKey ?? null);
  if (body.defaultDataRetentionPolicyId !== undefined) updateData.defaultDataRetentionPolicyId = body.defaultDataRetentionPolicyId ?? null;

  const company = await prisma.company.update({
    where: { id },
    data: updateData,
    include: {
      defaultRetentionPolicy: { select: { id: true, name: true, durationDays: true } },
      _count: { select: { users: true, departments: true, files: true, folders: true } },
    },
  });

  return NextResponse.json({ company });
}

/**
 * DELETE: Delete company. Super Admin only. Only if no users, departments, files, folders.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = Number((await params).id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const existing = await prisma.company.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true, departments: true, files: true, folders: true } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  if (existing._count.users > 0 || existing._count.departments > 0 || existing._count.files > 0 || existing._count.folders > 0) {
    return NextResponse.json(
      { error: "Company has users, departments, files or folders. Remove them first." },
      { status: 400 }
    );
  }

  await prisma.company.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
