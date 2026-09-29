'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, Loader2, WifiOff, MessageSquare, Camera, Upload, X, Sparkles, Check, AlertCircle, MapPin, User, Globe, Map, Plane, LinkIcon, BarChart3 } from 'lucide-react';
import CenterFormModal from '@/components/CenterFormModal';
import FeedbackModal from '@/components/FeedbackModal';
import FlightTracker from '@/components/FlightTracker';
import { supabase } from '@/lib/supabase';
import type { CentroDeAcopio, NuevoCentro, FeedbackInput } from '@/types';

// Dynamic import with SSR disabled — Leaflet requires the browser's `window` object
const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-100">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <p className="text-sm text-gray-500">Cargando mapa...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  const [centers, setCenters] = useState<CentroDeAcopio[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<CentroDeAcopio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Manual location selection states
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [manualLat, setManualLat] = useState<number | null>(null);
  const [manualLng, setManualLng] = useState<number | null>(null);

  // Advanced features states
  const [isOffline, setIsOffline] = useState(false);
  const [activeCenterId, setActiveCenterId] = useState<string | null>(null);

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<'map' | 'vuelos' | 'fuentes'>('map');
  const [appMode, setAppMode] = useState<'venezuela' | 'international'>('venezuela');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'urgente' | 'necesitan' | 'abastecidos'>('todos');

  // Image Upload IA states
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null); // base64 string
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [imageTargetCenterId, setImageTargetCenterId] = useState<string>(''); // empty for "new"
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Editable state for the extracted data (Human-in-the-loop validation)
  const [editableExtracted, setEditableExtracted] = useState({
    responsable: '',
    pais: '',
    ciudad: '',
    direccion: '',
    telefono: '',
    lat: 10.4806,
    lng: -66.9036,
    suministros: [] as string[],
    necesita: [] as string[],
    sobra: [] as string[]
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageMimeType(file.type);
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
      setAnalysisResult(null);
      setAnalysisError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyzeImage = async () => {
    if (!selectedImage) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);

    try {
      const res = await fetch('/api/analizar-imagen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: selectedImage,
          mimeType: imageMimeType,
          centroId: imageTargetCenterId || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Error al analizar la imagen.');
      }

      setAnalysisResult(json);
      if (!json.updated && json.extracted) {
        setEditableExtracted({
          responsable: json.extracted.responsable || '',
          pais: json.extracted.pais || 'Venezuela',
          ciudad: json.extracted.ciudad || '',
          direccion: json.extracted.direccion || '',
          telefono: json.extracted.telefono || '',
          lat: json.extracted.lat || 10.4806,
          lng: json.extracted.lng || -66.9036,
          suministros: json.extracted.suministros || [],
          necesita: json.extracted.necesita || [],
          sobra: json.extracted.sobra || []
        });
      }
      // Refresh centers
      fetchCenters();
    } catch (err: any) {
      console.error(err);
      setAnalysisError(err.message || 'Error de conexión.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const closeImageModal = () => {
    setIsImageModalOpen(false);
    setSelectedImage(null);
    setAnalysisResult(null);
    setAnalysisError(null);
    setImageTargetCenterId('');
  };

  const handleSaveExtractedCenter = async () => {
    const isExtractedDataValid = 
      editableExtracted.responsable.trim() !== '' &&
      editableExtracted.responsable !== 'Centro de Acopio Identificado' &&
      editableExtracted.direccion.trim() !== '' &&
      editableExtracted.direccion !== 'Dirección por confirmar' &&
      editableExtracted.pais.trim() !== '';

    if (!isExtractedDataValid) return;
    setIsAnalyzing(true);
    try {
      await handleAddCenter({
        responsable: editableExtracted.responsable.trim(),
        direccion: editableExtracted.direccion.trim(),
        pais: editableExtracted.pais.trim(),
        ciudad: editableExtracted.ciudad.trim() || undefined,
        telefono: editableExtracted.telefono.trim() || undefined,
        suministros: editableExtracted.suministros,
        necesita: editableExtracted.necesita,
        sobra: editableExtracted.sobra,
        lat: Number(editableExtracted.lat),
        lng: Number(editableExtracted.lng)
      });
      setAnalysisResult((prev: any) => ({
        ...prev,
        saved: true,
        extracted: editableExtracted
      }));
      fetchCenters();
    } catch (err: any) {
      setAnalysisError(err.message || 'Error al registrar el centro.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Parse URL share parameters + register anonymous visit
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const centroId = params.get('centro');
      if (centroId) setActiveCenterId(centroId);

      // Track visit once per session
      const visited = sessionStorage.getItem('visited');
      if (!visited) {
        sessionStorage.setItem('visited', '1');
        fetch('https://ipapi.co/json/')
          .then((r) => r.json())
          .then((geo) => {
            fetch('/api/visitas', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                pais: geo.country_name || 'Desconocido',
                ciudad: geo.city || null,
              }),
            }).catch(() => {});
          })
          .catch(() => {
            fetch('/api/visitas', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pais: 'Desconocido' }),
            }).catch(() => {});
          });
      }
    }
  }, []);

  // Fetch all centers on mount (with offline cache support)
  const fetchCenters = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('centros_de_acopio')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const fetched = data || [];
      setCenters(fetched);
      setError(null);
      setIsOffline(false);

      // Save cache for offline fallback
      try {
        localStorage.setItem('cached_centers', JSON.stringify(fetched));
      } catch (e) {
        console.error('Failed to cache centers locally:', e);
      }
    } catch (err) {
      console.error('Error fetching centers:', err);

      // Load cache fallback if offline
      try {
        const cached = localStorage.getItem('cached_centers');
        if (cached) {
          setCenters(JSON.parse(cached));
          setIsOffline(true);
          setError(null);
        } else {
          setError('No se pudieron cargar los centros. Verifica tu conexión.');
        }
      } catch (cacheErr) {
        setError('No se pudieron cargar los centros. Verifica tu conexión.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Subscribe to real-time changes (INSERT + UPDATE + DELETE)
  useEffect(() => {
    fetchCenters();

    const channel = supabase
      .channel('centros-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'centros_de_acopio',
        },
        (payload) => {
          const newCenter = payload.new as CentroDeAcopio;
          setCenters((prev) => {
            if (prev.some((c) => c.id === newCenter.id)) return prev;
            return [newCenter, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'centros_de_acopio',
        },
        (payload) => {
          const updated = payload.new as CentroDeAcopio;
          setCenters((prev) =>
            prev.map((c) => (c.id === updated.id ? updated : c))
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'centros_de_acopio',
        },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id;
          setCenters((prev) => prev.filter((c) => c.id !== deletedId));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCenters]);

  // Insert a new center
  const handleAddCenter = async (newCenter: NuevoCentro) => {
    const { error: insertError } = await supabase
      .from('centros_de_acopio')
      .insert([
        {
          ...newCenter,
          estado: 'aprobado',   // public submissions go straight to map
          fuente: 'manual',
          pais: newCenter.pais || 'Venezuela',
          verificaciones: 0,
          updated_at: new Date().toISOString(),
        },
      ]);

    if (insertError) {
      console.error('Error inserting center:', insertError);
      throw insertError;
    }
  };

  // Update an existing center
  const handleUpdateCenter = async (id: string, updates: Partial<NuevoCentro>) => {
    const { error: updateError } = await supabase
      .from('centros_de_acopio')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating center:', updateError);
      throw updateError;
    }
  };

  // Verify / Upvote a center
  const handleVerifyCenter = async (id: string) => {
    const found = centers.find((c) => c.id === id);
    if (!found) return;

    const { error: verifyError } = await supabase
      .from('centros_de_acopio')
      .update({
        verificaciones: (found.verificaciones || 0) + 1,
      })
      .eq('id', id);

    if (verifyError) {
      console.error('Error verifying center:', verifyError);
      throw verifyError;
    }
  };

  // Delete a center
  const handleDeleteCenter = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('centros_de_acopio')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting center:', deleteError);
      throw deleteError;
    }
  };

  // Submit feedback
  const handleSendFeedback = async (feedback: FeedbackInput) => {
    const { error: feedbackError } = await supabase
      .from('feedback_usuarios')
      .insert([feedback]);

    if (feedbackError) {
      console.error('Error inserting feedback:', feedbackError);
      throw feedbackError;
    }
  };

  // Open modal for creating
  const openCreateModal = () => {
    setEditingCenter(null);
    setManualLat(null);
    setManualLng(null);
    setIsModalOpen(true);
  };

  // Open modal for editing
  const openEditModal = (center: CentroDeAcopio) => {
    setEditingCenter(center);
    setManualLat(center.lat);
    setManualLng(center.lng);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCenter(null);
    setManualLat(null);
    setManualLng(null);
  };

  // Manual location workflows
  const startManualLocationSelection = () => {
    setIsSelectingLocation(true);
    setIsModalOpen(false);
  };

  const handleConfirmManualLocation = (lat: number, lng: number) => {
    setManualLat(lat);
    setManualLng(lng);
    setIsSelectingLocation(false);
    setIsModalOpen(true);
  };

  const handleCancelManualLocation = () => {
    setIsSelectingLocation(false);
    setIsModalOpen(true);
  };

  return (
    <main className="relative h-[100dvh] w-full select-none overflow-hidden flex flex-col bg-slate-950">
      {/* Header bar — compact for mobile */}
      <header className="absolute top-0 left-0 right-0 z-[1000] flex items-center justify-between bg-white/95 backdrop-blur-md px-3 py-2 sm:px-4 sm:py-3 shadow-md border-b border-slate-200/50">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 animate-pulse text-amber-500" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-black text-gray-900 tracking-tight leading-none">
                Hub de Ayuda
              </h1>
              <p className="text-[10px] text-gray-500 font-medium">Emergencia Humanitaria</p>
            </div>
          </div>

          {/* Mode Toggle — always visible, compact on mobile */}
          <div className="flex items-center bg-indigo-50 border border-indigo-150 p-0.5 rounded-lg shadow-inner">
            <button
              type="button"
              onClick={() => setAppMode('venezuela')}
              className={`px-2 sm:px-2.5 py-1 rounded text-[10px] font-black tracking-wide uppercase transition-all cursor-pointer ${
                appMode === 'venezuela'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100/50'
              }`}
            >
              🇻🇪 <span className="hidden xs:inline">VEN</span>
            </button>
            <button
              type="button"
              onClick={() => setAppMode('international')}
              className={`px-2 sm:px-2.5 py-1 rounded text-[10px] font-black tracking-wide uppercase transition-all cursor-pointer ${
                appMode === 'international'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100/50'
              }`}
            >
              🌎 <span className="hidden xs:inline">Global</span>
            </button>
          </div>
        </div>

        {/* Desktop Navigation Tabs — hidden on mobile (bottom nav replaces) */}
        <div className="hidden sm:flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 max-w-xs">
          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1 cursor-pointer ${
              activeTab === 'map'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            🗺️ Mapa
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('vuelos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1 cursor-pointer ${
              activeTab === 'vuelos'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            ✈️ Vuelos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fuentes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1 cursor-pointer ${
              activeTab === 'fuentes'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            🔗 Recursos
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {error && <WifiOff className="h-4 w-4 text-red-500" />}

          <span className="hidden sm:inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping mr-1.5"></span>
            {loading ? '...' : `${centers.length} activos`}
          </span>

          <button
            type="button"
            onClick={() => setIsImageModalOpen(true)}
            className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-900 transition-colors shadow-sm cursor-pointer"
            title="Escanear foto/pizarra de insumos con IA"
          >
            <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsFeedbackOpen(true)}
            className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors shadow-sm cursor-pointer"
            title="Enviar Sugerencia / Reportar problema"
          >
            <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        </div>
      </header>

      {/* Stats Banner — visible on mobile and desktop */}
      {activeTab === 'map' && !loading && (
        <div className="absolute top-[44px] sm:top-[52px] left-0 right-0 z-[999] stats-banner bg-white/90 backdrop-blur-sm border-b border-slate-100">
          <button
            type="button"
            onClick={() => setStatusFilter('todos')}
            className={`stat-chip total cursor-pointer transition-all duration-200 ${
              statusFilter === 'todos'
                ? 'ring-2 ring-emerald-500/80 scale-105 shadow-md opacity-100 font-extrabold'
                : 'opacity-40 hover:opacity-85 hover:scale-102 scale-100 font-medium'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            {centers.filter(c => appMode === 'venezuela' ? (c.pais || '').toLowerCase() === 'venezuela' : true).length} Activos
          </button>
          
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'urgente' ? 'todos' : 'urgente')}
            className={`stat-chip urgent cursor-pointer transition-all duration-200 ${
              statusFilter === 'urgente'
                ? 'ring-2 ring-red-500/80 scale-105 shadow-md opacity-100 font-extrabold'
                : statusFilter !== 'todos'
                  ? 'opacity-40 hover:opacity-85 hover:scale-102 scale-100 font-medium'
                  : 'opacity-100 font-bold'
            }`}
          >
            <span className="animate-urgent-pulse">🆘</span>
            {centers.filter(c => {
              const isMode = appMode === 'venezuela' ? (c.pais || '').toLowerCase() === 'venezuela' : true;
              return isMode && (c.necesita?.length || 0) >= 3;
            }).length} Urgente
          </button>
          
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'necesitan' ? 'todos' : 'necesitan')}
            className={`stat-chip needs cursor-pointer transition-all duration-200 ${
              statusFilter === 'necesitan'
                ? 'ring-2 ring-amber-500/80 scale-105 shadow-md opacity-100 font-extrabold'
                : statusFilter !== 'todos'
                  ? 'opacity-40 hover:opacity-85 hover:scale-102 scale-100 font-medium'
                  : 'opacity-100 font-bold'
            }`}
          >
            ⚠️ {centers.filter(c => {
              const isMode = appMode === 'venezuela' ? (c.pais || '').toLowerCase() === 'venezuela' : true;
              return isMode && (c.necesita?.length || 0) > 0 && (c.necesita?.length || 0) < 3;
            }).length} Necesitan
          </button>
          
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'abastecidos' ? 'todos' : 'abastecidos')}
            className={`stat-chip good cursor-pointer transition-all duration-200 ${
              statusFilter === 'abastecidos'
                ? 'ring-2 ring-green-600/80 scale-105 shadow-md opacity-100 font-extrabold'
                : statusFilter !== 'todos'
                  ? 'opacity-40 hover:opacity-85 hover:scale-102 scale-100 font-medium'
                  : 'opacity-100 font-bold'
            }`}
          >
            ✅ {centers.filter(c => {
              const isMode = appMode === 'venezuela' ? (c.pais || '').toLowerCase() === 'venezuela' : true;
              return isMode && (c.necesita?.length || 0) === 0;
            }).length} Abastecidos
          </button>
        </div>
      )}

      {/* View Content */}
      <div className={`flex-1 h-full w-full ${activeTab === 'map' && !loading ? 'pt-[76px] sm:pt-[84px]' : 'pt-[44px] sm:pt-[52px]'} pb-16 sm:pb-0 relative`}>
        {activeTab === 'map' && (
          loading ? (
            <div className="flex h-full w-full items-center justify-center bg-gray-100">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                <p className="text-sm text-gray-500">Conectando con la base de datos...</p>
              </div>
            </div>
          ) : (
            <MapComponent
              centers={centers}
              onAddCenter={openCreateModal}
              onEditCenter={openEditModal}
              onDeleteCenter={handleDeleteCenter}
              isSelectingLocation={isSelectingLocation}
              onConfirmLocation={handleConfirmManualLocation}
              onCancelSelection={handleCancelManualLocation}
              activeCenterId={activeCenterId}
              onVerifyCenter={handleVerifyCenter}
              appMode={appMode}
              statusFilter={statusFilter}
            />
          )
        )}

        {activeTab === 'vuelos' && (
          <div className="h-full w-full pt-2">
            <FlightTracker />
          </div>
        )}

        {activeTab === 'fuentes' && (
          <div className="h-full w-full overflow-y-auto bg-slate-950 text-slate-100 p-6 pt-10 pb-20">
            <div className="max-w-4xl mx-auto space-y-6">
              <div>
                <h2 className="text-2xl font-black text-white flex items-center gap-2">
                  Fuentes y Aplicaciones Recomendadas
                </h2>
                <p className="text-slate-400 text-sm mt-1">Directorio de recursos oficiales y comunitarios para la crisis humanitaria</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <a
                  href="https://reliefweb.int"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-2xl hover:scale-[1.02] transition-all no-underline text-left group"
                >
                  <h3 className="font-extrabold text-white text-base group-hover:text-indigo-400 flex items-center justify-between">
                    ReliefWeb <span>↗</span>
                  </h3>
                  <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                    Portal líder en información humanitaria global de la Oficina de las Naciones Unidas para la Coordinación de Asuntos Humanitarios (OCHA).
                  </p>
                </a>

                <a
                  href="https://www.r4v.info"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-2xl hover:scale-[1.02] transition-all no-underline text-left group"
                >
                  <h3 className="font-extrabold text-white text-base group-hover:text-indigo-400 flex items-center justify-between">
                    Plataforma R4V <span>↗</span>
                  </h3>
                  <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                    Coordinación interagencial para refugiados y migrantes de Venezuela, liderada por ACNUR y OIM con datos geolocalizados y reportes de insumos.
                  </p>
                </a>

                <a
                  href="https://www.icrc.org/es/donde-trabajamos/america/venezuela"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-2xl hover:scale-[1.02] transition-all no-underline text-left group"
                >
                  <h3 className="font-extrabold text-white text-base group-hover:text-indigo-400 flex items-center justify-between">
                    Cruz Roja en Venezuela <span>↗</span>
                  </h3>
                  <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                    Apoyo directo en salud, agua, saneamiento y distribución de insumos en las zonas más afectadas por la emergencia sismica.
                  </p>
                </a>

                <a
                  href="https://www.unocha.org/venezuela"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-2xl hover:scale-[1.02] transition-all no-underline text-left group"
                >
                  <h3 className="font-extrabold text-white text-base group-hover:text-indigo-400 flex items-center justify-between">
                    OCHA Venezuela <span>↗</span>
                  </h3>
                  <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                    Planes de respuesta humanitaria, monitoreo de fondos de emergencia y reportes actualizados de puentes aéreos.
                  </p>
                </a>
              </div>

              <div className="bg-indigo-950/30 border border-indigo-850/40 p-5 rounded-2xl">
                <h4 className="font-extrabold text-indigo-300 text-sm">💡 Sugerencia Comunitaria</h4>
                <p className="text-indigo-200/80 text-xs mt-1 leading-relaxed">
                  Si conoces otra iniciativa, mapa activo o recurso digital que deba figurar en este directorio global, por favor utiliza el botón de 💬 reporte en el mapa principal para hacérnoslo saber.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Offline backup banner */}
      {isOffline && !loading && activeTab === 'map' && (
        <div className="absolute top-16 left-4 right-4 z-[1000] rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-800 flex items-center justify-between shadow-lg font-bold">
          <span className="flex items-center gap-1.5">
            <WifiOff className="h-4 w-4 text-amber-600 animate-pulse" />
            Modo Sin Conexión: Mostrando datos guardados localmente.
          </span>
          <button
            onClick={() => {
              setLoading(true);
              fetchCenters();
            }}
            className="text-amber-900 underline hover:text-amber-950 font-bold ml-2 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && !isOffline && !loading && activeTab === 'map' && (
        <div className="absolute top-16 left-4 right-4 z-[1000] rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700 flex items-center justify-between shadow-lg">
          <span>{error}</span>
          <button
            onClick={() => {
              setLoading(true);
              fetchCenters();
            }}
            className="text-red-800 font-bold underline ml-2 hover:text-red-950 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Modal (Create / Edit) */}
      <CenterFormModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={handleAddCenter}
        onUpdate={handleUpdateCenter}
        editingCenter={editingCenter}
        onSelectManualLocation={startManualLocationSelection}
        manualLat={manualLat}
        manualLng={manualLng}
      />

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        onSubmit={handleSendFeedback}
      />

      {/* Image Modal for Multimodal AI Analysis */}
      {isImageModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm shadow-inner" onClick={closeImageModal} />

          {/* Card */}
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 overflow-y-auto max-h-[90vh] z-10">
            <div className="flex justify-between items-start mb-4 pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-600 animate-pulse" />
                  Escanear Insumos con IA
                </h3>
                <p className="text-xs text-slate-500 mt-1">Sube una foto de suministros o pizarra para analizarla con Gemini</p>
              </div>
              <button onClick={closeImageModal} className="p-1 rounded-full text-slate-400 hover:bg-slate-100 transition-colors cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Dropzone / Upload area */}
              {!selectedImage ? (
                <label className="border-2 border-dashed border-slate-200 hover:border-indigo-500 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors bg-slate-50 hover:bg-slate-50/50">
                  <Upload className="h-10 w-10 text-slate-400" />
                  <span className="text-sm font-bold text-slate-750">Seleccionar o soltar imagen</span>
                  <span className="text-xs text-slate-450">Formatos: PNG, JPG, WEBP (Máx 4MB)</span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              ) : (
                <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-50 max-h-48 flex justify-center">
                  <img src={selectedImage} alt="Preview" className="object-contain max-h-48" />
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="absolute top-2 right-2 bg-slate-900/70 text-white rounded-full p-1.5 hover:bg-slate-900 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Target Selector */}
              {selectedImage && !analysisResult && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">¿Dónde guardar esta información?</label>
                  <select
                    value={imageTargetCenterId}
                    onChange={(e) => setImageTargetCenterId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 bg-white outline-none focus:border-indigo-500 transition-all font-sans"
                  >
                    <option value="">✨ Crear un centro nuevo (Estado Pendiente)</option>
                    {centers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.responsable} ({c.direccion.slice(0, 30)}...)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Action Buttons */}
              {selectedImage && !analysisResult && !isAnalyzing && (
                <button
                  onClick={handleAnalyzeImage}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" />
                  Analizar con Gemini 2.5 Flash
                </button>
              )}

              {isAnalyzing && (
                <div className="flex flex-col items-center justify-center py-6 gap-3">
                  <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
                  <p className="text-xs text-slate-500 font-bold">La IA está leyendo y procesando la imagen...</p>
                </div>
              )}

              {analysisError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-750 p-3.5 rounded-xl text-xs font-semibold">
                  <AlertCircle className="h-5 w-5 text-red-650 flex-shrink-0" />
                  <span>{analysisError}</span>
                </div>
              )}

              {/* Validation helper status */}
              {(() => {
                const isExtractedDataValid = 
                  editableExtracted.responsable.trim() !== '' &&
                  editableExtracted.responsable !== 'Centro de Acopio Identificado' &&
                  editableExtracted.direccion.trim() !== '' &&
                  editableExtracted.direccion !== 'Dirección por confirmar' &&
                  editableExtracted.pais.trim() !== '';

                return (
                  <>
                    {/* Review Form for New Centers */}
                    {analysisResult && !analysisResult.updated && !analysisResult.saved && (
                      <div className="space-y-4">
                        <div className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 border font-semibold ${
                          isExtractedDataValid 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-850' 
                            : 'bg-amber-50 border-amber-200 text-amber-850'
                        }`}>
                          <AlertCircle className={`h-5 w-5 flex-shrink-0 ${isExtractedDataValid ? 'text-indigo-600' : 'text-amber-600'}`} />
                          <div>
                            <p className="font-extrabold">{isExtractedDataValid ? '✨ Datos listos para guardar' : '⚠️ Información obligatoria faltante'}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {isExtractedDataValid 
                                ? 'Se han extraído todos los datos requeridos. Puedes ajustarlos o hacer clic en "Registrar Centro".' 
                                : 'Gemini no pudo encontrar toda la información obligatoria. Completa los campos marcados en rojo para poder registrar el centro.'
                              }
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3 border border-slate-200 rounded-xl p-4 bg-slate-50 text-xs text-slate-800">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre / Responsable *</label>
                            <input
                              type="text"
                              value={editableExtracted.responsable}
                              onChange={(e) => setEditableExtracted({ ...editableExtracted, responsable: e.target.value })}
                              className={`w-full bg-white border rounded-lg px-3 py-2 outline-none text-slate-800 text-xs transition-all ${
                                editableExtracted.responsable.trim() === '' || editableExtracted.responsable === 'Centro de Acopio Identificado'
                                  ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                                  : 'border-slate-300 focus:border-indigo-500'
                              }`}
                              placeholder="Ej: Cruz Roja / Iglesia San José"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Dirección Exacta *</label>
                            <textarea
                              value={editableExtracted.direccion}
                              onChange={(e) => setEditableExtracted({ ...editableExtracted, direccion: e.target.value })}
                              rows={2}
                              className={`w-full bg-white border rounded-lg px-3 py-2 outline-none text-slate-800 text-xs transition-all resize-none ${
                                editableExtracted.direccion.trim() === '' || editableExtracted.direccion === 'Dirección por confirmar'
                                  ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                                  : 'border-slate-300 focus:border-indigo-500'
                              }`}
                              placeholder="Ej: Calle Principal #123, al lado de la escuela"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">País *</label>
                              <input
                                type="text"
                                value={editableExtracted.pais}
                                onChange={(e) => setEditableExtracted({ ...editableExtracted, pais: e.target.value })}
                                className={`w-full bg-white border rounded-lg px-3 py-2 outline-none text-slate-800 text-xs transition-all ${
                                  editableExtracted.pais.trim() === ''
                                    ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                                    : 'border-slate-300 focus:border-indigo-500'
                                }`}
                                placeholder="Ej: Venezuela, Colombia, etc."
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1">Ciudad</label>
                              <input
                                type="text"
                                value={editableExtracted.ciudad}
                                onChange={(e) => setEditableExtracted({ ...editableExtracted, ciudad: e.target.value })}
                                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 outline-none text-slate-800 text-xs focus:border-indigo-500 transition-all"
                                placeholder="Ej: Caracas, Medellín"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Teléfono</label>
                            <input
                              type="text"
                              value={editableExtracted.telefono}
                              onChange={(e) => setEditableExtracted({ ...editableExtracted, telefono: e.target.value })}
                              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 outline-none text-slate-800 text-xs focus:border-indigo-500 transition-all"
                              placeholder="Ej: +58 412 1234567"
                            />
                          </div>

                          {editableExtracted.suministros?.length > 0 && (
                            <div>
                              <span className="font-extrabold text-slate-500 block uppercase text-[9px] tracking-wider mb-1">Disponible</span>
                              <div className="flex flex-wrap gap-1">
                                {editableExtracted.suministros.map((item) => (
                                  <span key={item} className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium">{item}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {editableExtracted.necesita?.length > 0 && (
                            <div>
                              <span className="font-extrabold text-slate-500 block uppercase text-[9px] tracking-wider mb-1">🔴 Necesita</span>
                              <div className="flex flex-wrap gap-1">
                                {editableExtracted.necesita.map((item) => (
                                  <span key={item} className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-medium">{item}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedImage(null);
                              setAnalysisResult(null);
                              setAnalysisError(null);
                            }}
                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer text-center"
                          >
                            Volver a Subir
                          </button>
                          <button
                            onClick={handleSaveExtractedCenter}
                            disabled={!isExtractedDataValid || isAnalyzing}
                            className={`flex-1 font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              isExtractedDataValid
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            Registrar Centro
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Success display */}
                    {analysisResult && (analysisResult.updated || analysisResult.saved) && (
                      <div className="space-y-4">
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-850 p-3.5 rounded-xl text-xs flex items-center gap-2 font-bold">
                          <Check className="h-4.5 w-4.5 text-emerald-600 flex-shrink-0" />
                          <div>
                            <p className="text-slate-900 font-extrabold">¡Guardado con éxito!</p>
                            <p className="text-[11px] text-emerald-700 font-normal mt-0.5 font-sans">
                              {analysisResult.updated 
                                ? 'Los suministros del centro de acopio existente han sido actualizados con el análisis de la IA.'
                                : 'El nuevo centro de acopio ha sido registrado en la plataforma en vivo.'
                              }
                            </p>
                          </div>
                        </div>

                        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2.5 text-xs text-slate-800">
                          <div className="flex items-start gap-1.5">
                            <User className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <span className="font-extrabold text-slate-500 block uppercase text-[9px] tracking-wider">Responsable</span>
                              <span className="text-slate-855 font-bold">{analysisResult.extracted.responsable}</span>
                            </div>
                          </div>

                          <div className="flex items-start gap-1.5">
                            <MapPin className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <span className="font-extrabold text-slate-500 block uppercase text-[9px] tracking-wider">Dirección</span>
                              <span>{analysisResult.extracted.direccion} ({analysisResult.extracted.ciudad || ''}, {analysisResult.extracted.pais})</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={closeImageModal}
                          className="w-full bg-slate-900 hover:bg-slate-850 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                        >
                          Entendido / Cerrar
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation — mobile only */}
      <nav className="bottom-nav sm:!hidden">
        <button
          type="button"
          className={`bottom-nav-item relative ${activeTab === 'map' ? 'active' : ''}`}
          onClick={() => setActiveTab('map')}
        >
          <Map className="nav-icon" />
          <span className="nav-label">Mapa</span>
        </button>
        <button
          type="button"
          className={`bottom-nav-item relative ${activeTab === 'vuelos' ? 'active' : ''}`}
          onClick={() => setActiveTab('vuelos')}
        >
          <Plane className="nav-icon" />
          <span className="nav-label">Vuelos</span>
        </button>
        <button
          type="button"
          className={`bottom-nav-item relative ${activeTab === 'fuentes' ? 'active' : ''}`}
          onClick={() => setActiveTab('fuentes')}
        >
          <LinkIcon className="nav-icon" />
          <span className="nav-label">Recursos</span>
        </button>
      </nav>
    </main>
  );
}
