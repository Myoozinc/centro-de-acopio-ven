'use client';

import { useState, useEffect } from 'react';
import {
  Shield, LogOut, CheckCircle, XCircle, Clock, MapPin, Phone,
  Globe, Package, AlertCircle, Loader2, RefreshCw, BarChart3,
  MessageSquare, Bot, Users, ArrowRight, Plane, Link,
  Calendar, Search, Download, Filter, ChevronLeft, ChevronRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { CentroDeAcopio } from '@/types';

function formatRelativeTime(dateString?: string) {
  if (!dateString) return 'Desconocido';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.round(diffMs / 60000);

    if (diffMin < 1) return 'Hace unos momentos';
    if (diffMin < 60) return `Hace ${diffMin} ${diffMin === 1 ? 'min' : 'mins'}`;

    const diffHours = Math.round(diffMin / 60);
    if (diffHours < 24) return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;

    const diffDays = Math.round(diffHours / 24);
    return `Hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
  } catch {
    return 'Hace un tiempo';
  }
}

function getFreshnessLevel(dateString?: string): { level: 'recent' | 'normal' | 'outdated' | 'stale'; color: string; borderColor: string; bg: string; label: string } {
  if (!dateString) return { level: 'stale', color: '#94a3b8', borderColor: '#64748b', bg: 'rgba(148, 163, 184, 0.1)', label: '> 7 días' };
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) return { level: 'recent', color: '#10b981', borderColor: '#059669', bg: 'rgba(16, 185, 129, 0.1)', label: '< 24h' };
    if (diffHours < 72) return { level: 'normal', color: '#f59e0b', borderColor: '#d97706', bg: 'rgba(245, 158, 11, 0.1)', label: '1-3 días' };
    if (diffHours < 168) return { level: 'outdated', color: '#f97316', borderColor: '#ea580c', bg: 'rgba(249, 115, 22, 0.1)', label: '3-7 días' };
    return { level: 'stale', color: '#94a3b8', borderColor: '#64748b', bg: 'rgba(148, 163, 184, 0.1)', label: '> 7 días' };
  } catch {
    return { level: 'stale', color: '#94a3b8', borderColor: '#64748b', bg: 'rgba(148, 163, 184, 0.1)', label: '> 7 días' };
  }
}

// Componente para graficar la evolución del tráfico con SVG puro e interactividad nativa
function TrafficChart({ data, isolatedDays, onToggleDay }: { 
  data: { fecha: string; visitas: number }[]; 
  isolatedDays: string[]; 
  onToggleDay: (fecha: string) => void;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-56 w-full items-center justify-center bg-slate-900/40 rounded-2xl border border-slate-800">
        <p className="text-xs text-slate-500 italic">No hay suficientes datos de visitas en este rango.</p>
      </div>
    );
  }

  const maxVal = Math.max(...data.map(d => d.visitas), 5);
  const width = 600;
  const height = 180;
  const paddingX = 40;
  const paddingY = 20;

  // Calcular puntos
  const points = data.map((d, i) => {
    const x = paddingX + (i / (data.length - 1 || 1)) * (width - 2 * paddingX);
    const y = height - paddingY - (d.visitas / maxVal) * (height - 2 * paddingY);
    return { x, y, date: d.fecha, visits: d.visitas };
  });

  // Generar cadena path para la línea
  const lineD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  // Generar cadena path para el área degradada
  const areaD = points.length > 0 
    ? `${lineD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`
    : '';

  return (
    <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tendencia de Tráfico</h4>
          <p className="text-[10px] text-slate-500 mt-0.5">Haz clic en los puntos del gráfico para aislar o combinar días</p>
        </div>
        {isolatedDays.length > 0 && (
          <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/25 px-2 py-0.5 rounded-full">
            Aislado: {isolatedDays.length} días
          </span>
        )}
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Líneas horizontales de fondo */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = paddingY + ratio * (height - 2 * paddingY);
            const val = Math.round(maxVal - ratio * maxVal);
            return (
              <g key={i} className="opacity-20">
                <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#64748b" strokeDasharray="3 3" strokeWidth="0.8" />
                <text x={paddingX - 10} y={y + 3} fill="#94a3b8" fontSize="8" fontWeight="black" textAnchor="end">{val}</text>
              </g>
            );
          })}

          {/* Área sombreada */}
          {areaD && <path d={areaD} fill="url(#areaGrad)" />}

          {/* Línea principal */}
          {lineD && (
            <path
              d={lineD}
              fill="none"
              stroke="#6366f1"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-[0_2px_8px_rgba(99,102,241,0.35)]"
            />
          )}

          {/* Puntos interactivos */}
          {points.map((p, i) => {
            const isIsolated = isolatedDays.includes(p.date);
            return (
              <g key={i} className="group cursor-pointer" onClick={() => onToggleDay(p.date)}>
                {/* Círculo indicador */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={hoveredIndex === i ? 6 : isIsolated ? 5 : 3.5}
                  fill={isIsolated ? '#f59e0b' : hoveredIndex === i ? '#818cf8' : '#6366f1'}
                  stroke={isIsolated ? '#ffffff' : '#0f172a'}
                  strokeWidth={isIsolated ? 2 : 1.5}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="transition-all duration-150"
                />
                {/* Zona invisible táctil aumentada para fácil click */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="14"
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              </g>
            );
          })}
        </svg>

        {/* Tooltip flotante */}
        {hoveredIndex !== null && points[hoveredIndex] && (
          <div
            className="absolute z-10 bg-slate-950/95 border border-slate-700 rounded-lg px-2.5 py-1.5 shadow-2xl text-left pointer-events-none text-[10px] sm:text-xs animate-in fade-in duration-100"
            style={{
              left: `${(points[hoveredIndex].x / width) * 100}%`,
              top: `${(points[hoveredIndex].y / height) * 100 - 32}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <p className="font-bold text-slate-400">{points[hoveredIndex].date}</p>
            <p className="text-white font-black mt-0.5">{points[hoveredIndex].visits} visitas</p>
            <p className="text-[8px] text-slate-500 italic mt-0.5">Haz clic para aislar</p>
          </div>
        )}
      </div>
    </div>
  );
}

type FeedbackMessage = {
  id: string;
  nombre?: string;
  mensaje: string;
  contacto?: string;
  created_at: string;
};

export default function AdminPage() {
  const [auth, setAuth] = useState<{ role: string; password: string } | null>(null);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [centers, setCenters] = useState<CentroDeAcopio[]>([]);
  const [feedback, setFeedback] = useState<FeedbackMessage[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    hoy: number;
    porPais: { pais: string; visitas: number }[];
    diarias: { fecha: string; visitas: number }[];
    sesiones: { id: string; fecha: string; pais: string; ciudad?: string; ip?: string; created_at: string }[];
  }>({
    total: 0,
    hoy: 0,
    porPais: [],
    diarias: [],
    sesiones: []
  });

  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'stats' | 'centers' | 'feedback' | 'vuelos' | 'importador'>('stats');

  // Filtros de fecha y aislamiento de estadísticas
  const [startDate, setStartDate] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedRangePreset, setSelectedRangePreset] = useState<'7d' | '30d' | 'all' | 'custom'>('30d');
  const [isolatedDays, setIsolatedDays] = useState<string[]>([]);
  const [logsSearch, setLogsSearch] = useState('');
  const [logsPage, setLogsPage] = useState(1);

  // Filtros y búsquedas de centros de acopio
  const [centerSearch, setCenterSearch] = useState('');
  const [centerStatusFilter, setCenterStatusFilter] = useState('Todos');
  const [centerSourceFilter, setCenterSourceFilter] = useState('Todos');

  // Flights CRUD States
  const [flights, setFlights] = useState<any[]>([]);
  const [flightForm, setFlightForm] = useState({
    numero_vuelo: '',
    aerolinea_organizacion: '',
    origen: '',
    destino: '',
    cargamento: '',
    estado: 'En Ruta',
    fecha_salida: '',
    fecha_llegada_estimada: ''
  });
  const [editingFlightId, setEditingFlightId] = useState<string | null>(null);
  const [flightLoading, setFlightLoading] = useState(false);

  // Link Importer States
  const [importUrl, setImportUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);

  // Check session
  useEffect(() => {
    const stored = sessionStorage.getItem('admin_auth');
    if (stored) {
      try {
        setAuth(JSON.parse(stored));
      } catch {
        // Ignored
      }
    }
  }, []);

  const fetchStatsData = async (pwd: string, start: string, end: string) => {
    try {
      let url = '/api/visitas';
      const params: string[] = [];
      if (start) params.push(`start=${start}`);
      if (end) params.push(`end=${end}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const res = await fetch(url, {
        headers: { 'x-auth-password': pwd }
      });
      const json = await res.json();
      if (!json.error) {
        setStats(json);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchData = async (pwd: string) => {
    setLoading(true);
    try {
      // 1. Fetch centers
      const centersRes = await fetch('/api/centros?estado=', {
        headers: { 'x-auth-password': pwd }
      });
      const centersJson = await centersRes.json();
      setCenters(centersJson.data || []);

      // 2. Fetch stats
      await fetchStatsData(pwd, startDate, endDate);

      // 3. Fetch feedback (aislado para no bloquear otros datos si RLS lo rechaza)
      try {
        const { data: feedbackData } = await supabase
          .from('feedback_usuarios')
          .select('*')
          .order('created_at', { ascending: false });
        setFeedback(feedbackData || []);
      } catch (fbErr) {
        console.error('Error cargando feedback (posible RLS):', fbErr);
      }
      
      // 4. Fetch flights
      await fetchFlights();
    } catch (err) {
      console.error(err);
      setMensaje({ tipo: 'error', texto: 'Error al cargar los datos.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchFlights = async () => {
    try {
      const res = await fetch('/api/vuelos');
      const json = await res.json();
      setFlights(json.data || []);
    } catch (err) {
      console.error('Error fetching flights:', err);
    }
  };

  useEffect(() => {
    if (auth) {
      fetchData(auth.password);
    }
  }, [auth]);

  // Recargar estadísticas automáticamente al cambiar el rango de fechas
  useEffect(() => {
    if (auth) {
      fetchStatsData(auth.password, startDate, endDate);
      setIsolatedDays([]);
      setLogsPage(1);
    }
  }, [startDate, endDate]);

  const handleSaveFlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setFlightLoading(true);
    try {
      const url = '/api/vuelos';
      const method = editingFlightId ? 'PATCH' : 'POST';
      const body = editingFlightId ? { id: editingFlightId, ...flightForm } : flightForm;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': auth.password
        },
        body: JSON.stringify(body)
      });

      const json = await res.json();
      if (json.success) {
        setMensaje({ tipo: 'ok', texto: editingFlightId ? 'Vuelo actualizado con éxito' : 'Vuelo creado con éxito' });
        setFlightForm({
          numero_vuelo: '',
          aerolinea_organizacion: '',
          origen: '',
          destino: '',
          cargamento: '',
          estado: 'En Ruta',
          fecha_salida: '',
          fecha_llegada_estimada: ''
        });
        setEditingFlightId(null);
        await fetchFlights();
        setTimeout(() => setMensaje(null), 3000);
      } else {
        setMensaje({ tipo: 'error', texto: json.error || 'Error al guardar el vuelo.' });
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión.' });
    } finally {
      setFlightLoading(false);
    }
  };

  const handleBorrarVuelo = async (id: string) => {
    if (!auth || !confirm('¿Estás seguro de borrar este vuelo?')) return;
    try {
      const res = await fetch('/api/vuelos', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': auth.password
        },
        body: JSON.stringify({ id })
      });
      const json = await res.json();
      if (json.success) {
        setFlights(prev => prev.filter(f => f.id !== id));
        setMensaje({ tipo: 'ok', texto: 'Vuelo eliminado.' });
        setTimeout(() => setMensaje(null), 3000);
      } else {
        setMensaje({ tipo: 'error', texto: json.error || 'Error al borrar el vuelo.' });
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error al eliminar el vuelo.' });
    }
  };

  const handleEditarVueloClick = (flight: any) => {
    setEditingFlightId(flight.id);
    setFlightForm({
      numero_vuelo: flight.numero_vuelo,
      aerolinea_organizacion: flight.aerolinea_organizacion,
      origen: flight.origen,
      destino: flight.destino,
      cargamento: flight.cargamento || '',
      estado: flight.estado,
      fecha_salida: flight.fecha_salida ? flight.fecha_salida.slice(0, 16) : '',
      fecha_llegada_estimada: flight.fecha_llegada_estimada ? flight.fecha_llegada_estimada.slice(0, 16) : ''
    });
  };

  const handleImportarEnlace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !importUrl.trim()) return;
    setImportLoading(true);
    setMensaje({ tipo: 'ok', texto: 'Iniciando importación con IA... Espera unos segundos.' });
    try {
      const res = await fetch('/api/analizar-enlace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': auth.password
        },
        body: JSON.stringify({ url: importUrl.trim() })
      });
      const json = await res.json();
      if (json.success) {
        setMensaje({ tipo: 'ok', texto: `¡Éxito! Se importaron e insertaron ${json.count} centros humanitarios en estado Pendiente.` });
        setImportUrl('');
        fetchData(auth.password);
      } else {
        setMensaje({ tipo: 'error', texto: json.error || 'Error al importar el enlace.' });
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de red.' });
    } finally {
      setImportLoading(false);
      setTimeout(() => setMensaje(null), 5000);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const json = await res.json();
      if (json.success && json.role === 'admin') {
        const authData = { role: json.role, password };
        setAuth(authData);
        sessionStorage.setItem('admin_auth', JSON.stringify(authData));
      } else {
        setLoginError('Contraseña incorrecta o sin permisos de administrador.');
      }
    } catch {
      setLoginError('Error de conexión.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_auth');
    setAuth(null);
  };

  const handleAccionCentro = async (id: string, estado: 'aprobado' | 'rechazado') => {
    if (!auth) return;
    try {
      const res = await fetch('/api/centros', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': auth.password
        },
        body: JSON.stringify({ id, estado })
      });
      const json = await res.json();
      if (json.success) {
        setCenters(prev =>
          prev.map(c => (c.id === id ? { ...c, estado } : c))
        );
        setMensaje({ tipo: 'ok', texto: `Centro ${estado === 'aprobado' ? 'aprobado' : 'rechazado'} correctamente.` });
        setTimeout(() => setMensaje(null), 3000);
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error al actualizar el centro.' });
    }
  };

  const handleBorrarCentro = async (id: string) => {
    if (!auth || !confirm('¿Estás seguro de borrar este centro definitivamente?')) return;
    try {
      const res = await fetch('/api/centros', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': auth.password
        },
        body: JSON.stringify({ id })
      });
      const json = await res.json();
      if (json.success) {
        setCenters(prev => prev.filter(c => c.id !== id));
        setMensaje({ tipo: 'ok', texto: 'Centro eliminado de forma permanente.' });
        setTimeout(() => setMensaje(null), 3000);
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error al borrar el centro.' });
    }
  };

  const handleBuscarIA = async () => {
    if (!auth) return;
    setAiLoading(true);
    setMensaje({ tipo: 'ok', texto: 'Iniciando búsqueda con IA en ReliefWeb y redes... Esto puede tardar 10-15 segundos.' });
    try {
      const res = await fetch('/api/buscar-ia', {
        method: 'POST',
        headers: { 'x-auth-password': auth.password }
      });
      const json = await res.json();
      if (json.success) {
        setMensaje({ tipo: 'ok', texto: `¡Búsqueda completada! Se encontraron e insertaron ${json.count} centros nuevos pendientes.` });
        fetchData(auth.password);
      } else {
        setMensaje({ tipo: 'error', texto: json.error || 'Error al ejecutar la búsqueda de IA.' });
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de red al invocar la IA.' });
    } finally {
      setAiLoading(false);
    }
  };

  if (!auth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 mb-4 backdrop-blur-sm">
              <Shield className="w-8 h-8 text-indigo-400" />
            </div>
            <h1 className="text-2xl font-black text-white mb-1">Panel de Administrador</h1>
            <p className="text-slate-400 text-sm">Control general y Estadísticas de la app</p>
          </div>

          <form onSubmit={handleLogin} className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <label className="block text-sm font-semibold text-slate-300 mb-2">Contraseña de administrador</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresa la clave admin"
              autoFocus
              className="w-full bg-slate-950/60 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all mb-4"
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
              className="w-full bg-indigo-600 hover:bg-indigo-50 hover:text-black font-bold rounded-xl py-3 transition-all flex items-center justify-center gap-2"
            >
              {loginLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
              Entrar al Sistema
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Cambiar período rápido
  const handleRangePresetChange = (preset: '7d' | '30d' | 'all' | 'custom') => {
    setSelectedRangePreset(preset);
    const todayStr = new Date().toISOString().split('T')[0];
    if (preset === '7d') {
      const startStr = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      setStartDate(startStr);
      setEndDate(todayStr);
    } else if (preset === '30d') {
      const startStr = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      setStartDate(startStr);
      setEndDate(todayStr);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Alternar selección de día para aislarlo en las métricas
  const handleToggleIsolateDay = (fecha: string) => {
    setIsolatedDays(prev =>
      prev.includes(fecha) ? prev.filter(d => d !== fecha) : [...prev, fecha]
    );
    setLogsPage(1);
  };

  // Recalcular métricas dinámicamente si hay días aislados
  const getFilteredStats = () => {
    const sessionsToUse = isolatedDays.length > 0
      ? stats.sesiones.filter(s => isolatedDays.includes(s.fecha))
      : stats.sesiones;

    const countryMap: Record<string, number> = {};
    sessionsToUse.forEach(s => {
      const p = s.pais || 'Desconocido';
      countryMap[p] = (countryMap[p] || 0) + 1;
    });

    const filteredCountries = Object.entries(countryMap)
      .map(([pais, visitas]) => ({ pais, visitas }))
      .sort((a, b) => b.visitas - a.visitas)
      .slice(0, 10);

    return {
      total: sessionsToUse.length,
      sesiones: sessionsToUse,
      porPais: filteredCountries
    };
  };

  const filteredStats = getFilteredStats();

  // Filtrado y paginación de la bitácora de sesiones
  const filteredSessions = filteredStats.sesiones.filter(s => {
    if (!logsSearch) return true;
    const q = logsSearch.toLowerCase();
    return (
      (s.ip || '').toLowerCase().includes(q) ||
      (s.pais || '').toLowerCase().includes(q) ||
      (s.ciudad || '').toLowerCase().includes(q)
    );
  });

  const logsPerPage = 15;
  const totalLogsPages = Math.max(Math.ceil(filteredSessions.length / logsPerPage), 1);
  const paginatedSessions = filteredSessions.slice(
    (logsPage - 1) * logsPerPage,
    logsPage * logsPerPage
  );

  // Exportar logs a JSON de descarga directa
  const handleExportLogs = () => {
    const jsonStr = JSON.stringify(filteredSessions, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonStr);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataUri);
    downloadAnchor.setAttribute('download', `reporte_accesos_${startDate || 'historico'}_al_${endDate || 'hoy'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Filtrado de centros de acopio detallados
  const filteredCentersList = centers.filter(c => {
    if (centerSearch) {
      const q = centerSearch.toLowerCase();
      const match =
        (c.responsable || '').toLowerCase().includes(q) ||
        (c.direccion || '').toLowerCase().includes(q) ||
        (c.ciudad || '').toLowerCase().includes(q) ||
        (c.pais || '').toLowerCase().includes(q) ||
        (c.telefono || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    if (centerStatusFilter !== 'Todos') {
      if (c.estado !== centerStatusFilter) return false;
    }
    if (centerSourceFilter !== 'Todos') {
      if (c.fuente !== centerSourceFilter) return false;
    }
    return true;
  });

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="font-black text-white text-sm leading-none">Administrador</h1>
              <p className="text-[10px] text-indigo-400">Emergencia Global</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBuscarIA}
              disabled={aiLoading}
              className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-lg"
            >
              {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
              Buscar con IA
            </button>

            <button
              onClick={() => fetchData(auth.password)}
              disabled={loading}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

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

      {mensaje && (
        <div className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl border transition-all ${
          mensaje.tipo === 'ok' ? 'bg-emerald-900/90 border-emerald-700 text-emerald-300' : 'bg-red-900/90 border-red-700 text-red-300'
        }`}>
          {mensaje.texto}
        </div>
      )}

      {/* Navegación de Tabs */}
      <div className="max-w-6xl mx-auto px-4 mt-6">
        <div className="flex border-b border-slate-800 gap-4">
          <button
            onClick={() => setActiveTab('stats')}
            className={`py-3 px-1 border-b-2 font-semibold text-sm transition-all flex items-center gap-1.5 ${
              activeTab === 'stats' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" /> Estadísticas
          </button>
          <button
            onClick={() => setActiveTab('centers')}
            className={`py-3 px-1 border-b-2 font-semibold text-sm transition-all flex items-center gap-1.5 ${
              activeTab === 'centers' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" /> Centros ({centers.length})
          </button>
          <button
            onClick={() => setActiveTab('feedback')}
            className={`py-3 px-1 border-b-2 font-semibold text-sm transition-all flex items-center gap-1.5 ${
              activeTab === 'feedback' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" /> Sugerencias ({feedback.length})
          </button>
          <button
            onClick={() => setActiveTab('vuelos')}
            className={`py-3 px-1 border-b-2 font-semibold text-sm transition-all flex items-center gap-1.5 ${
              activeTab === 'vuelos' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plane className="w-4 h-4" /> Vuelos ({flights.length})
          </button>
          <button
            onClick={() => setActiveTab('importador')}
            className={`py-3 px-1 border-b-2 font-semibold text-sm transition-all flex items-center gap-1.5 ${
              activeTab === 'importador' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Link className="w-4 h-4" /> Importar Enlace
          </button>
        </div>
      </div>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 overflow-y-auto pb-24 sm:pb-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
            <p className="text-slate-400">Cargando información del sistema...</p>
          </div>
        ) : (
          <>
            {/* TABS CONTENT */}
            {activeTab === 'stats' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Barra de Filtros de Fecha */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
                  <div>
                    <h3 className="font-bold text-sm text-indigo-400 flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Filtros de Auditoría Temporal
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Controla el rango de consulta de la base de datos de visitas</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Presets */}
                    <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                      {[
                        { code: '7d', label: '7d' },
                        { code: '30d', label: '30d' },
                        { code: 'all', label: 'Todo' }
                      ].map(p => (
                        <button
                          key={p.code}
                          type="button"
                          onClick={() => handleRangePresetChange(p.code as any)}
                          className={`px-2.5 py-1 rounded text-[10px] font-extrabold tracking-wide uppercase transition-all cursor-pointer ${
                            selectedRangePreset === p.code
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    {/* Custom Picker */}
                    <div className="flex items-center gap-1.5 text-xs">
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          setSelectedRangePreset('custom');
                        }}
                        className="bg-slate-950 border border-slate-805 rounded-lg px-2.5 py-1 text-white text-[10px] sm:text-xs outline-none focus:border-indigo-500"
                      />
                      <span className="text-slate-600 font-bold">a</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                          setEndDate(e.target.value);
                          setSelectedRangePreset('custom');
                        }}
                        className="bg-slate-950 border border-slate-805 rounded-lg px-2.5 py-1 text-white text-[10px] sm:text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Grid de Contadores Principales */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                      <Users className="w-16 h-16 text-indigo-500" />
                    </div>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">Visitas del Periodo</p>
                    <p className="text-3xl font-black mt-2 text-white">{filteredStats.total}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Sesiones capturadas en el rango activo</p>
                  </div>

                  <div className="bg-slate-900 border border-emerald-800/40 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                      <Clock className="w-16 h-16 text-emerald-500" />
                    </div>
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">Visitas Hoy</p>
                    <p className="text-3xl font-black mt-2 text-emerald-400">{stats.hoy}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Usuarios activos en el día de hoy</p>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                      <Globe className="w-16 h-16 text-violet-500" />
                    </div>
                    <p className="text-[10px] font-black text-violet-400 uppercase tracking-wider">Países Activos</p>
                    <p className="text-3xl font-black mt-2 text-white">{filteredStats.porPais.length}</p>
                    <p className="text-[10px] text-slate-500 mt-1">Naciones distintas registradas</p>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                      <RefreshCw className="w-16 h-16 text-amber-500" />
                    </div>
                    <p className="text-[10px] font-black text-amber-400 uppercase tracking-wider">Días Aislados</p>
                    <p className="text-3xl font-black mt-2 text-white">
                      {isolatedDays.length > 0 ? isolatedDays.length : '—'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">Días seleccionados para auditoría</p>
                  </div>
                </div>

                {/* Sección Gráfico y Países */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Gráfico SVG */}
                  <div className="lg:col-span-2 space-y-4">
                    <TrafficChart
                      data={stats.diarias}
                      isolatedDays={isolatedDays}
                      onToggleDay={handleToggleIsolateDay}
                    />
                  </div>

                  {/* Distribución por Países */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col">
                    <div className="flex items-center gap-2 text-violet-400 mb-3">
                      <Globe className="w-4 h-4" />
                      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">Distribución Geográfica</h3>
                    </div>
                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[190px] pr-1">
                      {filteredStats.porPais && filteredStats.porPais.length > 0 ? (
                        filteredStats.porPais.map(p => {
                          const totalVisits = filteredStats.total || 1;
                          const percent = Math.min(Math.round((p.visitas / totalVisits) * 100), 100);
                          return (
                            <div key={p.pais} className="space-y-1">
                              <div className="flex justify-between text-xs text-slate-300 font-semibold">
                                <span>📍 {p.pais}</span>
                                <span>{p.visitas} ({percent}%)</span>
                              </div>
                              <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${percent}%` }} />
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-slate-500 italic text-center py-10">Sin datos de geolocalización.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bitácora de Accesos Detallada */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="font-bold text-sm text-indigo-400">📋 Historial de Accesos Recientes</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">Listado detallado de conexiones de red del periodo actual</p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                        <input
                          type="text"
                          value={logsSearch}
                          onChange={(e) => {
                            setLogsSearch(e.target.value);
                            setLogsPage(1);
                          }}
                          placeholder="Buscar por IP, país o ciudad..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleExportLogs}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow border border-slate-700"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Exportar JSON
                      </button>
                    </div>
                  </div>

                  {/* Tabla de registros */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          <th className="py-2.5 px-3">Fecha y Hora (UTC)</th>
                          <th className="py-2.5 px-3">Ubicación</th>
                          <th className="py-2.5 px-3">Dirección IP</th>
                          <th className="py-2.5 px-3 text-right">Filtros</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850/50 text-xs">
                        {paginatedSessions.length > 0 ? (
                          paginatedSessions.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-850/30 transition-colors">
                              <td className="py-2.5 px-3 font-semibold text-slate-300">
                                {new Date(s.created_at || s.fecha).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-slate-400 font-medium">
                                📍 {s.pais} {s.ciudad ? `, ${s.ciudad}` : ''}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-mono bg-slate-950 border border-slate-850 px-1.5 py-0.5 rounded text-[11px] text-slate-300 font-bold shadow-sm">
                                  {s.ip || '127.0.0.1 (Oculto)'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleToggleIsolateDay(s.fecha)}
                                  className={`px-2 py-0.5 rounded text-[9px] font-extrabold transition-all border cursor-pointer ${
                                    isolatedDays.includes(s.fecha)
                                      ? 'bg-amber-500 border-amber-500 text-slate-950'
                                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                                  }`}
                                >
                                  {isolatedDays.includes(s.fecha) ? 'Aislado ✓' : 'Aislar Día'}
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="text-center py-8 text-slate-500 italic">
                              No se encontraron registros de accesos con los filtros activos.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginador */}
                  {totalLogsPages > 1 && (
                    <div className="flex justify-between items-center pt-3 border-t border-slate-800 text-xs text-slate-400">
                      <span>Mostrando logs { (logsPage - 1) * logsPerPage + 1 } - { Math.min(logsPage * logsPerPage, filteredSessions.length) } de { filteredSessions.length }</span>
                      <div className="flex gap-2">
                        <button
                          disabled={logsPage === 1}
                          onClick={() => setLogsPage(prev => Math.max(prev - 1, 1))}
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-350 transition-all border border-slate-700 cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="self-center font-bold px-2.5 py-0.5 rounded bg-slate-950 border border-slate-850 text-[10px]">
                          Pág. {logsPage} de {totalLogsPages}
                        </span>
                        <button
                          disabled={logsPage === totalLogsPages}
                          onClick={() => setLogsPage(prev => Math.min(prev + 1, totalLogsPages))}
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-350 transition-all border border-slate-700 cursor-pointer"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'centers' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Barra de Búsqueda y Filtros de Centros */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-center justify-between shadow-xl">
                  <div className="relative w-full md:w-80">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                    <input
                      type="text"
                      value={centerSearch}
                      onChange={(e) => setCenterSearch(e.target.value)}
                      placeholder="Buscar por responsable, ciudad, país, teléfono..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Status filter */}
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-slate-500 text-[10px] font-bold uppercase">Estado:</span>
                      <select
                        value={centerStatusFilter}
                        onChange={(e) => setCenterStatusFilter(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="Todos">Todos</option>
                        <option value="pendiente">Pendientes</option>
                        <option value="aprobado">Aprobados</option>
                        <option value="rechazado">Rechazados</option>
                      </select>
                    </div>

                    {/* Source filter */}
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-slate-500 text-[10px] font-bold uppercase">Origen:</span>
                      <select
                        value={centerSourceFilter}
                        onChange={(e) => setCenterSourceFilter(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="Todos">Todos</option>
                        <option value="manual">Manual</option>
                        <option value="ia_gemini">IA Gemini</option>
                        <option value="reliefweb">Reliefweb</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Listado de Centros */}
                <div className="space-y-3">
                  {filteredCentersList.length > 0 ? (
                    filteredCentersList.map(c => {
                      const dateStr = c.created_at ? new Date(c.created_at).toLocaleString() : 'Fecha Desconocida';
                      return (
                        <div key={c.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all shadow shadow-slate-950/40">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Status Badge */}
                              <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${
                                c.estado === 'aprobado' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                c.estado === 'pendiente' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                'bg-red-500/10 text-red-400 border-red-500/20'
                              }`}>
                                {c.estado.toUpperCase()}
                              </span>
                              
                              {/* Source Badge */}
                              <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                                c.fuente === 'ia_gemini' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                c.fuente === 'reliefweb' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                                'bg-slate-800 text-slate-400 border-slate-700'
                              }`}>
                                {c.fuente === 'ia_gemini' && <Bot className="w-2.5 h-2.5" />}
                                {c.fuente === 'ia_gemini' ? 'IA Gemini' : c.fuente === 'reliefweb' ? 'Reliefweb' : 'Manual'}
                              </span>

                              {/* Freshness Badge */}
                              {(() => {
                                const freshness = getFreshnessLevel(c.updated_at || c.created_at);
                                return (
                                  <span
                                    className="text-[9px] font-extrabold px-2 py-0.5 rounded-full border flex items-center gap-1.5"
                                    style={{
                                      backgroundColor: freshness.bg,
                                      color: freshness.color,
                                      borderColor: freshness.borderColor + '30'
                                    }}
                                  >
                                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: freshness.color, display: 'inline-block' }} />
                                    Actualizado: {formatRelativeTime(c.updated_at || c.created_at)}
                                  </span>
                                );
                              })()}

                              <h4 className="font-extrabold text-sm text-slate-100">{c.responsable}</h4>
                            </div>
                            
                            <p className="text-xs text-slate-300">{c.direccion} {c.ciudad ? `• ${c.ciudad}` : ''} {c.pais ? `• ${c.pais}` : ''}</p>
                            
                            <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-slate-400 font-semibold pt-2 items-center">
                              {c.telefono ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-500">Contacto:</span>
                                  <a
                                    href={`tel:${c.telefono}`}
                                    className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2 py-0.5 hover:bg-emerald-500/20 transition-colors font-bold"
                                  >
                                    <Phone className="w-3 h-3" />
                                    Llamar ({c.telefono})
                                  </a>
                                  <a
                                    href={`https://wa.me/${c.telefono.replace(/[^0-9]/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-green-400 bg-green-500/10 border border-green-500/20 rounded-md px-2 py-0.5 hover:bg-green-500/20 transition-colors font-bold"
                                  >
                                    WhatsApp
                                  </a>
                                </div>
                              ) : (
                                <span className="text-slate-600 italic">Sin teléfono de contacto</span>
                              )}
                              <span className="text-slate-650">|</span>
                              <span>📅 Creado: {dateStr}</span>
                              {c.updated_at && c.updated_at !== c.created_at && (
                                <>
                                  <span className="text-slate-650">|</span>
                                  <span>🔄 Modificado: {new Date(c.updated_at).toLocaleString()}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2 w-full md:w-auto self-stretch md:self-auto justify-end items-center pt-2 md:pt-0 border-t border-slate-800 md:border-t-0">
                            {c.estado !== 'aprobado' && (
                              <button
                                onClick={() => handleAccionCentro(c.id, 'aprobado')}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-sm shadow-emerald-700/10"
                              >
                                Aprobar
                              </button>
                            )}
                            {c.estado !== 'rechazado' && (
                              <button
                                onClick={() => handleAccionCentro(c.id, 'rechazado')}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer border border-slate-700"
                              >
                                Rechazar
                              </button>
                            )}
                            <button
                              onClick={() => handleBorrarCentro(c.id)}
                              className="bg-red-950 text-red-400 hover:bg-red-900 font-semibold text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer border border-red-900/20"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-slate-500 text-xs text-center py-10 italic">No se encontraron centros de acopio con los filtros activos.</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'feedback' && (
              <div className="space-y-4">
                {feedback.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-10">No hay sugerencias registradas por los usuarios aún.</p>
                ) : (
                  feedback.map(f => (
                    <div key={f.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-sm text-indigo-300">{f.nombre || 'Anónimo'}</h4>
                        <span className="text-[10px] text-slate-500">
                          {new Date(f.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-200 bg-slate-950/40 p-3 rounded-lg border border-slate-800/60">{f.mensaje}</p>
                      {f.contacto && (
                        <p className="text-xs text-slate-400 mt-2">📞 Contacto: <span className="text-indigo-400 font-semibold">{f.contacto}</span></p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'importador' && (
              <div className="max-w-xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Link className="w-5 h-5 text-indigo-400" />
                    Importador Inteligente de Enlaces
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Ingresa el enlace de cualquier página web de ayuda o post de redes sociales. La IA raspará el HTML público y extraerá los centros de acopio en lote automáticamente.
                  </p>
                </div>

                <form onSubmit={handleImportarEnlace} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">URL del sitio o red social</label>
                    <input
                      type="url"
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      placeholder="https://ejemplo.com/ayuda-humanitaria-venezuela"
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={importLoading || !importUrl.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    {importLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                    Importar y Analizar con Gemini
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'vuelos' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form column */}
                <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Plane className="w-4 h-4 text-indigo-400" />
                    {editingFlightId ? 'Editar Vuelo Coordenado' : 'Registrar Vuelo Humanitario'}
                  </h3>

                  <form onSubmit={handleSaveFlight} className="space-y-3.5 text-xs">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Número de Vuelo *</label>
                      <input
                        type="text"
                        value={flightForm.numero_vuelo}
                        onChange={(e) => setFlightForm({ ...flightForm, numero_vuelo: e.target.value })}
                        placeholder="Ej: HCA-747"
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500 transition-all font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Aerolínea / Organización *</label>
                      <input
                        type="text"
                        value={flightForm.aerolinea_organizacion}
                        onChange={(e) => setFlightForm({ ...flightForm, aerolinea_organizacion: e.target.value })}
                        placeholder="Ej: Cruz Roja / Atlas Air"
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500 transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Origen *</label>
                        <input
                          type="text"
                          value={flightForm.origen}
                          onChange={(e) => setFlightForm({ ...flightForm, origen: e.target.value })}
                          placeholder="Ej: Miami (MIA)"
                          required
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Destino *</label>
                        <input
                          type="text"
                          value={flightForm.destino}
                          onChange={(e) => setFlightForm({ ...flightForm, destino: e.target.value })}
                          placeholder="Ej: Caracas (CCS)"
                          required
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Cargamento / Insumos Estimados</label>
                      <input
                        type="text"
                        value={flightForm.cargamento}
                        onChange={(e) => setFlightForm({ ...flightForm, cargamento: e.target.value })}
                        placeholder="Ej: 20 toneladas de insumos médicos"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500 transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Estado</label>
                        <select
                          value={flightForm.estado}
                          onChange={(e) => setFlightForm({ ...flightForm, estado: e.target.value as any })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500 transition-all"
                        >
                          <option value="En Ruta">En Ruta</option>
                          <option value="Aterrizado">Aterrizado</option>
                          <option value="Demorado">Demorado</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Salida Estimada</label>
                        <input
                          type="datetime-local"
                          value={flightForm.fecha_salida}
                          onChange={(e) => setFlightForm({ ...flightForm, fecha_salida: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Llegada Estimada *</label>
                      <input
                        type="datetime-local"
                        value={flightForm.fecha_llegada_estimada}
                        onChange={(e) => setFlightForm({ ...flightForm, fecha_llegada_estimada: e.target.value })}
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none focus:border-indigo-500 transition-all"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      {editingFlightId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFlightId(null);
                            setFlightForm({ numero_vuelo: '', aerolinea_organizacion: '', origen: '', destino: '', cargamento: '', estado: 'En Ruta', fecha_salida: '', fecha_llegada_estimada: '' });
                          }}
                          className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-350 font-bold py-2 rounded-lg transition-all cursor-pointer"
                        >
                          Cancelar
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={flightLoading}
                        className="flex-1 bg-indigo-650 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {flightLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        Guardar Vuelo
                      </button>
                    </div>
                  </form>
                </div>

                {/* Flights List Column */}
                <div className="lg:col-span-2 space-y-4">
                  {flights.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-10">No hay vuelos registrados en el feed actualmente.</p>
                  ) : (
                    <div className="space-y-3">
                      {flights.map(f => (
                        <div key={f.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex justify-between items-center gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-indigo-400 font-mono">{f.numero_vuelo}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                f.estado === 'Aterrizado' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                                f.estado === 'Demorado' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                                'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                              }`}>
                                {f.estado}
                              </span>
                            </div>
                            <p className="text-xs text-white font-bold">{f.aerolinea_organizacion}</p>
                            <p className="text-[11px] text-slate-400">{f.origen} ✈ {f.destino} • Insumos: {f.cargamento || 'Suministros varios'}</p>
                          </div>
                          <div className="flex gap-2.5">
                            <button
                              onClick={() => handleEditarVueloClick(f)}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleBorrarVuelo(f.id)}
                              className="bg-red-950 hover:bg-red-900 text-red-350 text-xs px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              Borrar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
