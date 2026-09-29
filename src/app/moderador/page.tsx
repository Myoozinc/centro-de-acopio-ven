'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  LogOut,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  Phone,
  Globe,
  Package,
  AlertCircle,
  Loader2,
  RefreshCw,
  Eye,
  Bot,
} from 'lucide-react';
import type { CentroDeAcopio } from '@/types';

type AuthState = { role: 'moderador' | 'admin'; password: string } | null;

const COUNTRY_FLAGS: Record<string, string> = {
  Venezuela: '🇻🇪', Colombia: '🇨🇴', Perú: '🇵🇪', Chile: '🇨🇱',
  Ecuador: '🇪🇨', Brasil: '🇧🇷', Argentina: '🇦🇷', España: '🇪🇸',
  'Estados Unidos': '🇺🇸', México: '🇲🇽', Panamá: '🇵🇦',
  'República Dominicana': '🇩🇴', 'Trinidad y Tobago': '🇹🇹',
  Uruguay: '🇺🇾', Paraguay: '🇵🇾', Bolivia: '🇧🇴',
  Internacional: '🌎',
};

function getFlag(pais: string) {
  return COUNTRY_FLAGS[pais] || '🌍';
}

export default function ModeradorPage() {
  const [auth, setAuth] = useState<AuthState>(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [centers, setCenters] = useState<CentroDeAcopio[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // Restore session
  useEffect(() => {
    const stored = sessionStorage.getItem('mod_auth');
    if (stored) {
      try { setAuth(JSON.parse(stored)); } catch { /* empty */ }
    }
  }, []);

  const fetchPendientes = useCallback(async (pwd: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/centros?estado=pendiente', {
        headers: { 'x-auth-password': pwd },
      });
      const json = await res.json();
      setCenters(json.data || []);
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error al cargar centros pendientes.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth) fetchPendientes(auth.password);
  }, [auth, fetchPendientes]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (json.success) {
        const authData = { role: json.role, password };
        setAuth(authData);
        sessionStorage.setItem('mod_auth', JSON.stringify(authData));
      } else {
        setLoginError('Contraseña incorrecta. Intenta de nuevo.');
      }
    } catch {
      setLoginError('Error de conexión.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('mod_auth');
    setAuth(null);
    setCenters([]);
  };

  const handleAccion = async (id: string, estado: 'aprobado' | 'rechazado', notas?: string) => {
    if (!auth) return;
    setActionLoading(id + estado);
    try {
      const res = await fetch('/api/centros', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': auth.password,
        },
        body: JSON.stringify({ id, estado, notas_moderacion: notas }),
      });
      const json = await res.json();
      if (json.success) {
        setCenters((prev) => prev.filter((c) => c.id !== id));
        setMensaje({
          tipo: 'ok',
          texto: estado === 'aprobado' ? '✅ Centro aprobado y visible en el mapa.' : '❌ Centro rechazado.',
        });
        setTimeout(() => setMensaje(null), 3000);
      } else {
        setMensaje({ tipo: 'error', texto: json.error || 'Error al actualizar.' });
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión.' });
    } finally {
      setActionLoading(null);
    }
  };

  // ── LOGIN SCREEN ──────────────────────────────────────────────
  if (!auth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 mb-4 backdrop-blur-sm">
              <Shield className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-black text-white mb-1">Panel de Moderación</h1>
            <p className="text-slate-400 text-sm">Centros de Acopio — Emergencia Venezuela</p>
          </div>

          <form
            onSubmit={handleLogin}
            className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/60 rounded-2xl p-6 shadow-2xl"
          >
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Contraseña de acceso
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresa tu contraseña"
              autoFocus
              className="w-full bg-slate-900/60 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all mb-4"
            />
            {loginError && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {loginError}
              </div>
            )}
            <button
              type="submit"
              disabled={loginLoading || !password}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3 transition-all flex items-center justify-center gap-2"
            >
              {loginLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
              {loginLoading ? 'Verificando...' : 'Acceder'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── MAIN PANEL ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="font-black text-white text-sm leading-none">Panel de Moderación</h1>
              <p className="text-xs text-slate-400 capitalize">{auth.role}</p>
            </div>
            {centers.length > 0 && (
              <span className="ml-2 bg-amber-500 text-black text-xs font-black px-2 py-0.5 rounded-full animate-pulse">
                {centers.length} pendiente{centers.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchPendientes(auth.password)}
              disabled={loading}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              title="Recargar"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {auth.role === 'admin' && (
              <a
                href="/admin"
                className="flex items-center gap-1.5 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              >
                <Eye className="w-3.5 h-3.5" />
                Admin
              </a>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Toast */}
      {mensaje && (
        <div
          className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl border transition-all ${
            mensaje.tipo === 'ok'
              ? 'bg-emerald-900/90 border-emerald-700 text-emerald-300'
              : 'bg-red-900/90 border-red-700 text-red-300'
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
            <p className="text-slate-400">Cargando centros pendientes...</p>
          </div>
        ) : centers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="text-lg font-bold text-white">¡Todo al día!</p>
            <p className="text-slate-400 text-sm max-w-xs">
              No hay centros pendientes de revisión por ahora.
              Cuando alguien sugiera un nuevo centro aparecerá aquí.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">
              Revisa la información de cada centro antes de aprobarlo. Los centros aprobados aparecen en el mapa público inmediatamente.
            </p>

            {centers.map((centro) => (
              <CentroCard
                key={centro.id}
                centro={centro}
                actionLoading={actionLoading}
                onAprobar={(id) => handleAccion(id, 'aprobado')}
                onRechazar={(id) => handleAccion(id, 'rechazado', 'No verificado')}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function CentroCard({
  centro,
  actionLoading,
  onAprobar,
  onRechazar,
}: {
  centro: CentroDeAcopio;
  actionLoading: string | null;
  onAprobar: (id: string) => void;
  onRechazar: (id: string) => void;
}) {
  const isLoadingAprobar = actionLoading === centro.id + 'aprobado';
  const isLoadingRechazar = actionLoading === centro.id + 'rechazado';
  const isLoading = isLoadingAprobar || isLoadingRechazar;

  return (
    <div className="bg-slate-900/60 border border-slate-700/60 rounded-2xl overflow-hidden backdrop-blur-sm hover:border-slate-600/60 transition-all">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 bg-amber-400/10 border border-amber-400/30 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3" /> PENDIENTE
          </span>
          {centro.fuente === 'ia_gemini' && (
            <span className="text-violet-400 bg-violet-400/10 border border-violet-400/30 text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
              <Bot className="w-3 h-3" /> IA Gemini
            </span>
          )}
        </div>
        <span className="text-slate-500 text-xs">
          {new Date(centro.created_at).toLocaleDateString('es-VE', {
            day: '2-digit', month: 'short', year: 'numeric',
          })}
        </span>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Info */}
        <div className="md:col-span-2 space-y-3">
          <div>
            <h2 className="text-white font-bold text-base">{centro.responsable}</h2>
          </div>

          <div className="flex items-start gap-2 text-slate-300 text-sm">
            <Globe className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
            <span>
              {getFlag(centro.pais || 'Venezuela')} {centro.pais || 'Venezuela'}
              {centro.ciudad ? ` — ${centro.ciudad}` : ''}
            </span>
          </div>

          <div className="flex items-start gap-2 text-slate-300 text-sm">
            <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
            <span>{centro.direccion}</span>
          </div>

          {centro.telefono && (
            <div className="flex items-center gap-2 text-slate-300 text-sm">
              <Phone className="w-4 h-4 text-slate-500" />
              <span>{centro.telefono}</span>
            </div>
          )}

          {centro.suministros?.length > 0 && (
            <div className="flex items-start gap-2 text-slate-300 text-sm">
              <Package className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
              <div className="flex flex-wrap gap-1">
                {centro.suministros.map((s) => (
                  <span key={s} className="bg-slate-800 border border-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {centro.necesita?.length > 0 && (
            <div className="flex items-start gap-2 text-xs">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-amber-400 font-semibold">Necesita: </span>
                <span className="text-slate-400">{centro.necesita.join(', ')}</span>
              </div>
            </div>
          )}

          <div className="text-xs text-slate-600">
            Coordenadas: {centro.lat?.toFixed(4)}, {centro.lng?.toFixed(4)}
          </div>
        </div>

        {/* Actions */}
        <div className="flex md:flex-col gap-2 md:justify-center">
          <button
            onClick={() => onAprobar(centro.id)}
            disabled={isLoading}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all"
          >
            {isLoadingAprobar ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Aprobar
          </button>

          <button
            onClick={() => onRechazar(centro.id)}
            disabled={isLoading}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-900/50 hover:bg-red-900/80 border border-red-700/50 disabled:opacity-50 text-red-300 font-bold text-sm px-4 py-2.5 rounded-xl transition-all"
          >
            {isLoadingRechazar ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            Rechazar
          </button>
        </div>
      </div>
    </div>
  );
}
