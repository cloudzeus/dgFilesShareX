import { auth } from "@/auth";
import { signOutAction } from "@/app/actions";
import { el, roleLabel } from "@/lib/i18n";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HiOutlineArrowRightOnRectangle } from "react-icons/hi2";
import { DashboardNav } from "./dashboard-nav";
import { DashboardAdminSidebar } from "./dashboard-admin-sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";

  return (
    <div className="flex min-h-screen w-full min-w-0 bg-[var(--background)] text-[var(--foreground)]">
      {/* Left sidebar – dark, narrow, Material-style */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--outline)] bg-[var(--surface)]">
        <div className="flex h-14 items-center gap-2 border-b border-[var(--outline)] px-4">
          <Image
            src="/logoFileShareX.png"
            alt={el.appName}
            width={140}
            height={40}
            className="h-8 w-auto object-contain"
          />
        </div>
        <DashboardNav isSuperAdmin={isSuperAdmin} />
        <div className="border-t border-[var(--outline)] p-2">
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[var(--foreground)]/70 transition hover:bg-[var(--surface-variant)] hover:text-[var(--foreground)]"
              style={{ fontSize: "var(--text-body2)" }}
            >
              <HiOutlineArrowRightOnRectangle className="h-5 w-5 shrink-0" aria-hidden />
              {el.signOut}
            </button>
          </form>
        </div>
      </aside>

      {/* Main: top bar + content – uses remaining width */}
      <div className="flex min-w-0 flex-1 flex-col w-full">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-[var(--outline)] bg-[var(--surface)] px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link
              href="/dashboard/files"
              className="shrink-0 rounded-lg bg-[var(--primary)] px-3 py-1.5 font-medium text-[var(--on-primary)] transition hover:opacity-90"
              style={{ fontSize: "var(--text-body2)" }}
            >
              + Create
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="max-w-[180px] truncate text-right text-[var(--foreground)]/80"
              style={{ fontSize: "var(--text-caption)" }}
              title={session.user.email ?? undefined}
            >
              {session.user.email}
            </span>
            <span
              className="rounded bg-[var(--surface-variant)] px-2 py-0.5 text-[var(--foreground)]/70"
              style={{ fontSize: "var(--text-caption)" }}
            >
              {roleLabel(session.user.role)}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 w-full min-w-0">
          {children}
        </main>
      </div>

      {/* Right sidebar – Super Admin only */}
      {isSuperAdmin && (
        <DashboardAdminSidebar
          companyId={session.user.companyId}
          userId={session.user.id}
        />
      )}
    </div>
  );
}
