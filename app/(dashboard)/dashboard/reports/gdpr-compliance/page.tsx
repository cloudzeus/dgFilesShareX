import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canViewAudit } from "@/lib/rbac";
import { el } from "@/lib/i18n";
import { redirect } from "next/navigation";

export default async function ReportsGdprCompliancePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const canView = canViewAudit(
    {
      id: session.user.id,
      role: session.user.role,
      companyId: session.user.companyId,
      departmentId: session.user.departmentId,
    },
    "company"
  );

  const companyId = session.user.companyId;
  const hasCompany = typeof companyId === "number" && companyId > 0;

  const [policies, fileCounts, retentionCounts] = canView && hasCompany
    ? await Promise.all([
        prisma.retentionPolicy.findMany({
          where: { companyId },
          orderBy: { name: "asc" },
          include: {
            _count: { select: { fileRetentions: true, erasureProofs: true } },
          },
        }),
        prisma.file.groupBy({
          by: ["gdprRiskLevel"],
          where: { companyId, deletionStatus: "ACTIVE" },
          _count: true,
        }),
        prisma.fileRetention.groupBy({
          by: ["policyId"],
          where: { file: { companyId } },
          _count: true,
        }),
      ])
    : [[], [], []];

  const riskLabels: Record<string, string> = {
    UNKNOWN: el.gdprUnknown,
    NO_PII: el.gdprNoPii,
    POSSIBLE_PII: el.gdprPossiblePii,
    CONFIRMED_PII: el.gdprConfirmedPii,
  };

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-6 md:py-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-bold tracking-tight text-[var(--foreground)]" style={{ fontSize: "var(--text-h4)" }}>
          {el.reportGdprComplianceTitle}
        </h1>
        <p className="text-[var(--muted-foreground)]" style={{ fontSize: "var(--text-body2)" }}>
          {el.reportGdprComplianceDescription}
        </p>
      </div>

      {canView ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {fileCounts.map((g) => (
              <div key={g.gdprRiskLevel} className="rounded-xl border border-[var(--outline)] bg-[var(--card)] p-6">
                <p className="font-medium text-[var(--muted-foreground)]" style={{ fontSize: "var(--text-body2)" }}>
                  {riskLabels[g.gdprRiskLevel] ?? g.gdprRiskLevel}
                </p>
                <p className="mt-2 font-semibold tracking-tight" style={{ fontSize: "var(--text-h4)" }}>
                  {g._count}
                </p>
              </div>
            ))}
          </section>

          <section className="rounded-xl border border-[var(--outline)] bg-[var(--card)]">
            <div className="border-b border-[var(--outline)] px-4 py-4 md:px-6">
              <h2 className="font-semibold tracking-tight text-[var(--card-foreground)]" style={{ fontSize: "var(--text-h6)" }}>
                Πολιτικές διατήρησης και συμμόρφωση
              </h2>
            </div>
            {policies.length === 0 ? (
              <div className="px-6 py-12 text-center text-[var(--muted-foreground)]" style={{ fontSize: "var(--text-body2)" }}>
                Δεν υπάρχουν πολιτικές διατήρησης.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left" style={{ fontSize: "var(--text-body2)" }}>
                  <thead>
                    <tr className="border-b border-[var(--outline)] bg-[var(--muted)]/50">
                      <th className="px-4 py-3 font-medium text-[var(--foreground)] md:px-6">Όνομα</th>
                      <th className="px-4 py-3 font-medium text-[var(--foreground)] md:px-6">Ημέρες</th>
                      <th className="px-4 py-3 font-medium text-[var(--foreground)] md:px-6">Αρχεία με πολιτική</th>
                      <th className="px-4 py-3 font-medium text-[var(--foreground)] md:px-6">Αυτόματη διαγραφή</th>
                    </tr>
                  </thead>
                  <tbody>
                    {policies.map((p) => {
                      const count = retentionCounts.find((r) => r.policyId === p.id)?._count ?? 0;
                      return (
                        <tr key={p.id} className="border-b border-[var(--outline)] transition hover:bg-[var(--muted)]/30">
                          <td className="px-4 py-3 font-medium text-[var(--foreground)] md:px-6">{p.name}</td>
                          <td className="px-4 py-3 text-[var(--muted-foreground)] md:px-6">{p.durationDays ?? "—"}</td>
                          <td className="px-4 py-3 text-[var(--muted-foreground)] md:px-6">{count}</td>
                          <td className="px-4 py-3 md:px-6">{p.autoDelete ? "Ναι" : "Όχι"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <div className="rounded-xl border border-[var(--outline)] bg-[var(--card)] p-8 text-center">
          <p className="font-medium text-[var(--foreground)]" style={{ fontSize: "var(--text-body1)" }}>
            {el.reportsNoAuditAccess}
          </p>
        </div>
      )}
    </div>
  );
}
