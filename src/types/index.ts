export interface CentroDeAcopio {
  id: string;
  responsable: string;
  direccion: string;
  suministros: string[];
  necesita: string[];
  sobra: string[];
  lat: number;
  lng: number;
  telefono?: string;
  created_at: string;
  verificaciones: number;
  updated_at: string;
  // Nuevos campos
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  pais?: string;
  ciudad?: string;
  fuente: 'manual' | 'ia_gemini' | 'reliefweb';
  notas_moderacion?: string;
}

export type NuevoCentro = Omit<CentroDeAcopio, 'id' | 'created_at' | 'verificaciones' | 'updated_at' | 'estado' | 'fuente'> & {
  estado?: 'pendiente' | 'aprobado' | 'rechazado';
  fuente?: 'manual' | 'ia_gemini' | 'reliefweb';
};

export type CentroUpdate = Partial<Omit<CentroDeAcopio, 'id' | 'created_at' | 'verificaciones' | 'updated_at'>>;

export interface FeedbackInput {
  nombre?: string;
  mensaje: string;
  contacto?: string;
}

export interface VisitaInput {
  pais: string;
  ciudad?: string;
}

export interface CentroImagen {
  id: string;
  centro_id: string;
  imagen: string; // Base64 Data URL
  tipo: 'disponible' | 'necesita';
  descripcion?: string;
  created_at: string;
}

