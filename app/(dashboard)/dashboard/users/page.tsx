import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { el } from "@/lib/i18n";
import { redirect } from "next/navigation";
import { UsersClient } from "./users-client";

function canManageUsers(role: string): boolean {
  return role === "SUPER_ADMIN" || role === "COMPANY_ADMIN";
}

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!canManageUsers(session.user.role)) redirect("/dashboard");

  const companyId = session.user.companyId;
  const hasCompany = typeof companyId === "number" && companyId > 0;

  const [users, departments] = await Promise.all([
    hasCompany
      ? prisma.user.findMany({
          where: { companyId },
          orderBy: [{ name: "asc" }, { email: "asc" }],
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            departmentId: true,
            isActive: true,
            department: { select: { id: true, name: true } },
          },
        })
      : [],
    hasCompany
      ? prisma.department.findMany({
          where: { companyId },
          orderBy: { name: "asc" },
          select: { id: true, name: true, description: true },
        })
      : [],
  ]);

  const userRows = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    departmentId: u.departmentId,
    isActive: u.isActive,
    department: u.department,
  }));

  const deptRows = departments.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
  }));

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-6 md:py-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-bold tracking-tight text-[var(--foreground)]" style={{ fontSize: "var(--text-h4)" }}>
          {el.employeesTitle}
        </h1>
        <p className="text-[var(--muted-foreground)]" style={{ fontSize: "var(--text-body2)" }}>
          {el.employeesDescription}
        </p>
      </div>

      <UsersClient
        users={userRows}
        departments={deptRows}
        currentUserId={session.user.id}
      />
    </div>
  );
}
