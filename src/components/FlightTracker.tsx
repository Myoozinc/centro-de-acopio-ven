import { useState, useEffect, useCallback } from 'react';
import { Plane, PlaneTakeoff, PlaneLanding, Box, Clock, Search, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';

export type VueloHumanitario = {
  id: string;
  numero_vuelo: string;
  aerolinea_organizacion: string;
  origen: string;
  destino: string;
  cargamento?: string;
  estado: 'En Ruta' | 'Aterrizado' | 'Demorado';
  fecha_salida?: string;
  fecha_llegada_estimada?: string;
  created_at: string;
};

export default function FlightTracker() {
  const [flights, setFlights] = useState<VueloHumanitario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchFlights = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/vuelos');
      if (!res.ok) throw new Error('Error al cargar el feed de vuelos.');
      const json = await res.json();
      setFlights(json.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error de conexión.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlights();
    // Refresh flights every 60s for live feeling
    const interval = setInterval(fetchFlights, 60000);
    return () => clearInterval(interval);
  }, [fetchFlights]);

  const filteredFlights = flights.filter(f =>
    f.numero_vuelo.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.aerolinea_organizacion.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.origen.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.destino.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.cargamento && f.cargamento.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getStatusStyle = (estado: string) => {
    switch (estado) {
      case 'Aterrizado':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
      case 'Demorado':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse';
      case 'En Ruta':
      default:
        return 'bg-sky-500/10 text-sky-400 border border-sky-500/30';
    }
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return 'Por confirmar';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('es-ES', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Header Panel */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div>
          <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
            <Plane className="h-5 w-5 text-indigo-400 rotate-45" />
            Puentes Aéreos Humanitarios
          </h2>
          <p className="text-xs text-slate-400">Canal logístico y arribo de insumos de ayuda internacional</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search bar */}
          <div className="relative flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 w-full sm:w-64">
            <Search className="h-4 w-4 text-slate-500 mr-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar vuelo, origen, carga..."
              className="bg-transparent text-xs text-white placeholder-slate-500 outline-none w-full"
            />
          </div>

          <button
            onClick={fetchFlights}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-850 border border-slate-800 hover:bg-slate-800 transition-colors text-slate-300"
            title="Actualizar vuelos"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Board View */}
      <div className="flex-1 overflow-auto p-4">
        {loading && flights.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 gap-3">
            <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
            <p className="text-xs text-slate-400">Sincronizando tablero del aeropuerto...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full py-16 gap-3 text-center max-w-sm mx-auto">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <p className="text-sm font-bold text-white">Error de Carga</p>
            <p className="text-xs text-slate-400">{error}</p>
            <button
              onClick={fetchFlights}
              className="mt-2 text-xs bg-indigo-600 hover:bg-indigo-700 font-bold px-4 py-2 rounded-xl text-white shadow-md transition-colors"
            >
              Reintentar
            </button>
          </div>
        ) : filteredFlights.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center">
            <Plane className="h-10 w-10 text-slate-700 mb-2" />
            <p className="text-sm font-bold text-slate-400">No hay vuelos registrados</p>
            <p className="text-xs text-slate-500">No se encontraron vuelos de carga activa para la consulta.</p>
          </div>
        ) : (
          /* Airport FIDS Board style table */
          <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-900/40 backdrop-blur-md shadow-2xl">
            {/* Desktop Table Header */}
            <div className="hidden md:grid grid-cols-12 gap-2 bg-slate-950 px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <div className="col-span-1">Vuelo</div>
              <div className="col-span-2">Organización</div>
              <div className="col-span-2">Origen</div>
              <div className="col-span-2">Destino</div>
              <div className="col-span-2">Cargamento Insumos</div>
              <div className="col-span-1">Estado</div>
              <div className="col-span-2 text-right">Llegada Estimada</div>
            </div>

            {/* List */}
            <div className="divide-y divide-slate-800/60 font-mono">
              {filteredFlights.map((flight) => (
                <div
                  key={flight.id}
                  className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-2 px-4 py-4 md:py-3.5 items-center hover:bg-slate-900/60 transition-colors text-xs md:text-sm text-slate-200"
                >
                  {/* Vuelo */}
                  <div className="col-span-1 flex items-center justify-between md:block">
                    <span className="md:hidden text-[10px] text-slate-500 uppercase tracking-widest">Vuelo</span>
                    <span className="font-extrabold text-amber-400 tracking-wider bg-amber-400/5 px-2 py-0.5 rounded border border-amber-400/10 md:bg-transparent md:border-none md:p-0 md:text-indigo-300">
                      {flight.numero_vuelo}
                    </span>
                  </div>

                  {/* Organización */}
                  <div className="col-span-2 flex items-center justify-between md:block">
                    <span className="md:hidden text-[10px] text-slate-500 uppercase tracking-widest">Organización</span>
                    <span className="font-semibold text-slate-100">{flight.aerolinea_organizacion}</span>
                  </div>

                  {/* Origen */}
                  <div className="col-span-2 flex items-center justify-between md:block">
                    <span className="md:hidden text-[10px] text-slate-500 uppercase tracking-widest">Origen</span>
                    <span className="flex items-center gap-1">
                      <PlaneTakeoff className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                      {flight.origen}
                    </span>
                  </div>

                  {/* Destino */}
                  <div className="col-span-2 flex items-center justify-between md:block">
                    <span className="md:hidden text-[10px] text-slate-500 uppercase tracking-widest">Destino</span>
                    <span className="flex items-center gap-1">
                      <PlaneLanding className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                      {flight.destino}
                    </span>
                  </div>

                  {/* Cargamento */}
                  <div className="col-span-2 flex items-center justify-between md:block">
                    <span className="md:hidden text-[10px] text-slate-500 uppercase tracking-widest">Insumos</span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <Box className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                      <span className="truncate max-w-[200px]" title={flight.cargamento}>
                        {flight.cargamento || 'Suministros varios'}
                      </span>
                    </span>
                  </div>

                  {/* Estado */}
                  <div className="col-span-1 flex items-center justify-between md:block">
                    <span className="md:hidden text-[10px] text-slate-500 uppercase tracking-widest">Estado</span>
                    <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusStyle(flight.estado)}`}>
                      {flight.estado}
                    </span>
                  </div>

                  {/* Llegada Estimada */}
                  <div className="col-span-2 flex items-center justify-between md:block md:text-right">
                    <span className="md:hidden text-[10px] text-slate-500 uppercase tracking-widest">Est. Llegada</span>
                    <span className="flex items-center justify-end gap-1 text-amber-500 font-bold">
                      <Clock className="h-3.5 w-3.5 text-amber-500/70" />
                      {formatDateTime(flight.fecha_llegada_estimada)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
