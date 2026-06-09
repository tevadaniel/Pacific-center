'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Play, Pause, Square, X, FlaskConical, Loader2, Activity,
  CheckCircle2, XCircle, AlertTriangle, Trash2, Download, RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api, getSession } from '@/lib/auth-client';
import { SimulationEngine } from '@/lib/simulation-engine';

/**
 * 🧪 SESSION 47 — Simulation E2E Modal
 *
 * Modal plein-écran pour lancer une simulation complète du tunnel
 * d'inscription en attaquant les vraies API. Affiche un feed live des
 * appels, des KPIs temps réel, et un résumé final.
 */
export default function SimulationModal({ open, onClose }) {
  const [count, setCount] = useState(25);
  const [concurrency, setConcurrency] = useState(3);
  const [events, setEvents] = useState([]);
  const [progress, setProgress] = useState({
    total: 0, in_progress: 0, success: 0, abandoned: 0, waitlisted: 0, failed: 0,
    api_calls: 0, errors: [], by_site: {},
    by_step: { profile: 0, days: 0, stand: 0, animation: 0, finalize: 0 },
  });
  const [engineState, setEngineState] = useState('idle');
  const [summary, setSummary] = useState(null);
  const [simStatus, setSimStatus] = useState(null);
  const [cleaningUp, setCleaningUp] = useState(false);
  const engineRef = useRef(null);
  const feedRef = useRef(null);

  // Auto-scroll feed
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [events]);

  const loadStatus = useCallback(async () => {
    try {
      const s = await api('/api/admin/simulation/status');
      setSimStatus(s);
    } catch (e) {
      console.error('status', e);
    }
  }, []);

  useEffect(() => {
    if (open) loadStatus();
  }, [open, loadStatus]);

  const handleStart = async () => {
    if (engineRef.current && engineRef.current.state !== 'idle' && engineRef.current.state !== 'done' && engineRef.current.state !== 'stopped') {
      toast.error('Une simulation est déjà en cours');
      return;
    }
    setEvents([]);
    setSummary(null);
    const session = getSession();
    const headers = {};
    if (session?.role) headers['x-user-role'] = session.role;
    if (session?.user_id) headers['x-user-id'] = session.user_id;
    const engine = new SimulationEngine({
      count,
      concurrency,
      adminHeaders: headers,
      onEvent: (e) => setEvents(prev => [...prev.slice(-499), e]),
      onProgress: (p) => setProgress({ ...p }),
      onComplete: (s) => { setSummary(s); setEngineState('done'); loadStatus(); },
    });
    engineRef.current = engine;
    setEngineState('running');
    try {
      await engine.start();
    } catch (e) {
      toast.error(`Démarrage échoué : ${e.message}`);
      setEngineState('idle');
    }
  };

  const handlePause = () => {
    if (!engineRef.current) return;
    engineRef.current.pause();
    setEngineState('paused');
  };
  const handleResume = () => {
    if (!engineRef.current) return;
    engineRef.current.resume();
    setEngineState('running');
  };
  const handleStop = () => {
    if (!engineRef.current) return;
    engineRef.current.stop();
    setEngineState('stopped');
  };

  const handleCleanup = async () => {
    if (!confirm('🧹 Supprimer TOUS les exposants/inscriptions de simulation ?\n\nCette action est IRRÉVERSIBLE mais ne touche qu\'aux records is_simulation=true.')) return;
    setCleaningUp(true);
    try {
      const r = await api('/api/admin/simulation/cleanup', { method: 'POST', body: '{}' });
      toast.success(r.message || '✅ Nettoyage effectué');
      setSummary(null);
      setEvents([]);
      setProgress({
        total: 0, in_progress: 0, success: 0, abandoned: 0, waitlisted: 0, failed: 0,
        api_calls: 0, errors: [], by_site: {},
        by_step: { profile: 0, days: 0, stand: 0, animation: 0, finalize: 0 },
      });
      await loadStatus();
    } catch (e) { toast.error(e.message); }
    finally { setCleaningUp(false); }
  };

  // 🆕 SESSION 52g — Cleanup CIBLÉ : ne supprime que les simulations INCOMPLÈTES
  // (orphelins en provisoire / liste d'attente / abandonnés). Garde les sims réussies.
  const handleCleanupIncomplete = async () => {
    // Dry-run d'abord pour montrer ce qui sera supprimé
    setCleaningUp(true);
    try {
      const preview = await api('/api/admin/simulation/cleanup-incomplete', {
        method: 'POST',
        body: JSON.stringify({ dry_run: true }),
      });
      const count = preview?.would_delete?.registrations || 0;
      const orgs = preview?.would_delete?.organizations_candidate || 0;
      if (count === 0) {
        toast.success('✨ Aucune simulation incomplète à nettoyer.');
        return;
      }
      if (!confirm(`🧹 Supprimer ${count} simulation·s incomplète·s (brouillons / liste d'attente / abandons) ?\n\nLes simulations RÉUSSIES sont conservées.\nOrganisations candidates : ${orgs}`)) return;
      const r = await api('/api/admin/simulation/cleanup-incomplete', {
        method: 'POST',
        body: JSON.stringify({ dry_run: false }),
      });
      toast.success(r.message || '✅ Nettoyage ciblé effectué');
      await loadStatus();
    } catch (e) { toast.error(e.message); }
    finally { setCleaningUp(false); }
  };

  const handleExport = () => {
    if (!summary) return;
    const payload = { summary, events, exported_at: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simulation-${summary.session_id || Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('📥 Rapport exporté');
  };

  if (!open) return null;

  const isRunning = engineState === 'running';
  const isPaused = engineState === 'paused';
  const canStart = engineState === 'idle' || engineState === 'done' || engineState === 'stopped';
  const totalDone = progress.success + progress.abandoned + (progress.waitlisted || 0) + progress.failed;
  const progressPct = progress.total > 0 ? Math.round((totalDone / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-white shadow flex items-center justify-center">
              <FlaskConical className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">🧪 Simulation E2E — Test des fonctions réelles</h2>
              <p className="text-xs text-slate-600">
                Crée des exposants fictifs (préfixe <code className="bg-slate-100 px-1 rounded">[SIM]</code>) et exécute le tunnel 1→5. Emails redirigés vers <b>gerosteva@gmail.com</b>.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
          {/* Left col : Controls + KPIs + Per-site */}
          <div className="space-y-3 overflow-y-auto pr-1">
            {/* Controls */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" /> Contrôles</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-700">Nombre d&apos;exposants : <b>{count}</b></label>
                  <input type="range" min="5" max="100" step="5" value={count} disabled={isRunning || isPaused}
                    onChange={e => setCount(parseInt(e.target.value))}
                    className="w-full mt-1" />
                  <div className="flex justify-between text-[10px] text-slate-500"><span>5</span><span>50</span><span>100</span></div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Concurrence : <b>{concurrency}</b> en parallèle</label>
                  <input type="range" min="1" max="8" step="1" value={concurrency} disabled={isRunning || isPaused}
                    onChange={e => setConcurrency(parseInt(e.target.value))}
                    className="w-full mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {canStart && (
                    <Button onClick={handleStart} className="col-span-2 bg-indigo-600 hover:bg-indigo-700 gap-1.5" size="sm">
                      <Play className="w-4 h-4" /> Lancer la simulation
                    </Button>
                  )}
                  {isRunning && (
                    <>
                      <Button onClick={handlePause} variant="outline" className="gap-1.5" size="sm">
                        <Pause className="w-4 h-4" /> Pause
                      </Button>
                      <Button onClick={handleStop} variant="destructive" className="gap-1.5" size="sm">
                        <Square className="w-4 h-4" /> Stop
                      </Button>
                    </>
                  )}
                  {isPaused && (
                    <>
                      <Button onClick={handleResume} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5" size="sm">
                        <Play className="w-4 h-4" /> Reprendre
                      </Button>
                      <Button onClick={handleStop} variant="destructive" className="gap-1.5" size="sm">
                        <Square className="w-4 h-4" /> Stop
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* KPIs */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">📊 Statistiques temps réel</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <KpiTile label="Total" value={progress.total} color="slate" />
                  <KpiTile label="En cours" value={progress.in_progress} color="blue" />
                  <KpiTile label="Réussis" value={progress.success} color="emerald" icon={<CheckCircle2 className="w-3.5 h-3.5" />} />
                  <KpiTile label="Waitlist" value={progress.waitlisted || 0} color="violet" />
                  <KpiTile label="Abandons" value={progress.abandoned} color="amber" />
                  <KpiTile label="Erreurs" value={progress.failed} color="rose" icon={<XCircle className="w-3.5 h-3.5" />} />
                </div>
                {/* Progress bar */}
                {progress.total > 0 && (
                  <div className="pt-2">
                    <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                      <span>Progression</span>
                      <span><b>{totalDone}</b>/{progress.total} · {progressPct}%</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>
                )}
                {/* Par étape */}
                <div className="pt-2 space-y-1 text-[11px]">
                  <div className="font-medium text-slate-700">Par étape :</div>
                  {Object.entries(progress.by_step).map(([k, v]) => (
                    <div key={k} className="flex justify-between"><span className="capitalize">{k}</span><b>{v}</b></div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Per-site */}
            {Object.keys(progress.by_site).length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">🏢 Répartition par site</CardTitle></CardHeader>
                <CardContent className="space-y-1.5">
                  {Object.entries(progress.by_site).sort((a, b) => b[1] - a[1]).map(([venue, n]) => {
                    const max = Math.max(...Object.values(progress.by_site));
                    const pct = max > 0 ? (n / max) * 100 : 0;
                    return (
                      <div key={venue}>
                        <div className="flex justify-between text-[11px]"><span>{venue.replace('venue-', '')}</span><b>{n}</b></div>
                        <div className="h-1.5 bg-slate-200 rounded overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} /></div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Cleanup card */}
            <Card className="border-rose-200 bg-rose-50/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Trash2 className="w-4 h-4 text-rose-600" /> Nettoyage</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {simStatus && (
                  <div className="text-[11px] text-slate-700 space-y-0.5">
                    <div>Records en DB : <b>{simStatus.counts?.organizations || 0}</b> orgs, <b>{simStatus.counts?.registrations || 0}</b> regs, <b>{simStatus.counts?.animation_slots || 0}</b> animations</div>
                    {simStatus.simulation_active && (
                      <Badge variant="outline" className="bg-amber-100 border-amber-300 text-amber-800 text-[10px]">
                        ⚡ Simulation active · {simStatus.simulation_redirect}
                      </Badge>
                    )}
                  </div>
                )}
                <Button onClick={handleCleanupIncomplete} disabled={cleaningUp || isRunning} variant="outline" size="sm" className="w-full gap-1.5 border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900">
                  {cleaningUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>🧹</span>}
                  Nettoyer les simulations incomplètes (orphelins)
                </Button>
                <Button onClick={handleCleanup} disabled={cleaningUp || isRunning} variant="destructive" size="sm" className="w-full gap-1.5">
                  {cleaningUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Supprimer TOUS les records de simulation
                </Button>
              </CardContent>
            </Card>

            {/* Export */}
            {summary && (
              <Card className="border-emerald-200 bg-emerald-50/50">
                <CardContent className="p-3 space-y-2">
                  <div className="text-xs space-y-0.5">
                    <div>📈 Taux de conversion : <b>{summary.conversion_rate}%</b></div>
                    <div>⏱️ Durée : <b>{summary.duration_s.toFixed(1)}s</b></div>
                    {summary.stats.errors?.length > 0 && (
                      <div className="text-rose-700">❌ Erreurs détectées : <b>{summary.stats.errors.length}</b></div>
                    )}
                  </div>
                  <Button onClick={handleExport} size="sm" variant="outline" className="w-full gap-1.5">
                    <Download className="w-4 h-4" /> Exporter le rapport JSON
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right col : Live feed (spans 2) */}
          <div className="lg:col-span-2 flex flex-col">
            <div className="text-sm font-medium text-slate-700 mb-2 flex items-center justify-between">
              <span>📡 Feed live des événements ({events.length})</span>
              <Badge variant="outline" className={`text-[10px] ${
                isRunning ? 'bg-emerald-100 border-emerald-300 text-emerald-800' :
                isPaused ? 'bg-amber-100 border-amber-300 text-amber-800' :
                engineState === 'done' ? 'bg-indigo-100 border-indigo-300 text-indigo-800' :
                engineState === 'stopped' ? 'bg-rose-100 border-rose-300 text-rose-800' :
                'bg-slate-100 border-slate-300 text-slate-700'
              }`}>
                {engineState === 'idle' && '⚪ Inactif'}
                {engineState === 'running' && '🟢 En cours'}
                {engineState === 'paused' && '⏸ En pause'}
                {engineState === 'stopped' && '⏹ Arrêté'}
                {engineState === 'done' && '✅ Terminé'}
              </Badge>
            </div>
            <div ref={feedRef} className="flex-1 overflow-y-auto bg-slate-900 text-slate-100 font-mono text-[11px] rounded-lg p-3 space-y-1">
              {events.length === 0 && (
                <div className="text-slate-500 italic">En attente du démarrage de la simulation…</div>
              )}
              {events.map((e, i) => <EventLine key={i} event={e} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiTile({ label, value, color, icon }) {
  const colors = {
    slate: 'bg-slate-100 text-slate-800',
    blue: 'bg-blue-100 text-blue-800',
    emerald: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    rose: 'bg-rose-100 text-rose-800',
    violet: 'bg-violet-100 text-violet-800',
  };
  return (
    <div className={`rounded p-2 ${colors[color] || colors.slate}`}>
      <div className="flex items-center gap-1 text-[10px] font-medium opacity-80">{icon}{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function EventLine({ event }) {
  const t = event.timestamp?.slice(11, 19) || '';
  let color = 'text-slate-300';
  let prefix = '·';
  switch (event.type) {
    case 'state': color = 'text-cyan-300'; prefix = '⚙'; break;
    case 'start': color = 'text-blue-300'; prefix = '▶'; break;
    case 'api': color = 'text-emerald-300'; prefix = '→'; break;
    case 'success': color = 'text-emerald-400 font-bold'; prefix = '✓'; break;
    case 'abandon': color = 'text-amber-300'; prefix = '⊘'; break;
    case 'error': color = 'text-rose-400'; prefix = '✗'; break;
    case 'warn': color = 'text-orange-300'; prefix = '⚠'; break;
    case 'waitlist': color = 'text-violet-300'; prefix = '◷'; break;
  }
  return (
    <div className={`leading-tight ${color}`}>
      <span className="text-slate-500">[{t}]</span> {event.label ? <span className="text-slate-400">{event.label}</span> : null} {prefix} {event.message}
      {event.elapsed != null && <span className="text-slate-500"> · {event.elapsed}ms</span>}
    </div>
  );
}
