"use client";

import { useEffect, useState } from "react";

type Device = { id: string; name: string; created_at: string; last_seen_at: string | null; revoked_at: string | null };
type Job = { id: string; task_type: string; status: string; error: string | null; attempts: number; created_at: string };

export default function AgenteLocalMl() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [name, setName] = useState("Computador de casa");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    try {
      const [d, j] = await Promise.all([
        fetch("/api/admin/local-agent/devices", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/admin/local-agent/jobs", { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (d.sucesso) setDevices(d.dispositivos || []);
      if (j.sucesso) setJobs(j.tarefas || []);
    } catch {
      setError("Nao foi possivel atualizar o estado do agente local.");
    }
  }

  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, []);

  async function pair() {
    setLoading(true);
    setError("");
    setMessage("");
    setToken("");
    try {
      const response = await fetch("/api/admin/local-agent/devices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok || !data.sucesso) throw new Error(data.erro || "Falha ao parear.");
      setToken(data.token);
      setMessage("Computador pareado. Copie o token agora; ele nao sera exibido novamente.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao parear computador.");
    } finally {
      setLoading(false);
    }
  }

  async function revoke(id: string) {
    if (!window.confirm("Revogar este computador? Ele perdera acesso imediatamente.")) return;
    const response = await fetch("/api/admin/local-agent/devices/" + id, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok || !data.sucesso) setError(data.erro || "Falha ao revogar.");
    else setMessage("Computador revogado.");
    await refresh();
  }

  async function copyToken() {
    await navigator.clipboard.writeText(token);
    setMessage("Token copiado. Cole no .env.local do computador e nao compartilhe.");
  }

  return (
    <section className="mt-6 rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-black uppercase tracking-wider text-emerald-700">Agente local · Chrome do computador</p>
      <h2 className="mt-2 text-2xl font-black text-slate-950">Mercado Livre no teu navegador</h2>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
        O Chrome deste computador faz a coleta de cupons e a leitura de produtos. A sessao permanece local; o site recebe apenas os dados extraidos. Mantenha o computador ligado e o agente em execucao durante as tarefas.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3" placeholder="Nome do computador" />
        <button type="button" disabled={loading || !name.trim()} onClick={pair} className="rounded-xl bg-emerald-700 px-5 py-3 font-black text-white disabled:opacity-50">{loading ? "Pareando..." : "Parear este computador"}</button>
      </div>

      {token && (
        <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="font-black text-amber-900">Token mostrado uma unica vez</p>
          <code className="mt-2 block break-all rounded-lg bg-white p-3 text-xs">{token}</code>
          <button type="button" onClick={copyToken} className="mt-3 rounded-lg bg-amber-700 px-4 py-2 text-sm font-black text-white">Copiar token</button>
          <p className="mt-2 text-xs text-amber-900">Guarde somente no arquivo .env.local do computador. Nao cole no GitHub, mensagens ou no site.</p>
        </div>
      )}

      {message && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</p>}
      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4">
          <h3 className="font-black">Computadores pareados</h3>
          <div className="mt-3 space-y-3">
            {devices.length === 0 && <p className="text-sm text-slate-500">Nenhum computador pareado.</p>}
            {devices.map((device) => {
              const online = !device.revoked_at && !!device.last_seen_at && Date.now() - new Date(device.last_seen_at).getTime() < 45000;
              return <div key={device.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <div><p className="font-bold">{device.name}</p><p className={online ? "text-xs font-bold text-emerald-700" : "text-xs text-slate-500"}>{device.revoked_at ? "Revogado" : online ? "Online" : "Offline"}</p></div>
                {!device.revoked_at && <button type="button" onClick={() => revoke(device.id)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-black text-red-700">Revogar</button>}
              </div>;
            })}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <h3 className="font-black">Tarefas recentes</h3>
          <div className="mt-3 space-y-2">
            {jobs.length === 0 && <p className="text-sm text-slate-500">Nenhuma tarefa enviada.</p>}
            {jobs.slice(0, 6).map((job) => <div key={job.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex justify-between gap-2"><span className="text-sm font-bold">{job.task_type === "coupon_collect" ? "Coleta de cupons" : "Preparar produto"}</span><span className="text-xs font-black">{job.status}</span></div>
              {job.error && <p className="mt-1 text-xs text-red-700">{job.error}</p>}
            </div>)}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
        <p className="font-black">Depois de parear</p>
        <p className="mt-1">Adicione ACHADOS_LOCAL_AGENT_TOKEN ao .env.local com o token gerado e execute npm run ml:agent. O Chrome abre; entre no Mercado Livre uma vez. A partir dai, deixe o agente aberto para receber tarefas.</p>
      </div>
    </section>
  );
}
