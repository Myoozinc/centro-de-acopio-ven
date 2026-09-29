'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, MapPin, CheckCircle, Loader2, Phone, User, Home, HelpCircle, Globe } from 'lucide-react';

import type { CentroDeAcopio, NuevoCentro } from '@/types';

const SUMINISTROS_OPTIONS = [
  'Agua',
  'Medicinas',
  'Alimentos no perecederos',
  'Linternas',
  'Ropa',
  'Cobijas',
  'Herramientas',
  'Baterías',
];

const NECESITA_OPTIONS = [
  'Agua',
  'Medicinas',
  'Alimentos no perecederos',
  'Linternas',
  'Ropa',
  'Cobijas',
  'Herramientas',
  'Baterías',
  'Voluntarios',
  'Transporte',
  'Generadores eléctricos',
  'Combustible',
];

interface CenterFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (center: NuevoCentro) => Promise<void>;
  onUpdate?: (id: string, center: Partial<NuevoCentro>) => Promise<void>;
  editingCenter?: CentroDeAcopio | null;
  onSelectManualLocation: () => void;
  manualLat?: number | null;
  manualLng?: number | null;
}

export default function CenterFormModal({
  isOpen,
  onClose,
  onSubmit,
  onUpdate,
  editingCenter,
  onSelectManualLocation,
  manualLat,
  manualLng,
}: CenterFormModalProps) {
  const isEditMode = !!editingCenter;

  const [responsable, setResponsable] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [suministros, setSuministros] = useState<string[]>([]);
  const [necesita, setNecesita] = useState<string[]>([]);
  const [sobra, setSobra] = useState<string[]>([]);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [geoError, setGeoError] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [visible, setVisible] = useState(false);
  const [locationMethod, setLocationMethod] = useState<'gps' | 'manual' | null>(null);

  const [pais, setPais] = useState('Venezuela');
  const [ciudad, setCiudad] = useState('');

  // Pre-fill form when editing
  useEffect(() => {
    if (editingCenter && isOpen) {
      setResponsable(editingCenter.responsable);
      setDireccion(editingCenter.direccion);
      setTelefono(editingCenter.telefono || '');
      setSuministros(editingCenter.suministros);
      setNecesita(editingCenter.necesita || []);
      setSobra(editingCenter.sobra || []);
      setLat(editingCenter.lat);
      setLng(editingCenter.lng);
      setGeoStatus('success');
      setLocationMethod(editingCenter.lat ? 'manual' : null);
      setPais(editingCenter.pais || 'Venezuela');
      setCiudad(editingCenter.ciudad || '');
    }
  }, [editingCenter, isOpen]);

  // Sync manual selection coordinates from parent
  useEffect(() => {
    if (manualLat !== undefined && manualLat !== null && manualLng !== undefined && manualLng !== null) {
      setLat(manualLat);
      setLng(manualLng);
      setGeoStatus('success');
      setLocationMethod('manual');
    }
  }, [manualLat, manualLng]);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [isOpen]);

  const resetForm = useCallback(() => {
    setResponsable('');
    setDireccion('');
    setTelefono('');
    setSuministros([]);
    setNecesita([]);
    setSobra([]);
    setLat(null);
    setLng(null);
    setGeoStatus('idle');
    setGeoError('');
    setSubmitStatus('idle');
    setLocationMethod(null);
    setPais('Venezuela');
    setCiudad('');
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => {
      resetForm();
      onClose();
    }, 300);
  };

  const toggleItem = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    item: string
  ) => {
    setList(list.includes(item) ? list.filter((s) => s !== item) : [...list, item]);
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('error');
      setGeoError('Tu navegador no soporta geolocalización.');
      return;
    }
    setGeoStatus('loading');
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude);
        setLng(position.coords.longitude);
        setGeoStatus('success');
        setLocationMethod('gps');
      },
      (error) => {
        setGeoStatus('error');
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGeoError('Permiso de ubicación denegado. Activa el GPS de tu dispositivo.');
            break;
          case error.POSITION_UNAVAILABLE:
            setGeoError('Ubicación no disponible.');
            break;
          case error.TIMEOUT:
            setGeoError('Tiempo de espera agotado.');
            break;
          default:
            setGeoError('Error al obtener ubicación.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const isFormValid =
    responsable.trim() &&
    direccion.trim() &&
    lat !== null &&
    lng !== null &&
    submitStatus !== 'saving';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || lat === null || lng === null) return;

    setSubmitStatus('saving');

    const centerData: NuevoCentro = {
      responsable: responsable.trim(),
      direccion: direccion.trim(),
      telefono: telefono.trim() || undefined,
      suministros,
      necesita,
      sobra,
      lat,
      lng,
      pais: pais.trim() || 'Venezuela',
      ciudad: ciudad.trim() || undefined,
    };

    try {
      if (isEditMode && onUpdate && editingCenter) {
        await onUpdate(editingCenter.id, centerData);
      } else {
        await onSubmit(centerData);
      }
      setSubmitStatus('success');
      setTimeout(() => handleClose(), 1200);
    } catch {
      setSubmitStatus('error');
    }
  };

  return (
    <div className={`fixed inset-0 z-[2000] flex items-end justify-center sm:items-center p-0 sm:p-4 transition-all duration-350 ${
      isOpen ? 'pointer-events-auto' : 'pointer-events-none invisible'
    }`}>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-350 ${
          visible && isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Bottom Sheet on Mobile / Centered Card on Desktop */}
      <div
        className={`relative w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl transition-all duration-350 ease-out transform ${
          visible && isOpen
            ? 'translate-y-0 opacity-100 scale-100'
            : 'translate-y-full sm:translate-y-4 opacity-0 sm:scale-95'
        }`}
        style={{ maxHeight: '92vh' }}
      >
        {/* Visual drag indicator handle on mobile */}
        <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto my-2 sm:hidden" />

        <div className="overflow-y-auto px-5 pb-6 pt-1 sm:px-6 sm:pt-6" style={{ maxHeight: '85vh' }}>
          {/* Header with progress */}
          <div className="mb-5 border-b border-gray-100 pb-3">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                  {isEditMode ? 'Editar Centro de Acopio' : 'Registrar Centro de Acopio'}
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  {isEditMode
                    ? 'Modifica los datos del centro de acopio vecinal.'
                    : 'Registra un nuevo punto de acopio para la comunidad.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Progress bar */}
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${Math.min(100, (
                    (responsable.trim() ? 20 : 0) +
                    (direccion.trim() ? 20 : 0) +
                    (lat !== null && lng !== null ? 25 : 0) +
                    (suministros.length > 0 || necesita.length > 0 ? 20 : 0) +
                    (pais.trim() ? 15 : 0)
                  ))}%`
                }}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 text-right font-medium">
              {Math.min(100, (
                (responsable.trim() ? 20 : 0) +
                (direccion.trim() ? 20 : 0) +
                (lat !== null && lng !== null ? 25 : 0) +
                (suministros.length > 0 || necesita.length > 0 ? 20 : 0) +
                (pais.trim() ? 15 : 0)
              ))}% completo
            </p>
          </div>

          {/* Success screen */}
          {submitStatus === 'success' ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="rounded-full bg-emerald-100 p-4 text-emerald-600 animate-bounce">
                <CheckCircle className="h-12 w-12" />
              </div>
              <p className="text-xl font-bold text-gray-900">
                {isEditMode ? '¡Cambios Guardados!' : '¡Centro Registrado Exitosamente!'}
              </p>
              <p className="text-sm text-gray-500 max-w-xs">
                La información ya está actualizada para todos los ciudadanos en el mapa.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Responsable */}
              <div>
                <label htmlFor="responsable" className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1">
                  <User className="h-4 w-4 text-gray-500" />
                  Nombre del Responsable *
                </label>
                <input
                  type="text"
                  id="responsable"
                  value={responsable}
                  onChange={(e) => setResponsable(e.target.value)}
                  placeholder="Ej: María García / Junta de Vecinos Bloque 3"
                  required
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-sm"
                />
                <p className="text-xs text-gray-400 mt-1 pl-1">
                  Persona, colectivo u organización vecinal a cargo del punto.
                </p>
              </div>

              {/* Teléfono */}
              <div>
                <label htmlFor="telefono" className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1">
                  <Phone className="h-4 w-4 text-gray-500" />
                  Teléfono de Contacto
                </label>
                <input
                  type="tel"
                  id="telefono"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Ej: 0412-1234567"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-sm"
                />
                <p className="text-xs text-gray-400 mt-1 pl-1">
                  Opcional. Permite coordinar entregas o solicitudes directamente.
                </p>
              </div>

              {/* País y Ciudad */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="pais" className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1">
                    <Globe className="h-4 w-4 text-gray-500" />
                    País *
                  </label>
                  <input
                    type="text"
                    id="pais"
                    value={pais}
                    onChange={(e) => setPais(e.target.value)}
                    placeholder="Ej: Venezuela"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-sm"
                  />
                </div>
                <div>
                  <label htmlFor="ciudad" className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    Ciudad
                  </label>
                  <input
                    type="text"
                    id="ciudad"
                    value={ciudad}
                    onChange={(e) => setCiudad(e.target.value)}
                    placeholder="Ej: Caracas"
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-sm"
                  />
                </div>
              </div>

              {/* Dirección */}
              <div>
                <label htmlFor="direccion" className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 mb-1">
                  <Home className="h-4 w-4 text-gray-500" />
                  Dirección o Punto de Referencia *
                </label>
                <input
                  type="text"
                  id="direccion"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Ej: Calle Cují, casa 12-B, frente a la panadería (portón azul)"
                  required
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-sm"
                />
                <p className="text-xs text-gray-400 mt-1 pl-1">
                  Detalla referencias claras del lugar para facilitar la llegada.
                </p>
              </div>

              {/* Ubicación GPS & Manual Map Selection */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <span className="block text-sm font-semibold text-slate-800 mb-2.5 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  Fijar Ubicación Geográfica *
                </span>
                
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleGetLocation}
                    disabled={geoStatus === 'loading'}
                    className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-2.5 text-xs font-bold transition-all ${
                      locationMethod === 'gps' && geoStatus === 'success'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : geoStatus === 'loading'
                        ? 'border-slate-300 bg-slate-100 text-slate-400'
                        : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-400 hover:bg-emerald-50'
                    }`}
                  >
                    {geoStatus === 'loading' ? (
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-600 mb-0.5" />
                    ) : (
                      <MapPin className="h-4 w-4 text-emerald-600 mb-0.5" />
                    )}
                    <span>📍 GPS Actual</span>
                  </button>

                  <button
                    type="button"
                    onClick={onSelectManualLocation}
                    className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-2.5 text-xs font-bold transition-all ${
                      locationMethod === 'manual' && geoStatus === 'success'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-400 hover:bg-emerald-50'
                    }`}
                  >
                    <svg className="h-4 w-4 text-emerald-600 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <span>🗺️ Buscar en Mapa</span>
                  </button>
                </div>

                {geoError && <p className="mt-2 text-xs text-red-500 font-semibold">{geoError}</p>}
                {geoStatus === 'success' && lat !== null && lng !== null && (
                  <div className="mt-3 bg-white rounded-lg border border-slate-100 p-2 text-center shadow-sm">
                    <p className="text-xs text-emerald-800 font-bold flex items-center justify-center gap-1">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Ubicación fijada {locationMethod === 'gps' ? 'por GPS' : 'manualmente'} ✓
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Coords: {lat.toFixed(5)}, {lng.toFixed(5)}
                    </p>
                  </div>
                )}
                {geoStatus !== 'success' && (
                  <p className="text-[10px] text-slate-500 mt-2 text-center">
                    Selecciona una opción para fijar el punto en el mapa de emergencias.
                  </p>
                )}
              </div>

              {/* Suministros Disponibles */}
              <div className="border-t border-gray-100 pt-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-sm">✅</span>
                  <label className="text-sm font-bold text-gray-800">
                    Suministros Disponibles
                  </label>
                </div>
                <p className="text-xs text-gray-400 mb-3 pl-8">
                  ¿Con qué cuenta el centro en este momento? (Opcional)
                </p>
                <div className="flex flex-wrap gap-2 pl-8">
                  {SUMINISTROS_OPTIONS.map((item) => {
                    const selected = suministros.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleItem(suministros, setSuministros, item)}
                        className={`rounded-full px-3.5 py-2 text-xs font-bold transition-all border ${
                          selected
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lo que necesita */}
              <div className="border-t border-gray-100 pt-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-sm">🔴</span>
                  <label className="text-sm font-bold text-gray-800">
                    ¿Qué se necesita con urgencia?
                  </label>
                </div>
                <p className="text-xs text-gray-400 mb-3 pl-8">
                  Ayuda a los donantes y voluntarios a saber qué traer al centro.
                </p>
                <div className="flex flex-wrap gap-2 pl-8">
                  {NECESITA_OPTIONS.map((item) => {
                    const selected = necesita.includes(item);
                    return (
                      <button
                        key={`need-${item}`}
                        type="button"
                        onClick={() => toggleItem(necesita, setNecesita, item)}
                        className={`rounded-full px-3.5 py-2 text-xs font-bold transition-all border ${
                          selected
                            ? 'bg-red-500 border-red-500 text-white shadow-sm'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lo que sobra */}
              <div className="border-t border-gray-100 pt-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-sm">📦</span>
                  <label className="text-sm font-bold text-gray-800">
                    ¿Qué sobra / Se puede compartir?
                  </label>
                </div>
                <p className="text-xs text-gray-400 mb-3 pl-8">
                  Suministros que se tienen en abundancia para transferir a otros centros.
                </p>
                <div className="flex flex-wrap gap-2 pl-8">
                  {SUMINISTROS_OPTIONS.map((item) => {
                    const selected = sobra.includes(item);
                    return (
                      <button
                        key={`surplus-${item}`}
                        type="button"
                        onClick={() => toggleItem(sobra, setSobra, item)}
                        className={`rounded-full px-3.5 py-2 text-xs font-bold transition-all border ${
                          selected
                            ? 'bg-blue-500 border-blue-500 text-white shadow-sm'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Error Box */}
              {submitStatus === 'error' && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700 font-semibold">
                  Error al registrar. Por favor revisa tu conexión a internet e intenta nuevamente.
                </div>
              )}

              {/* Submit Action */}
              <div className="pt-2 border-t border-gray-100 flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 rounded-lg border border-gray-300 bg-white py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!isFormValid}
                  className={`flex-[2] rounded-lg py-3 text-sm font-bold text-white transition-all flex items-center justify-center gap-2 ${
                    isFormValid
                      ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-md shadow-emerald-600/10'
                      : 'bg-gray-300 cursor-not-allowed'
                  }`}
                >
                  {submitStatus === 'saving' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : isEditMode ? (
                    'Guardar Cambios'
                  ) : (
                    'Registrar Centro'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
