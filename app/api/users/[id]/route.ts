import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import type { UserRole } from "@prisma/client";

function canManageUsers(role: string): boolean {
  return role === "SUPER_ADMIN" || role === "COMPANY_ADMIN";
}

/**
 * PATCH: Update user (employee). Super Admin / Company Admin only.
 * Body: { name?, email?, password?, role?, departmentId?, isActive? }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageUsers(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const companyId = session.user.companyId as number;
  const { id } = await params;

  const existing = await prisma.user.findFirst({
    where: { id, companyId },
  });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: {
    name?: string;
    email?: string;
    password?: string;
    role?: UserRole;
    departmentId?: number | null;
    isActive?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validRoles: UserRole[] = ["EMPLOYEE", "DEPARTMENT_MANAGER", "COMPANY_ADMIN", "AUDITOR", "DPO", "SUPER_ADMIN"];
  if (body.role != null && !validRoles.includes(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (body.departmentId != null) {
    if (body.departmentId === 0 || body.departmentId === "") {
      (body as { departmentId: null }).departmentId = null;
    } else {
      const dept = await prisma.department.findFirst({
        where: { id: Number(body.departmentId), companyId },
      });
      if (!dept) {
        return NextResponse.json({ error: "Department not found or not in company" }, { status: 400 });
      }
    }
  }

  if (body.email != null) {
    const email = body.email.trim().toLowerCase();
    const duplicate = await prisma.user.findFirst({
      where: { email, id: { not: id } },
    });
    if (duplicate) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
  }

  const updateData: {
    name?: string | null;
    email?: string;
    hashedPassword?: string;
    role?: UserRole;
    departmentId?: number | null;
    isActive?: boolean;
  } = {};

  if (body.name !== undefined) updateData.name = body.name?.trim() || null;
  if (body.email !== undefined) updateData.email = body.email.trim().toLowerCase();
  if (body.password !== undefined && body.password !== "") {
    updateData.hashedPassword = await hash(body.password, 10);
  }
  if (body.role !== undefined) updateData.role = body.role;
  if (body.departmentId !== undefined) updateData.departmentId = body.departmentId ?? null;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      departmentId: true,
      isActive: true,
      department: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ user });
}

/**
 * DELETE: Deactivate or remove user. Super Admin / Company Admin only.
 * We soft-deactivate by setting isActive: false to avoid breaking references.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageUsers(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const companyId = session.user.companyId as number;
  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json({ error: "Cannot deactivate yourself" }, { status: 400 });
  }

  const existing = await prisma.user.findFirst({
    where: { id, companyId },
  });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}
