import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { PageHeader, EmptyState, PrimaryButton, SecondaryButton } from "@/components/ui/PageHeader";

export default function People() {
  const [, navigate] = useLocation();
  const { data: orgData } = useQuery<{ org: any }>({
    queryKey: ["orgs", "me"],
    queryFn: async () => (await fetch(apiUrl("/orgs/me"), { credentials: "include" })).json(),
  });
  const orgId = orgData?.org?.id;

  const { data, isLoading } = useQuery<{ people: any[] }>({
    queryKey: ["org-people", orgId],
    queryFn: async () => (await fetch(apiUrl(`/orgs/${orgId}/people`), { credentials: "include" })).json(),
    enabled: !!orgId,
  });

  const people = data?.people ?? [];
  const mfaEnabled = people.filter(p => p.mfaEnabled).length;
  const trainingComplete = people.filter(p => p.trainingComplete).length;

  const PeopleIcon = (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );

  return (
    <div className="p-6 max-w-screen-xl">
      <PageHeader
        title="People"
        subtitle="Track workforce compliance: MFA, training, and access reviews"
        actions={
          <>
            <SecondaryButton onClick={() => navigate("/integrations")}>Import from integration</SecondaryButton>
            <PrimaryButton>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Person
            </PrimaryButton>
          </>
        }
      />

      {people.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-2xl font-bold text-slate-900 leading-none">{people.length}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Total People</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className={`text-2xl font-bold leading-none ${mfaEnabled === people.length ? "text-green-600" : mfaEnabled > 0 ? "text-amber-500" : "text-slate-400"}`}>{mfaEnabled}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">MFA Enabled</p>
            <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: `${people.length > 0 ? (mfaEnabled / people.length) * 100 : 0}%` }} />
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className={`text-2xl font-bold leading-none ${trainingComplete === people.length ? "text-green-600" : trainingComplete > 0 ? "text-amber-500" : "text-slate-400"}`}>{trainingComplete}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Training Complete</p>
            <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: `${people.length > 0 ? (trainingComplete / people.length) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : people.length === 0 ? (
        <EmptyState
          icon={PeopleIcon}
          title="No people added yet"
          body="Connect an HR or identity integration to automatically sync your team, or add members manually."
          action={<PrimaryButton onClick={() => navigate("/integrations")}>Connect integration</PrimaryButton>}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Person</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">MFA</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Training</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Access Review</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Source</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p: any, idx: number) => (
                <tr key={p.id} className={`${idx > 0 ? "border-t border-slate-100" : ""} hover:bg-slate-50 transition-colors`}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
                        {(p.name ?? p.login ?? "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 leading-snug">{p.name ?? p.login}</p>
                        {p.email && <p className="text-xs text-slate-400 truncate">{p.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">
                    {p.role ? <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">{p.role}</span> : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusPill value={p.mfaEnabled} trueLabel="Enabled" falseLabel="Disabled" />
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusPill value={p.trainingComplete} trueLabel="Complete" falseLabel="Pending" />
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <StatusPill value={p.accessReviewComplete} trueLabel="Reviewed" falseLabel="Pending" neutral />
                  </td>
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    {p.source ? (
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-mono">{p.source}</span>
                    ) : <span className="text-slate-300 text-xs">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusPill({ value, trueLabel, falseLabel, neutral }: {
  value: boolean; trueLabel: string; falseLabel: string; neutral?: boolean;
}) {
  if (value) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 ring-1 ring-green-200 px-2 py-0.5 rounded-full">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        {trueLabel}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${neutral ? "text-slate-400 bg-slate-50 ring-1 ring-slate-200" : "text-slate-500 bg-slate-50 ring-1 ring-slate-200"}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
      {falseLabel}
    </span>
  );
}
