import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import { useOrg } from "@/hooks/useOrg";

const LIKELIHOOD_LABELS = ["", "Rare", "Unlikely", "Possible", "Likely", "Almost Certain"];
const IMPACT_LABELS = ["", "Negligible", "Minor", "Moderate", "Major", "Critical"];
const RISK_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-green-100 text-green-700 border-green-200",
};
const RISK_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-400",
  low: "bg-green-500",
};

function riskLevel(score: number) {
  if (score >= 15) return "critical";
  if (score >= 9) return "high";
  if (score >= 4) return "medium";
  return "low";
}

function riskScore(l: number, i: number) { return l * i; }

const CATEGORIES = [
  "access_control","application_security","asset_management","audit_logging",
  "business_continuity","change_management","compliance","configuration_management",
  "data_protection","governance","human_resources","incident_response",
  "network_security","operational","physical_security","third_party",
  "vulnerability_management","other"
];
const CATEGORY_LABELS: Record<string, string> = {
  access_control: "Access Control", application_security: "Application Security",
  asset_management: "Asset Management", audit_logging: "Audit & Logging",
  business_continuity: "Business Continuity", change_management: "Change Management",
  compliance: "Compliance", configuration_management: "Configuration Mgmt",
  data_protection: "Data Protection", governance: "Governance",
  human_resources: "Human Resources", incident_response: "Incident Response",
  network_security: "Network Security", operational: "Operational",
  physical_security: "Physical Security", third_party: "Third Party / Supply Chain",
  vulnerability_management: "Vulnerability Mgmt", other: "Other"
};

function RiskHeatMap({ risks }: { risks: any[] }) {
  const cells: Record<string, any[]> = {};
  risks.forEach((r) => {
    const key = `${r.likelihood}-${r.impact}`;
    if (!cells[key]) cells[key] = [];
    cells[key].push(r);
  });
  const cellColor = (l: number, i: number) => {
    const s = l * i;
    if (s >= 15) return "bg-red-500";
    if (s >= 9) return "bg-orange-400";
    if (s >= 4) return "bg-yellow-300";
    return "bg-green-300";
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-slate-800">Risk Heat Map</p>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-300 inline-block" />Low</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-300 inline-block" />Medium</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-orange-400 inline-block" />High</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" />Critical</span>
        </div>
      </div>
      <div className="relative">
        <div className="text-xs text-slate-500 text-center mb-1">Impact →</div>
        <div className="flex">
          <div className="flex flex-col justify-center items-center w-6 mr-1">
            <span className="text-xs text-slate-500 -rotate-90 whitespace-nowrap" style={{writingMode:'vertical-rl'}}>Likelihood ↑</span>
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-5 gap-0.5 mb-0.5">
              {[1,2,3,4,5].map(i => <div key={i} className="text-center text-xs text-slate-400 pb-0.5">{IMPACT_LABELS[i].slice(0,3)}</div>)}
            </div>
            {[5,4,3,2,1].map(l => (
              <div key={l} className="flex gap-0.5 mb-0.5 items-center">
                <span className="text-xs text-slate-400 w-16 text-right pr-1">{LIKELIHOOD_LABELS[l].slice(0,4)}</span>
                {[1,2,3,4,5].map(i => {
                  const key = `${l}-${i}`;
                  const count = cells[key]?.length ?? 0;
                  return (
                    <div key={i} className={`${cellColor(l,i)} rounded flex items-center justify-center text-xs font-bold text-white w-9 h-9 cursor-default transition-transform hover:scale-110`}
                      title={count > 0 ? cells[key].map((r:any)=>r.title).join(', ') : 'No risks'}>
                      {count > 0 ? count : <span className="text-white/40">{l*i}</span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-2 text-center">Numbers in cells = risk count. Hover for details.</p>
    </div>
  );
}

function RiskAppetiteBar({ risks }: { risks: any[] }) {
  const critical = risks.filter(r => riskLevel(riskScore(r.likelihood, r.impact)) === 'critical').length;
  const high = risks.filter(r => riskLevel(riskScore(r.likelihood, r.impact)) === 'high').length;
  const mitigated = risks.filter(r => r.status === 'mitigated' || r.status === 'closed').length;
  const appetiteScore = Math.max(0, 100 - (critical * 20) - (high * 8) + (mitigated * 5));
  const color = appetiteScore >= 80 ? 'bg-green-500' : appetiteScore >= 60 ? 'bg-yellow-400' : 'bg-red-500';
  const label = appetiteScore >= 80 ? 'Within Risk Appetite' : appetiteScore >= 60 ? 'Approaching Threshold' : 'Exceeds Risk Appetite';
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-slate-800">Risk Appetite</p>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${appetiteScore >= 80 ? 'bg-green-100 text-green-700' : appetiteScore >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{label}</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-3 mb-1">
        <div className={`${color} h-3 rounded-full transition-all`} style={{width: appetiteScore + '%'}} />
      </div>
      <div className="flex justify-between text-xs text-slate-500">
        <span>Risk Posture Score: {appetiteScore}/100</span>
        <span>{critical} critical · {high} high · {mitigated} mitigated</span>
      </div>
    </div>
  );
}
const EMPTY_RISK = { title:'', description:'', category:'operational', likelihood:3, impact:3, treatment:'mitigate', treatment_plan:'', owner_name:'', owner_email:'', related_control_id:'' };
const EMPTY_EXCEPTION = { title:'', description:'', exception_type:'risk_acceptance', business_justification:'', compensating_controls:'', residual_risk:'medium', expires_at:'', requested_by:'' };

export default function RiskRegister() {
  const { orgId } = useOrg();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'risks'|'exceptions'|'calendar'>('risks');
  const [showForm, setShowForm] = useState(false);
  const [showExcForm, setShowExcForm] = useState(false);
  const [editRisk, setEditRisk] = useState<any>(null);
  const [viewRisk, setViewRisk] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY_RISK);
  const [excForm, setExcForm] = useState<any>(EMPTY_EXCEPTION);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterTreatment, setFilterTreatment] = useState('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showBulk, setShowBulk] = useState(false);

  const { data: risksData, isLoading } = useQuery({
    queryKey: ['risks', orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/risks`),
    enabled: !!orgId,
  });
  const risks: any[] = Array.isArray(risksData) ? risksData : (risksData as any)?.risks ?? [];

  const { data: excData } = useQuery({
    queryKey: ['exceptions', orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/exceptions`).catch(()=>[]),
    enabled: !!orgId,
  });
  const exceptions: any[] = Array.isArray(excData) ? excData : (excData as any)?.exceptions ?? [];

  const { data: calData } = useQuery({
    queryKey: ['calendar', orgId],
    queryFn: () => apiFetch(`/orgs/${orgId}/compliance-calendar`).catch(()=>[]),
    enabled: !!orgId,
  });
  const calendar: any[] = Array.isArray(calData) ? calData : (calData as any)?.events ?? [];

  const createRisk = useMutation({
    mutationFn: (data: any) => apiFetch(`/orgs/${orgId}/risks`, { method:'POST', body:JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({queryKey:['risks',orgId]}); setShowForm(false); setForm(EMPTY_RISK); setEditRisk(null); },
  });
  const updateRisk = useMutation({
    mutationFn: ({id,data}: any) => apiFetch(`/orgs/${orgId}/risks/${id}`, { method:'PATCH', body:JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({queryKey:['risks',orgId]}); setShowForm(false); setEditRisk(null); setViewRisk(null); },
  });
  const deleteRisk = useMutation({
    mutationFn: (id: number) => apiFetch(`/orgs/${orgId}/risks/${id}`, { method:'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({queryKey:['risks',orgId]}); setViewRisk(null); },
  });
  const createException = useMutation({
    mutationFn: (data: any) => apiFetch(`/orgs/${orgId}/exceptions`, { method:'POST', body:JSON.stringify(data) }).catch(()=>({})),
    onSuccess: () => { qc.invalidateQueries({queryKey:['exceptions',orgId]}); setShowExcForm(false); setExcForm(EMPTY_EXCEPTION); },
  });

  const filteredRisks = (risks as any[]).filter((r: any) => {
    if (search && !r.title?.toLowerCase().includes(search.toLowerCase()) && !r.description?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCat !== 'all' && r.category !== filterCat) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    const lvl = riskLevel(riskScore(r.likelihood??1, r.impact??1));
    if (filterSeverity !== 'all' && lvl !== filterSeverity) return false;
    if (filterTreatment !== 'all' && r.treatment !== filterTreatment) return false;
    return true;
  });

  const criticalCount = (risks as any[]).filter((r:any)=>riskLevel(riskScore(r.likelihood,r.impact))==='critical').length;
  const highCount = (risks as any[]).filter((r:any)=>riskLevel(riskScore(r.likelihood,r.impact))==='high').length;
  const openCount = (risks as any[]).filter((r:any)=>r.status==='open').length;
  const mitigatedCount = (risks as any[]).filter((r:any)=>r.status==='mitigated'||r.status==='closed').length;

  function exportCSV() {
    const rows = filteredRisks.map((r:any)=>
      [`"${r.title}"`,CATEGORY_LABELS[r.category]??r.category,r.likelihood,r.impact,riskScore(r.likelihood,r.impact),riskLevel(riskScore(r.likelihood,r.impact)),r.treatment,r.status,r.owner_name||''].join(',')
    );
    const csv = 'Title,Category,Likelihood,Impact,Score,Level,Treatment,Status,Owner\n' + rows.join('\n');
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'risk-register.csv'; a.click();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const score = riskScore(Number(form.likelihood), Number(form.impact));
    const rl = Math.max(1, Number(form.likelihood)-1); const ri = Math.max(1, Number(form.impact)-1);
    const data = {...form, likelihood:Number(form.likelihood), impact:Number(form.impact), inherent_score:score, residual_likelihood:rl, residual_impact:ri, residual_score:rl*ri};
    if (editRisk) updateRisk.mutate({id:editRisk.id, data});
    else createRisk.mutate(data);
  }

  const toggleSelect = (id: number) => setSelectedIds(s => s.includes(id) ? s.filter(x=>x!==id) : [...s, id]);
  const selectAll = () => setSelectedIds(filteredRisks.map((r:any)=>r.id));
  const clearSelect = () => setSelectedIds([]);

  const calendarItems = (calendar as any[]).sort((a:any,b:any)=>new Date(a.due_date).getTime()-new Date(b.due_date).getTime());
  const overdueCal = calendarItems.filter((e:any)=>new Date(e.due_date)<new Date()&&e.status==='upcoming');
  const upcomingCal = calendarItems.filter((e:any)=>new Date(e.due_date)>=new Date()&&e.status==='upcoming');

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Risk Register</h1>
          <p className="text-slate-500 text-sm mt-0.5">ISO 31000 / NIST SP 800-30 methodology - 5x5 risk matrix</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Export CSV
          </button>
          <button onClick={()=>setShowExcForm(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-orange-200 text-orange-700 bg-orange-50 rounded-lg hover:bg-orange-100">
            + Exception
          </button>
          <button onClick={()=>{setEditRisk(null);setForm(EMPTY_RISK);setShowForm(true);}} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            + Add Risk
          </button>
        </div>
      </div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          {label:'Total Risks', val:(risks as any[]).length, color:'text-slate-800', bg:'bg-slate-50'},
          {label:'Critical', val:criticalCount, color:'text-red-700', bg:'bg-red-50'},
          {label:'High', val:highCount, color:'text-orange-700', bg:'bg-orange-50'},
          {label:'Open', val:openCount, color:'text-blue-700', bg:'bg-blue-50'},
          {label:'Mitigated', val:mitigatedCount, color:'text-green-700', bg:'bg-green-50'},
        ].map(c=>(
          <div key={c.label} className={`${c.bg} rounded-xl p-4 border border-slate-200`}>
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className={`text-3xl font-bold mt-1 ${c.color}`}>{c.val}</p>
          </div>
        ))}
      </div>

      {/* Risk Appetite bar */}
      <RiskAppetiteBar risks={risks as any[]} />

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {(['risks','exceptions','calendar'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab===t?'bg-white shadow text-slate-900':'text-slate-500 hover:text-slate-700'}`}>
            {t==='risks'?'Risk Register':t==='exceptions'?'Exceptions & Waivers':'Compliance Calendar'}
            {t==='exceptions'&&(exceptions as any[]).length>0&&<span className="ml-1.5 bg-orange-100 text-orange-700 text-xs px-1.5 rounded-full">{(exceptions as any[]).length}</span>}
            {t==='calendar'&&overdueCal.length>0&&<span className="ml-1.5 bg-red-100 text-red-700 text-xs px-1.5 rounded-full">{overdueCal.length}</span>}
          </button>
        ))}
      </div>

      {/* RISK REGISTER TAB */}
      {tab==='risks'&&<>
        {/* Heat map + filters row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2"><RiskHeatMap risks={filteredRisks}/></div>
          <div className="space-y-3">
            <input placeholder="Search risks..." value={search} onChange={e=>setSearch(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            <select value={filterSeverity} onChange={e=>setFilterSeverity(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="all">All Severity Levels</option>
              <option value="critical">Critical</option><option value="high">High</option>
              <option value="medium">Medium</option><option value="low">Low</option>
            </select>
            <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="all">All Categories</option>
              {CATEGORIES.map(c=><option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
            <select value={filterTreatment} onChange={e=>setFilterTreatment(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="all">All Treatments</option>
              <option value="mitigate">Mitigate</option><option value="accept">Accept</option>
              <option value="transfer">Transfer</option><option value="avoid">Avoid</option>
            </select>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="all">All Statuses</option>
              <option value="open">Open</option><option value="in_progress">In Progress</option>
              <option value="mitigated">Mitigated</option><option value="accepted">Accepted</option><option value="closed">Closed</option>
            </select>
            {selectedIds.length>0&&(
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-medium text-blue-800 mb-2">{selectedIds.length} selected</p>
                <div className="flex gap-2">
                  <button onClick={()=>{selectedIds.forEach(id=>updateRisk.mutate({id,data:{status:'mitigated'}}));clearSelect();}} className="text-xs bg-green-600 text-white px-2 py-1 rounded">Mark Mitigated</button>
                  <button onClick={()=>{selectedIds.forEach(id=>updateRisk.mutate({id,data:{status:'accepted'}}));clearSelect();}} className="text-xs bg-orange-500 text-white px-2 py-1 rounded">Accept Risk</button>
                  <button onClick={async ()=>{if(!confirm(`Delete ${selectedIds.length} risk${selectedIds.length!==1?'s':''}? This cannot be undone.`))return;await apiFetch(`/orgs/${orgId}/risks/bulk-delete`,{method:'POST',body:JSON.stringify({ids:selectedIds})});qc.invalidateQueries({queryKey:['risks',orgId]});clearSelect();}} className="text-xs bg-red-600 text-white px-2 py-1 rounded">Delete selected</button>
                  <button onClick={clearSelect} className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded">Clear</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Risks table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={selectedIds.length===filteredRisks.length&&filteredRisks.length>0} onChange={e=>e.target.checked?selectAll():clearSelect()} className="rounded"/>
              <p className="text-sm text-slate-500">{filteredRisks.length} risks</p>
            </div>
            <p className="text-xs text-slate-400">Click row to view details · Hover score for residual risk</p>
          </div>
          {isLoading&&<div className="p-8 text-center text-slate-400">Loading risks...</div>}
          {!isLoading&&filteredRisks.length===0&&(
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">⚠️</div>
              <p className="text-slate-600 font-medium">No risks found</p>
              <p className="text-slate-400 text-sm mt-1">Adjust filters or add your first risk</p>
              <button onClick={()=>setShowForm(true)} className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">Add First Risk</button>
            </div>
          )}
          {filteredRisks.map((r:any)=>{
            const score = riskScore(r.likelihood??1, r.impact??1);
            const lvl = riskLevel(score);
            const residualScore = riskScore(r.residual_likelihood??1, r.residual_impact??1);
            const residualLvl = riskLevel(residualScore);
            return (
              <div key={r.id} onClick={()=>setViewRisk(r)} className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer group">
                <input type="checkbox" checked={selectedIds.includes(r.id)} onClick={e=>e.stopPropagation()} onChange={()=>toggleSelect(r.id)} className="rounded flex-shrink-0"/>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${RISK_DOT[lvl]}`}/>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{r.title}</p>
                  <p className="text-xs text-slate-400">{CATEGORY_LABELS[r.category]??r.category} · {r.owner_name||'Unassigned'}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div title={`Residual: ${residualLvl} (${residualScore})`} className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${RISK_COLORS[lvl]}`}>
                    {lvl.charAt(0).toUpperCase()+lvl.slice(1)} ({score})
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${r.treatment==='mitigate'?'bg-blue-50 text-blue-700':r.treatment==='accept'?'bg-orange-50 text-orange-700':r.treatment==='transfer'?'bg-purple-50 text-purple-700':'bg-slate-100 text-slate-600'}`}>
                    {r.treatment?.charAt(0).toUpperCase()+(r.treatment?.slice(1)||'')}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${r.status==='open'?'bg-red-50 text-red-700':r.status==='mitigated'||r.status==='closed'?'bg-green-50 text-green-700':r.status==='in_progress'?'bg-blue-50 text-blue-700':'bg-slate-100 text-slate-600'}`}>
                    {r.status?.replace('_',' ')?.charAt(0).toUpperCase()+(r.status?.replace('_',' ')?.slice(1)||'')}
                  </span>
                  <button onClick={e=>{e.stopPropagation();setEditRisk(r);setForm({title:r.title,description:r.description||'',category:r.category,likelihood:r.likelihood,impact:r.impact,treatment:r.treatment,treatment_plan:r.treatment_plan||'',owner_name:r.owner_name||'',owner_email:r.owner_email||'',related_control_id:r.related_control_id||''});setShowForm(true);}} className="text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 text-xs">Edit</button>
                </div>
              </div>
            );
          })}
        </div>
      </>}
      {/* EXCEPTIONS TAB */}
      {tab==='exceptions'&&<>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Exceptions & Waivers</h2>
            <p className="text-sm text-slate-500">Formal risk acceptances, compensating controls, and time-limited waivers</p>
          </div>
          <button onClick={()=>setShowExcForm(true)} className="px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700">+ New Exception</button>
        </div>
        {(exceptions as any[]).length===0&&(
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-slate-600 font-medium">No exceptions or waivers</p>
            <p className="text-slate-400 text-sm mt-1">When a control cannot be fully implemented, document a formal exception with business justification and expiry date.</p>
            <button onClick={()=>setShowExcForm(true)} className="mt-4 px-4 py-2 bg-orange-600 text-white text-sm rounded-lg">Create First Exception</button>
          </div>
        )}
        <div className="space-y-3">
          {(exceptions as any[]).map((exc:any)=>{
            const expired = exc.expires_at && new Date(exc.expires_at)<new Date();
            const expiringSoon = exc.expires_at && !expired && (new Date(exc.expires_at).getTime()-Date.now())<30*86400000;
            return (
              <div key={exc.id} className={`bg-white border rounded-xl p-4 ${expired?'border-red-200 bg-red-50':expiringSoon?'border-orange-200 bg-orange-50':'border-slate-200'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-slate-800">{exc.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${exc.status==='approved'?'bg-green-100 text-green-700':exc.status==='pending'?'bg-yellow-100 text-yellow-700':exc.status==='rejected'?'bg-red-100 text-red-700':'bg-slate-100 text-slate-600'}`}>
                        {exc.status?.charAt(0).toUpperCase()+(exc.status?.slice(1)||'')}
                      </span>
                      {expired&&<span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">EXPIRED</span>}
                      {expiringSoon&&<span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Expiring Soon</span>}
                    </div>
                    <p className="text-sm text-slate-600 mb-2">{exc.description}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div><p className="text-slate-400">Exception Type</p><p className="font-medium text-slate-700">{exc.exception_type?.replace(/_/g,' ')?.charAt(0).toUpperCase()+(exc.exception_type?.replace(/_/g,' ')?.slice(1)||'')}</p></div>
                      <div><p className="text-slate-400">Residual Risk</p><p className={`font-medium ${exc.residual_risk==='high'?'text-red-600':exc.residual_risk==='medium'?'text-orange-600':'text-green-600'}`}>{exc.residual_risk?.charAt(0).toUpperCase()+(exc.residual_risk?.slice(1)||'')}</p></div>
                      <div><p className="text-slate-400">Requested By</p><p className="font-medium text-slate-700">{exc.requested_by||'—'}</p></div>
                      <div><p className="text-slate-400">Expires</p><p className={`font-medium ${expired?'text-red-600':expiringSoon?'text-orange-600':'text-slate-700'}`}>{exc.expires_at?new Date(exc.expires_at).toLocaleDateString():'No expiry'}</p></div>
                    </div>
                    {exc.business_justification&&<div className="mt-2 bg-slate-50 rounded p-2 text-xs text-slate-600"><span className="font-medium">Justification: </span>{exc.business_justification}</div>}
                    {exc.compensating_controls&&<div className="mt-1 bg-slate-50 rounded p-2 text-xs text-slate-600"><span className="font-medium">Compensating Controls: </span>{exc.compensating_controls}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <p className="font-semibold mb-1">Exception Management Best Practices</p>
          <ul className="space-y-1 text-xs text-blue-700 list-disc list-inside">
            <li>All exceptions require documented business justification and executive approval</li>
            <li>Maximum exception duration is 12 months - all exceptions must be reviewed annually</li>
            <li>Compensating controls must be implemented and documented for all accepted risks</li>
            <li>Exceptions approaching expiry are flagged 30 days before the deadline</li>
            <li>Expired exceptions are escalated to the CISO and risk committee automatically</li>
          </ul>
        </div>
      </>}

      {/* COMPLIANCE CALENDAR TAB */}
      {tab==='calendar'&&<>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Compliance Calendar</h2>
          <p className="text-sm text-slate-500">{calendarItems.length} scheduled compliance events · {overdueCal.length} overdue</p>
        </div>
        {overdueCal.length>0&&(
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-red-800 mb-2">🚨 Overdue Events ({overdueCal.length})</p>
            <div className="space-y-2">
              {overdueCal.map((e:any)=>(
                <div key={e.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-red-100">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{e.title}</p>
                    <p className="text-xs text-red-600">Was due {new Date(e.due_date).toLocaleDateString()} · {e.event_type?.replace('_',' ')}</p>
                  </div>
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Overdue</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-3">
          {upcomingCal.map((e:any)=>{
            const daysUntil = Math.ceil((new Date(e.due_date).getTime()-Date.now())/86400000);
            const urgent = daysUntil<=14;
            const soon = daysUntil<=30;
            const typeIcon: Record<string,string> = { review:'📋', audit:'🔍', assessment:'📊', report:'📄', access_review:'👥', vendor_review:'🏢', training:'🎓', test:'🧪' };
            return (
              <div key={e.id} className={`bg-white border rounded-xl p-4 ${urgent?'border-orange-200':soon?'border-yellow-200':'border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{typeIcon[e.event_type]||'📅'}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{e.title}</p>
                      <p className="text-xs text-slate-500">{e.description}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-semibold ${urgent?'text-orange-700':soon?'text-yellow-700':'text-slate-700'}`}>
                      {daysUntil===0?'Today':daysUntil===1?'Tomorrow':`In ${daysUntil} days`}
                    </p>
                    <p className="text-xs text-slate-400">{new Date(e.due_date).toLocaleDateString()}</p>
                    <div className="flex gap-1 mt-1 justify-end">
                      {e.framework_key&&<span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{e.framework_key.toUpperCase()}</span>}
                      <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{e.recurrence}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {upcomingCal.length===0&&calendarItems.length===0&&(
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <div className="text-4xl mb-3">📅</div>
              <p className="text-slate-600 font-medium">No compliance events scheduled</p>
              <p className="text-slate-400 text-sm mt-1">Compliance calendar events are auto-generated based on your active frameworks and policies.</p>
            </div>
          )}
        </div>
      </>}
      {/* RISK DETAIL MODAL */}
      {viewRisk&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={()=>setViewRisk(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-3 h-3 rounded-full ${RISK_DOT[riskLevel(riskScore(viewRisk.likelihood,viewRisk.impact))]}`}/>
                  <h2 className="text-lg font-bold text-slate-900">{viewRisk.title}</h2>
                </div>
                <p className="text-sm text-slate-500">{CATEGORY_LABELS[viewRisk.category]??viewRisk.category}</p>
              </div>
              <button onClick={()=>setViewRisk(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-700">{viewRisk.description}</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  {label:'Inherent Risk', score:riskScore(viewRisk.likelihood,viewRisk.impact), lvl:riskLevel(riskScore(viewRisk.likelihood,viewRisk.impact))},
                  {label:'Residual Risk', score:riskScore(viewRisk.residual_likelihood||1,viewRisk.residual_impact||1), lvl:riskLevel(riskScore(viewRisk.residual_likelihood||1,viewRisk.residual_impact||1))},
                  {label:'Target Risk', score:riskScore(Math.max(1,viewRisk.likelihood-2),Math.max(1,viewRisk.impact-2)), lvl:riskLevel(riskScore(Math.max(1,viewRisk.likelihood-2),Math.max(1,viewRisk.impact-2)))},
                ].map(rs=>(
                  <div key={rs.label} className={`rounded-xl p-3 border ${RISK_COLORS[rs.lvl]}`}>
                    <p className="text-xs mb-1">{rs.label}</p>
                    <p className="text-2xl font-bold">{rs.score}</p>
                    <p className="text-xs font-medium">{rs.lvl.charAt(0).toUpperCase()+rs.lvl.slice(1)}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-slate-400">Likelihood</p><p className="font-medium">{viewRisk.likelihood} - {LIKELIHOOD_LABELS[viewRisk.likelihood]||''}</p></div>
                <div><p className="text-xs text-slate-400">Impact</p><p className="font-medium">{viewRisk.impact} - {IMPACT_LABELS[viewRisk.impact]||''}</p></div>
                <div><p className="text-xs text-slate-400">Treatment Strategy</p><p className="font-medium capitalize">{viewRisk.treatment}</p></div>
                <div><p className="text-xs text-slate-400">Status</p><p className={`font-medium capitalize ${viewRisk.status==='open'?'text-red-600':viewRisk.status==='mitigated'?'text-green-600':'text-slate-700'}`}>{viewRisk.status?.replace('_',' ')}</p></div>
                <div><p className="text-xs text-slate-400">Risk Owner</p><p className="font-medium">{viewRisk.owner_name||'Unassigned'}</p></div>
                <div><p className="text-xs text-slate-400">Related Control</p><p className="font-medium">{viewRisk.related_control_id||'None'}</p></div>
              </div>
              {viewRisk.treatment_plan&&<div className="bg-slate-50 rounded-xl p-4"><p className="text-xs text-slate-400 mb-1 font-medium">Treatment Plan</p><p className="text-sm text-slate-700">{viewRisk.treatment_plan}</p></div>}
              <div className="flex gap-2 pt-2">
                <button onClick={()=>{setEditRisk(viewRisk);setForm({title:viewRisk.title,description:viewRisk.description||'',category:viewRisk.category,likelihood:viewRisk.likelihood,impact:viewRisk.impact,treatment:viewRisk.treatment,treatment_plan:viewRisk.treatment_plan||'',owner_name:viewRisk.owner_name||'',owner_email:viewRisk.owner_email||'',related_control_id:viewRisk.related_control_id||''});setShowForm(true);setViewRisk(null);}} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50">Edit Risk</button>
                <button onClick={()=>updateRisk.mutate({id:viewRisk.id,data:{status:'mitigated'}})} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Mark Mitigated</button>
                <button onClick={()=>{if(confirm('Delete this risk?'))deleteRisk.mutate(viewRisk.id);}} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT RISK MODAL */}
      {showForm&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={()=>setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">{editRisk?'Edit Risk':'Add New Risk'}</h2>
              <button onClick={()=>setShowForm(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Risk Title *</label>
                <input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Inadequate MFA enforcement" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                  <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    {CATEGORIES.map(c=><option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Treatment Strategy</label>
                  <select value={form.treatment} onChange={e=>setForm({...form,treatment:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="mitigate">Mitigate</option><option value="accept">Accept</option>
                    <option value="transfer">Transfer</option><option value="avoid">Avoid</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Likelihood (1-5): {LIKELIHOOD_LABELS[form.likelihood]||''}</label>
                  <input type="range" min={1} max={5} value={form.likelihood} onChange={e=>setForm({...form,likelihood:Number(e.target.value)})} className="w-full accent-blue-600"/>
                  <div className="flex justify-between text-xs text-slate-400"><span>Rare</span><span>Almost Certain</span></div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Impact (1-5): {IMPACT_LABELS[form.impact]||''}</label>
                  <input type="range" min={1} max={5} value={form.impact} onChange={e=>setForm({...form,impact:Number(e.target.value)})} className="w-full accent-blue-600"/>
                  <div className="flex justify-between text-xs text-slate-400"><span>Negligible</span><span>Critical</span></div>
                </div>
              </div>
              <div className={`text-center py-2 rounded-lg border font-semibold text-sm ${RISK_COLORS[riskLevel(riskScore(form.likelihood,form.impact))]}`}>
                Risk Score: {riskScore(Number(form.likelihood),Number(form.impact))} - {riskLevel(riskScore(Number(form.likelihood),Number(form.impact))).charAt(0).toUpperCase()+riskLevel(riskScore(Number(form.likelihood),Number(form.impact))).slice(1)}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Treatment Plan</label>
                <textarea value={form.treatment_plan} onChange={e=>setForm({...form,treatment_plan:e.target.value})} rows={3} placeholder="Detail the steps being taken to address this risk..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Risk Owner</label>
                  <input value={form.owner_name} onChange={e=>setForm({...form,owner_name:e.target.value})} placeholder="e.g. CISO" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Related Control ID</label>
                  <input value={form.related_control_id} onChange={e=>setForm({...form,related_control_id:e.target.value})} placeholder="e.g. UCO-AC-001" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={()=>setShowForm(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={createRisk.isPending||updateRisk.isPending} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {createRisk.isPending||updateRisk.isPending?'Saving...':editRisk?'Update Risk':'Add Risk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXCEPTION FORM MODAL */}
      {showExcForm&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={()=>setShowExcForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">New Exception / Waiver</h2>
                <p className="text-sm text-slate-500">Document a formal risk acceptance or compensating control</p>
              </div>
              <button onClick={()=>setShowExcForm(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <form onSubmit={e=>{e.preventDefault();createException.mutate(excForm);}} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Exception Title *</label>
                <input required value={excForm.title} onChange={e=>setExcForm({...excForm,title:e.target.value})} placeholder="e.g. MFA exception for legacy system" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description *</label>
                <textarea required value={excForm.description} onChange={e=>setExcForm({...excForm,description:e.target.value})} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Exception Type</label>
                  <select value={excForm.exception_type} onChange={e=>setExcForm({...excForm,exception_type:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="risk_acceptance">Risk Acceptance</option>
                    <option value="compensating_control">Compensating Control</option>
                    <option value="time_limited_waiver">Time-Limited Waiver</option>
                    <option value="policy_exception">Policy Exception</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Residual Risk</label>
                  <select value={excForm.residual_risk} onChange={e=>setExcForm({...excForm,residual_risk:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="low">Low</option><option value="medium">Medium</option>
                    <option value="high">High</option><option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Business Justification *</label>
                <textarea required value={excForm.business_justification} onChange={e=>setExcForm({...excForm,business_justification:e.target.value})} rows={3} placeholder="Explain why this exception is necessary and what business need it serves..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Compensating Controls</label>
                <textarea value={excForm.compensating_controls} onChange={e=>setExcForm({...excForm,compensating_controls:e.target.value})} rows={2} placeholder="List any compensating controls in place to reduce risk while the exception is active..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Requested By *</label>
                  <input required value={excForm.requested_by} onChange={e=>setExcForm({...excForm,requested_by:e.target.value})} placeholder="Name / Email" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Expiry Date *</label>
                  <input required type="date" value={excForm.expires_at} onChange={e=>setExcForm({...excForm,expires_at:e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={()=>setShowExcForm(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={createException.isPending} className="flex-1 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium">
                  {createException.isPending?'Submitting...':'Submit Exception'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
