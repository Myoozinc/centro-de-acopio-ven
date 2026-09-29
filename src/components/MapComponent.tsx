'use client';

import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Phone, Trash2, MapPin, Search, Loader2, X, Share2, Check, Navigation } from 'lucide-react';
import { MapContainer, Marker, Popup, TileLayer, useMapEvents, useMap, Polyline } from 'react-leaflet';

import type { CentroDeAcopio, CentroImagen } from '@/types';
import { supabase } from '@/lib/supabase';

// Fix Leaflet default marker icons — use CDN URLs for reliable production builds
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const CARACAS_CENTER: [number, number] = [10.4806, -66.9036];
const DEFAULT_ZOOM = 13;
const MIN_ZOOM = 6;

// Venezuela geographic bounds with padding
const VENEZUELA_BOUNDS: L.LatLngBoundsExpression = [
  [0.5, -73.5],   // Southwest corner
  [16.0, -59.5],  // Northeast corner
];
const VENEZUELA_MIN_ZOOM = 6;
const VENEZUELA_MAX_ZOOM = 18;
const GLOBAL_MIN_ZOOM = 2;
const GLOBAL_MAX_ZOOM = 18;

const COUNTRIES = [
  { name: 'Todos', code: 'all', emoji: '🌎', center: [10.4806, -66.9036] as [number, number], zoom: 3 },
  { name: 'Venezuela', code: 've', emoji: '🇻🇪', center: [10.4806, -66.9036] as [number, number], zoom: 6 },
  { name: 'Colombia', code: 'co', emoji: '🇨🇴', center: [4.7110, -74.0721] as [number, number], zoom: 6 },
  { name: 'Chile', code: 'cl', emoji: '🇨🇱', center: [-33.4489, -70.6693] as [number, number], zoom: 6 },
  { name: 'España', code: 'es', emoji: '🇪🇸', center: [40.4168, -3.7038] as [number, number], zoom: 6 },
  { name: 'EE.UU.', code: 'us', emoji: '🇺🇸', center: [37.0902, -95.7129] as [number, number], zoom: 4 },
];

const FILTER_OPTIONS = [
  'Todos',
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
];

// Helper component to track center coords in selection mode
function MapCenterTracker({ onCenterChange }: { onCenterChange: (lat: number, lng: number) => void }) {
  const map = useMapEvents({
    moveend() {
      const center = map.getCenter();
      onCenterChange(center.lat, center.lng);
    },
  });
  return null;
}

// Helper component to smoothly pan/zoom the map to specific coordinates
function SearchMapFlyer({ coords, zoom = 16 }: { coords: [number, number] | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.setView(coords, zoom, { animate: true, duration: 1.5 });
    }
  }, [coords, zoom, map]);
  return null;
}

// Helper component to dynamically set/remove map bounds based on appMode
function MapBoundsController({ appMode }: { appMode: 'venezuela' | 'international' }) {
  const map = useMap();
  useEffect(() => {
    if (appMode === 'venezuela') {
      map.setMaxBounds(VENEZUELA_BOUNDS);
      map.setMinZoom(VENEZUELA_MIN_ZOOM);
      map.setMaxZoom(VENEZUELA_MAX_ZOOM);
      map.options.maxBoundsViscosity = 1.0;
    } else {
      map.setMaxBounds([[-90, -180], [90, 180]]);
      map.setMinZoom(GLOBAL_MIN_ZOOM);
      map.setMaxZoom(GLOBAL_MAX_ZOOM);
      map.options.maxBoundsViscosity = 0;
    }
  }, [appMode, map]);
  return null;
}

// Freshness level based on updated_at
function getFreshnessLevel(dateString?: string): { level: 'recent' | 'normal' | 'outdated' | 'stale'; color: string; borderColor: string; label: string; opacity: number } {
  if (!dateString) return { level: 'stale', color: '#94a3b8', borderColor: '#64748b', label: '> 7 días', opacity: 0.55 };
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) return { level: 'recent', color: '#10b981', borderColor: '#059669', label: '< 24h', opacity: 1 };
    if (diffHours < 72) return { level: 'normal', color: '#f59e0b', borderColor: '#d97706', label: '1-3 días', opacity: 0.9 };
    if (diffHours < 168) return { level: 'outdated', color: '#f97316', borderColor: '#ea580c', label: '3-7 días', opacity: 0.75 };
    return { level: 'stale', color: '#94a3b8', borderColor: '#64748b', label: '> 7 días', opacity: 0.55 };
  } catch {
    return { level: 'stale', color: '#94a3b8', borderColor: '#64748b', label: '> 7 días', opacity: 0.55 };
  }
}

// Custom colored marker icons using DivIcon
function createMarkerIcon(centro: CentroDeAcopio) {
  const needsCount = centro.necesita?.length || 0;
  const hasSupplies = centro.suministros?.length || 0;

  // Color: red if needs things, yellow if has some needs, green if all good
  let bgColor = '#10b981'; // emerald-500
  let borderColor = '#059669'; // emerald-600
  let emoji = '✅';

  if (needsCount >= 3) {
    bgColor = '#ef4444'; // red-500
    borderColor = '#dc2626';
    emoji = '🆘';
  } else if (needsCount > 0) {
    bgColor = '#f59e0b'; // amber-500
    borderColor = '#d97706';
    emoji = '⚠️';
  }

  const badgeText = hasSupplies > 0 ? `${hasSupplies}` : '0';

  // Freshness indicator
  const freshness = getFreshnessLevel(centro.updated_at || centro.created_at);
  const pulseStyle = freshness.level === 'recent'
    ? 'animation: freshness-pulse 2.5s ease-in-out infinite;'
    : '';

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        position: relative;
        width: 44px;
        height: 52px;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        opacity: ${freshness.opacity};
        transition: opacity 0.3s ease;
      ">
        <!-- Freshness ring -->
        <div style="
          position: absolute;
          top: -2px;
          left: 50%;
          transform: translateX(-50%) rotate(-45deg);
          width: 42px;
          height: 42px;
          border-radius: 50% 50% 50% 0;
          border: 2.5px solid ${freshness.color};
          ${pulseStyle}
          pointer-events: none;
        "></div>
        <div style="
          width: 36px;
          height: 36px;
          background: ${bgColor};
          border: 3px solid ${borderColor};
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          margin-top: 1px;
        ">
          <span style="
            transform: rotate(45deg);
            font-size: 14px;
            line-height: 1;
          ">${emoji}</span>
        </div>
        <div style="
          position: absolute;
          top: -6px;
          right: -2px;
          background: white;
          color: ${borderColor};
          font-size: 10px;
          font-weight: 800;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid ${borderColor};
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        ">${badgeText}</div>
      </div>
    `,
    iconSize: [44, 52],
    iconAnchor: [22, 52],
    popupAnchor: [0, -52],
  });
}

// Custom pulsing blue icon for user location
const createUserLocationIcon = () => {
  return L.divIcon({
    className: 'user-location-marker',
    html: `
      <div style="
        position: relative;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          position: absolute;
          width: 20px;
          height: 20px;
          background: rgba(59, 130, 246, 0.4);
          border-radius: 50%;
          animation: pulse-ring 2s infinite ease-out;
        "></div>
        <div style="
          width: 12px;
          height: 12px;
          background: #3b82f6;
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        "></div>
      </div>
      <style>
        @keyframes pulse-ring {
          0% { transform: scale(0.6); opacity: 1; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      </style>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

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

interface MapComponentProps {
  centers: CentroDeAcopio[];
  onAddCenter: () => void;
  onEditCenter: (center: CentroDeAcopio) => void;
  onDeleteCenter: (id: string) => void;
  isSelectingLocation?: boolean;
  onConfirmLocation?: (lat: number, lng: number) => void;
  onCancelSelection?: () => void;
  activeCenterId?: string | null;
  onVerifyCenter?: (id: string) => Promise<void>;
  appMode?: 'venezuela' | 'international';
  statusFilter?: 'todos' | 'urgente' | 'necesitan' | 'abastecidos';
}

export default function MapComponent({
  centers,
  onAddCenter,
  onEditCenter,
  onDeleteCenter,
  isSelectingLocation = false,
  onConfirmLocation,
  onCancelSelection,
  activeCenterId,
  onVerifyCenter,
  appMode = 'international',
  statusFilter = 'todos',
}: MapComponentProps) {
  const [centerCoords, setCenterCoords] = useState<{ lat: number; lng: number }>({
    lat: CARACAS_CENTER[0],
    lng: CARACAS_CENTER[1],
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<[number, number] | null>(null);

  const [selectedCountry, setSelectedCountry] = useState('Todos');
  const [flyToCoords, setFlyToCoords] = useState<[number, number] | null>(null);
  const [flyToZoom, setFlyToZoom] = useState<number>(DEFAULT_ZOOM);

  // User location states
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // Currently opened popup center for drawing routing/reference line
  const [selectedCenterForRouting, setSelectedCenterForRouting] = useState<CentroDeAcopio | null>(null);

  // Supply filtering state
  const [selectedFilter, setSelectedFilter] = useState('Todos');

  // Verify list (loaded from localStorage to prevent double voting)
  const [verifiedList, setVerifiedList] = useState<string[]>([]);

  // Estados de imágenes de suministros y visor
  const [centerPhotos, setCenterPhotos] = useState<{ [key: string]: CentroImagen[] }>({});
  const [loadingPhotos, setLoadingPhotos] = useState<boolean>(false);
  const [uploadPhotoCenterId, setUploadPhotoCenterId] = useState<string | null>(null);
  const [selectedFullscreenPhoto, setSelectedFullscreenPhoto] = useState<string | null>(null);

  // Estados de formulario de subida de fotos
  const [uploadPhotoType, setUploadPhotoType] = useState<'disponible' | 'necesita'>('disponible');
  const [uploadPhotoDesc, setUploadPhotoDesc] = useState<string>('');
  const [uploadPhotoImage, setUploadPhotoImage] = useState<string>(''); // base64 string
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);

  // Función para obtener imágenes del centro desde Supabase (Lazy Fetch)
  const fetchPhotos = async (centroId: string) => {
    setLoadingPhotos(true);
    try {
      const { data, error } = await supabase
        .from('centro_imagenes')
        .select('*')
        .eq('centro_id', centroId)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setCenterPhotos((prev) => ({ ...prev, [centroId]: data }));
      }
    } catch (err) {
      console.error('Error fetching photos:', err);
    } finally {
      setLoadingPhotos(false);
    }
  };

  // Re-centrar mapa según el modo seleccionado
  useEffect(() => {
    if (appMode === 'venezuela') {
      setSelectedCountry('Venezuela');
      setFlyToCoords(CARACAS_CENTER);
      setFlyToZoom(6);
      setSelectedCoords(CARACAS_CENTER);
    } else {
      setSelectedCountry('Todos');
      setFlyToCoords([10.4806, -66.9036]);
      setFlyToZoom(3);
      setSelectedCoords([10.4806, -66.9036]);
    }
  }, [appMode]);

  // Refs for auto-opening popup
  const markerRefs = useRef<{ [key: string]: L.Marker | null }>({});

  // Request user GPS on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.warn('GPS permission denied or unavailable:', error);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('verified_centers');
    if (saved) {
      setVerifiedList(JSON.parse(saved));
    }
  }, []);

  // Handle active center tracking from URL parameters
  useEffect(() => {
    if (activeCenterId && centers.length > 0) {
      const found = centers.find((c) => c.id === activeCenterId);
      if (found) {
        setSelectedCoords([found.lat, found.lng]);
        setTimeout(() => {
          if (markerRefs.current[activeCenterId]) {
            markerRefs.current[activeCenterId]?.openPopup();
          }
        }, 800);
      }
    }
  }, [activeCenterId, centers]);

  // Debounce and fetch suggestion address coords from Nominatim
  useEffect(() => {
    if (searchQuery.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const activeCountryObj = COUNTRIES.find(c => c.name === selectedCountry);
        let countryCode = activeCountryObj && activeCountryObj.code !== 'all' ? activeCountryObj.code : '';
        // Force Venezuela country code when in Venezuela mode
        if (appMode === 'venezuela' && !countryCode) {
          countryCode = 've';
        }
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            searchQuery
          )}${countryCode ? `&countrycodes=${countryCode}` : ''}&limit=5`,
          {
            headers: {
              'Accept-Language': 'es',
            },
          }
        );
        const data = await res.json();
        setSuggestions(data || []);
      } catch (err) {
        console.error('Error fetching address suggestions:', err);
      } finally {
        setIsSearching(false);
      }
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, appMode, selectedCountry]);

  const handleCenterChange = (lat: number, lng: number) => {
    setCenterCoords({ lat, lng });
  };

  const handleVerifyClick = async (id: string) => {
    if (verifiedList.includes(id) || !onVerifyCenter) return;
    try {
      const newList = [...verifiedList, id];
      setVerifiedList(newList);
      localStorage.setItem('verified_centers', JSON.stringify(newList));
      await onVerifyCenter(id);
    } catch (err) {
      console.error('Error verifying center:', err);
    }
  };

  const handleShare = async (centro: CentroDeAcopio) => {
    const shareUrl = `${window.location.origin}/?centro=${centro.id}`;
    const shareText = `Centro de Acopio: ${centro.responsable}. Dirección: ${centro.direccion}. Suministros: ${centro.suministros.join(', ')}.`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Centro de Acopio Vecinal',
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert('¡Enlace de ubicación copiado! Compártelo en WhatsApp.');
      } catch (err) {
        console.error('Error copying link:', err);
      }
    }
  };

  // Live distance calculation in meters/kms
  const calculateDistanceText = (centro: CentroDeAcopio) => {
    if (!userLocation) return null;
    const userLatLng = L.latLng(userLocation[0], userLocation[1]);
    const centerLatLng = L.latLng(centro.lat, centro.lng);
    const distanceMeters = userLatLng.distanceTo(centerLatLng);

    if (distanceMeters < 1000) {
      return `A ${Math.round(distanceMeters)} m de ti`;
    } else {
      return `A ${(distanceMeters / 1000).toFixed(1)} km de ti`;
    }
  };

  // Filter centers based on country and selected supply category
  const filteredCenters = centers.filter((centro) => {
    // 1. Restricción por Modo de Aplicación (Venezuela vs Internacional)
    if (appMode === 'venezuela') {
      const cCountry = (centro.pais || '').trim().toLowerCase();
      if (cCountry !== 'venezuela') return false;
    } else {
      // 2. Country filter (sólo en modo internacional)
      if (selectedCountry !== 'Todos') {
        const cCountry = (centro.pais || '').trim().toLowerCase();
        const sCountry = selectedCountry.trim().toLowerCase();
        if (cCountry !== sCountry) return false;
      }
    }
    // 3. Status filter (urgente, necesitan, abastecidos)
    if (statusFilter && statusFilter !== 'todos') {
      const needsCount = centro.necesita?.length || 0;
      if (statusFilter === 'urgente') {
        if (needsCount < 3) return false;
      } else if (statusFilter === 'necesitan') {
        if (needsCount === 0 || needsCount >= 3) return false;
      } else if (statusFilter === 'abastecidos') {
        if (needsCount !== 0) return false;
      }
    }
    // 4. Category filter
    if (selectedFilter === 'Todos') return true;
    return (
      centro.suministros?.includes(selectedFilter) ||
      centro.necesita?.includes(selectedFilter) ||
      centro.sobra?.includes(selectedFilter)
    );
  });

  return (
    <div className="relative h-full w-full">
      {/* Floating Geocoding Search Bar */}
      <div className="absolute top-[84px] sm:top-[96px] left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-96 z-[1000] flex flex-col gap-1.5">
        <div className="relative flex items-center bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200 px-3 py-2.5">
          <Search className="h-4.5 w-4.5 text-slate-400 mr-2 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar calle, sector o ciudad..."
            className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
          />
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600 ml-2 flex-shrink-0" />
          ) : searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSuggestions([]);
              }}
              className="p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors ml-2"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {/* Suggestions Dropdown */}
        {suggestions.length > 0 && (
          <div className="bg-white rounded-xl shadow-2xl border border-slate-150 overflow-hidden z-[1000] max-h-60 overflow-y-auto">
            {suggestions.map((item) => (
              <button
                key={item.place_id}
                type="button"
                onClick={() => {
                  const lat = parseFloat(item.lat);
                  const lon = parseFloat(item.lon);
                  setSelectedCoords([lat, lon]);
                  setFlyToCoords([lat, lon]);
                  setFlyToZoom(16);
                  handleCenterChange(lat, lon);
                  setSearchQuery(item.display_name);
                  setSuggestions([]);
                }}
                className="w-full px-4 py-3 text-left text-xs sm:text-sm text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors flex items-start gap-2.5"
              >
                <MapPin className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="leading-snug">{item.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Horizontal Country Filter Pills */}
      {!isSelectingLocation && appMode === 'international' && (
        <div
          className="absolute top-[134px] sm:top-[150px] left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-96 z-[1000] flex gap-1.5 overflow-x-auto py-1.5 px-2 bg-white/90 backdrop-blur-md rounded-xl shadow-md border border-slate-200/50"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {COUNTRIES.map((opt) => (
            <button
              key={opt.name}
              type="button"
              onClick={() => {
                setSelectedCountry(opt.name);
                setFlyToCoords(opt.center);
                setFlyToZoom(opt.zoom);
              }}
              className={`rounded-full px-3 py-1 text-[11px] font-extrabold transition-all whitespace-nowrap border ${
                selectedCountry === opt.name
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="mr-1">{opt.emoji}</span>
              {opt.name}
            </button>
          ))}
        </div>
      )}

      {/* Horizontal Category Filter Pills */}
      {!isSelectingLocation && (
        <div
          className={`absolute ${appMode === 'international' ? 'top-[178px] sm:top-[196px]' : 'top-[134px] sm:top-[150px]'} left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-96 z-[1000] flex gap-1.5 overflow-x-auto py-1.5 px-2 bg-white/80 backdrop-blur-md rounded-xl shadow-md border border-slate-200/50`}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setSelectedFilter(opt)}
              className={`rounded-full px-3 py-1 text-[11px] font-extrabold transition-all whitespace-nowrap border ${
                selectedFilter === opt
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      <MapContainer
        center={CARACAS_CENTER}
        zoom={DEFAULT_ZOOM}
        minZoom={appMode === 'venezuela' ? VENEZUELA_MIN_ZOOM : GLOBAL_MIN_ZOOM}
        maxZoom={appMode === 'venezuela' ? VENEZUELA_MAX_ZOOM : GLOBAL_MAX_ZOOM}
        maxBounds={appMode === 'venezuela' ? VENEZUELA_BOUNDS : undefined}
        maxBoundsViscosity={appMode === 'venezuela' ? 1.0 : 0}
        scrollWheelZoom
        className="h-full w-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* User live GPS location indicator */}
        {!isSelectingLocation && userLocation && (
          <Marker position={userLocation} icon={createUserLocationIcon()} />
        )}

        {/* Reference straight line from user coordinates to selected popup center */}
        {!isSelectingLocation && userLocation && selectedCenterForRouting && (
          <Polyline
            positions={[userLocation, [selectedCenterForRouting.lat, selectedCenterForRouting.lng]]}
            color="#059669"
            dashArray="6, 12"
            weight={3.5}
          />
        )}

        {/* If selecting location, track center */}
        {isSelectingLocation && (
          <MapCenterTracker onCenterChange={handleCenterChange} />
        )}

        {/* Handle camera flying to selected coordinate/zoom */}
        <SearchMapFlyer coords={flyToCoords} zoom={flyToZoom} />
        <MapBoundsController appMode={appMode} />

        {/* Render markers only if not selecting manual location (to avoid confusion) */}
        {!isSelectingLocation &&
          filteredCenters.map((centro) => (
            <Marker
              key={centro.id}
              position={[centro.lat, centro.lng]}
              icon={createMarkerIcon(centro)}
              ref={(ref) => {
                markerRefs.current[centro.id] = ref;
              }}
              eventHandlers={{
                popupopen: () => {
                  setSelectedCenterForRouting(centro);
                  fetchPhotos(centro.id);
                },
                popupclose: () => setSelectedCenterForRouting(null),
              }}
            >
              <Popup maxWidth={280} minWidth={240}>
                <div className="space-y-3 text-sm">
                  {/* Header */}
                  <div className="border-b border-gray-150 pb-2">
                    <div className="flex justify-between items-start gap-1">
                      <p className="font-bold text-gray-900 text-base leading-tight">{centro.responsable}</p>
                      <button
                        type="button"
                        onClick={() => handleShare(centro)}
                        className="text-slate-400 hover:text-emerald-600 p-1 hover:bg-slate-50 rounded-full transition-colors flex-shrink-0"
                        title="Compartir enlace de ubicación"
                      >
                        <Share2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-gray-500 text-xs mt-1 leading-snug">{centro.direccion}</p>
                    
                    {/* Live distance display */}
                    {userLocation && (
                      <p className="inline-flex items-center gap-1 mt-1.5 text-xs text-slate-600 font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                        <Navigation className="h-3 w-3 text-slate-500 fill-slate-500 rotate-45" />
                        {calculateDistanceText(centro)}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400 font-semibold">
                      {(() => {
                        const fr = getFreshnessLevel(centro.updated_at || centro.created_at);
                        return (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-bold"
                            style={{ background: `${fr.color}18`, color: fr.borderColor, border: `1px solid ${fr.color}40` }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: fr.color, display: 'inline-block', flexShrink: 0 }} />
                            {formatRelativeTime(centro.updated_at || centro.created_at)}
                          </span>
                        );
                      })()}
                      {centro.verificaciones > 0 && (
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.2 rounded-full">
                          ✓ {centro.verificaciones} activos
                        </span>
                      )}
                    </div>
                    {centro.telefono && (
                      <a
                        href={`tel:${centro.telefono}`}
                        className="inline-flex items-center gap-1.5 mt-2.5 text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded-full hover:bg-emerald-100 transition-colors"
                      >
                        <Phone className="h-3 w-3" />
                        {centro.telefono}
                      </a>
                    )}
                  </div>

                  {/* ✅ Disponible */}
                  {centro.suministros?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-emerald-700 mb-1">✅ Disponible:</p>
                      <div className="flex flex-wrap gap-1">
                        {centro.suministros.map((item) => (
                          <span
                            key={item}
                            className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 🔴 Necesita */}
                  {centro.necesita?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-600 mb-1">🔴 Necesita:</p>
                      <div className="flex flex-wrap gap-1">
                        {centro.necesita.map((item) => (
                          <span
                            key={item}
                            className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 📦 Sobra */}
                  {centro.sobra?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-blue-600 mb-1">📦 Sobra / Comparte:</p>
                      <div className="flex flex-wrap gap-1">
                        {centro.sobra.map((item) => (
                          <span
                            key={item}
                            className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Community Verification */}
                  <div className="pt-1">
                    <button
                      type="button"
                      disabled={verifiedList.includes(centro.id)}
                      onClick={() => handleVerifyClick(centro.id)}
                      className={`w-full flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold transition-all ${
                        verifiedList.includes(centro.id)
                          ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                      }`}
                    >
                      {verifiedList.includes(centro.id) ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          Confirmado Activo
                        </>
                      ) : (
                        '¿Sigue Activo? 👍 Confirmar'
                      )}
                    </button>
                  </div>

                  {/* 📸 Fotos de Suministros */}
                  <div className="pt-2.5 border-t border-gray-150">
                    <div className="flex justify-between items-center mb-1.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">📸 Fotos de Suministros</p>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadPhotoCenterId(centro.id);
                          setUploadPhotoType('disponible');
                          setUploadPhotoDesc('');
                          setUploadPhotoImage('');
                        }}
                        className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md transition-colors"
                      >
                        + Agregar
                      </button>
                    </div>

                    {loadingPhotos && !centerPhotos[centro.id] ? (
                      <div className="flex items-center gap-1.5 py-1">
                        <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                        <span className="text-[11px] text-slate-400">Cargando...</span>
                      </div>
                    ) : centerPhotos[centro.id] && centerPhotos[centro.id].length > 0 ? (
                      <div className="grid grid-cols-3 gap-1 max-h-24 overflow-y-auto pr-1">
                        {centerPhotos[centro.id].map((photo) => (
                          <div
                            key={photo.id}
                            onClick={() => setSelectedFullscreenPhoto(photo.imagen)}
                            className="relative aspect-square bg-slate-100 rounded-md overflow-hidden group cursor-pointer hover:opacity-90 active:scale-95 transition-all shadow-sm border border-slate-200/50"
                          >
                            <img
                              src={photo.imagen}
                              alt={photo.descripcion || 'Foto del centro'}
                              className="object-cover w-full h-full"
                            />
                            <div
                              className={`absolute inset-x-0 bottom-0 text-[8px] font-extrabold text-white px-1 py-0.5 truncate leading-none text-center ${
                                photo.tipo === 'disponible' ? 'bg-emerald-600/90' : 'bg-red-600/90'
                              }`}
                            >
                              {photo.tipo === 'disponible' ? 'Hay' : 'Falta'}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">No hay fotos registradas.</p>
                    )}
                  </div>

                  {/* Redirections for Route Guides */}
                  <div className="pt-2 border-t border-gray-150">
                    <p className="text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">¿Cómo llegar?</p>
                    <div className="flex gap-1.5">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${centro.lat},${centro.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm no-underline text-center"
                      >
                        Google Maps
                      </a>
                      <a
                        href={`https://waze.com/ul?ll=${centro.lat},${centro.lng}&navigate=yes`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm no-underline text-center"
                      >
                        Waze
                      </a>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3 pt-2.5 border-t border-gray-150">
                    <button
                      type="button"
                      onClick={() => onEditCenter(centro)}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('¿Seguro que deseas eliminar este centro de acopio? Esta acción no se puede deshacer.')) {
                          onDeleteCenter(centro.id);
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Borrar
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>

      {/* Uber-style selection fixed marker in center */}
      {isSelectingLocation && (
        <div className="absolute inset-0 pointer-events-none z-[1000] flex items-center justify-center">
          <div className="relative flex flex-col items-center select-none">
            {/* Floating Pin Icon */}
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-2xl border-4 border-white -translate-y-6 animate-bounce">
              <MapPin className="h-6 w-6" />
            </div>
            {/* Floor target circle shadow */}
            <div className="w-5 h-2 bg-slate-950/40 rounded-full blur-[2px] -mt-1"></div>
          </div>
        </div>
      )}

      {/* Normal FAB button */}
      {!isSelectingLocation && (
        <button
          type="button"
          onClick={onAddCenter}
          className="absolute bottom-20 sm:bottom-6 left-1/2 z-[1000] -translate-x-1/2 flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-base font-semibold text-white shadow-lg transition-colors active:bg-emerald-700 hover:bg-emerald-700 whitespace-nowrap text-sm sm:text-base"
        >
          <Plus className="h-5 w-5" />
          Registrar mi Centro de Acopio
        </button>
      )}

      {/* Uber selection UI panel */}
      {isSelectingLocation && onConfirmLocation && onCancelSelection && (
        <div className="absolute bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-[92%] max-w-sm bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-4 border border-slate-200 flex flex-col gap-3">
          <div className="text-center">
            <span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700 uppercase tracking-wider mb-1">
              Modo Selección Manual
            </span>
            <p className="text-sm font-bold text-slate-800">Fija el punto de acopio</p>
            <p className="text-xs text-slate-500 mt-0.5">Arrastra o mueve el mapa para centrar el marcador rojo</p>
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onCancelSelection}
              className="flex-1 rounded-lg border border-slate-300 py-2.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onConfirmLocation(centerCoords.lat, centerCoords.lng)}
              className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/10 transition-colors"
            >
              Confirmar aquí
            </button>
          </div>
        </div>
      )}

      {/* Legend */}
      {!isSelectingLocation && (
        <div className="absolute bottom-36 sm:bottom-20 right-3 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg shadow-md px-3 py-2.5 text-xs space-y-1">
          <div className="flex items-center gap-1.5"><span>✅</span> Tiene suministros</div>
          <div className="flex items-center gap-1.5"><span>⚠️</span> Necesita algo</div>
          <div className="flex items-center gap-1.5"><span>🆘</span> Necesita urgente</div>
          <div className="border-t border-slate-200 my-1.5 pt-1.5">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Actualización</p>
            <div className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block', flexShrink: 0 }} /> &lt; 24h</div>
            <div className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', flexShrink: 0 }} /> 1-3 días</div>
            <div className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316', display: 'inline-block', flexShrink: 0 }} /> 3-7 días</div>
            <div className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#94a3b8', display: 'inline-block', flexShrink: 0 }} /> &gt; 7 días</div>
          </div>
        </div>
      )}

      {/* Upload Photo Modal */}
      {uploadPhotoCenterId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-5 py-4 border-b border-slate-150 flex justify-between items-center bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800">📸 Reportar Estado con Foto</h3>
              <button
                type="button"
                onClick={() => setUploadPhotoCenterId(null)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!uploadPhotoImage) {
                  alert('Por favor selecciona o toma una foto.');
                  return;
                }
                setIsUploadingPhoto(true);
                try {
                  const newPhoto = {
                    centro_id: uploadPhotoCenterId,
                    imagen: uploadPhotoImage,
                    tipo: uploadPhotoType,
                    descripcion: uploadPhotoDesc || null,
                  };
                  const { data, error } = await supabase
                    .from('centro_imagenes')
                    .insert([newPhoto])
                    .select('*')
                    .single();

                  if (error) throw error;

                  // Update state immediately
                  setCenterPhotos((prev) => ({
                    ...prev,
                    [uploadPhotoCenterId]: [data, ...(prev[uploadPhotoCenterId] || [])],
                  }));
                  setUploadPhotoCenterId(null);
                } catch (err: any) {
                  alert(`Error al guardar la foto: ${err.message || err}`);
                } finally {
                  setIsUploadingPhoto(false);
                }
              }}
              className="p-5 space-y-4"
            >
              {/* Image selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Foto del Estado</label>
                {!uploadPhotoImage ? (
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-emerald-500 hover:bg-slate-50 transition-colors cursor-pointer relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (reader.result) {
                              setUploadPhotoImage(reader.result as string);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <p className="text-xs font-bold text-slate-500">Haz clic para subir o tomar foto</p>
                    <p className="text-[10px] text-slate-400 mt-1">Soporta PNG, JPG</p>
                  </div>
                ) : (
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                    <img src={uploadPhotoImage} alt="Vista previa" className="object-cover w-full h-full" />
                    <button
                      type="button"
                      onClick={() => setUploadPhotoImage('')}
                      className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1 rounded-full transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Photo Type Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Tipo de Reporte</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setUploadPhotoType('disponible')}
                    className={`flex-1 rounded-lg border py-2 text-xs font-bold transition-all ${
                      uploadPhotoType === 'disponible'
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/10'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    ✅ Hay / Disponible
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadPhotoType('necesita')}
                    className={`flex-1 rounded-lg border py-2 text-xs font-bold transition-all ${
                      uploadPhotoType === 'necesita'
                        ? 'bg-red-500 border-red-500 text-white shadow-sm shadow-red-500/10'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    🔴 Falta / Necesita
                  </button>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">Descripción (Opcional)</label>
                <input
                  type="text"
                  value={uploadPhotoDesc}
                  onChange={(e) => setUploadPhotoDesc(e.target.value)}
                  placeholder="Ej. Pañales talla M recibidos, Falta paracetamol..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-emerald-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUploadPhotoCenterId(null)}
                  className="flex-1 rounded-lg border border-slate-300 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUploadingPhoto}
                  className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 py-2.5 text-xs font-bold text-white shadow-md transition-colors flex items-center justify-center gap-1.5"
                >
                  {isUploadingPhoto ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar Reporte'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fullscreen Photo Modal */}
      {selectedFullscreenPhoto && (
        <div
          className="fixed inset-0 bg-black/90 z-[99999] flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setSelectedFullscreenPhoto(null)}
        >
          <button
            type="button"
            onClick={() => setSelectedFullscreenPhoto(null)}
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full transition-colors z-[100000]"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={selectedFullscreenPhoto}
            alt="Foto ampliada"
            className="max-w-full max-h-full object-contain rounded-lg animate-in zoom-in-95 duration-200"
          />
        </div>
      )}
    </div>
  );
}
