import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;


async function queryGeminiWithRetry(prompt: string, attempt = 1): Promise<any> {
  const model = 'gemini-2.5-flash';
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
            maxOutputTokens: 3000,
          },
        }),
      }
    );

    if (response.status === 429 || response.status === 503) {
      if (attempt <= 4) {
        // Wait longer on each attempt (backoff): 3s, 5s, 7s...
        const delay = (1 + attempt * 2) * 1000;
        console.warn(`Gemini busy (status ${response.status}). Retrying attempt ${attempt} in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return queryGeminiWithRetry(prompt, attempt + 1);
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini error status ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (err: any) {
    if (attempt <= 4) {
      const delay = (1 + attempt * 2) * 1000;
      console.warn(`Connection failed. Retrying attempt ${attempt} in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return queryGeminiWithRetry(prompt, attempt + 1);
    }
    throw err;
  }
}

async function searchCentersWithGemini(): Promise<any[]> {
  const prompt = `Eres un asistente humanitario especializado. Necesito información sobre centros de acopio, organizaciones y puntos de colecta de ayuda humanitaria para venezolanos en el exterior (diáspora venezolana) en el mundo en 2024-2025.

Devuelve ÚNICAMENTE un JSON array válido (sin texto adicional, no markdown, sin explicaciones) con hasta 8 centros verificados o de alta credibilidad en este formato exacto:

[
  {
    "responsable": "Nombre de la organización o responsable",
    "direccion": "Dirección completa del centro",
    "pais": "País donde está el centro",
    "ciudad": "Ciudad",
    "telefono": null,
    "suministros": ["ropa", "alimentos", "medicinas"],
    "necesita": ["agua", "medicinas"],
    "lat": 4.711,
    "lng": -74.0721,
    "fuente_url": "https://ejemplo.com"
  }
]

Busca organizaciones como: Cruz Roja local, Cáritas, ACNUR/UNHCR, OIM/IOM, consulados venezolanos, Venezolanos en el Exterior, Coalición pro-migrante, iglesias que ayuden a venezolanos, embajadas. Países donde hay mucha diáspora venezolana: Colombia, Perú, Chile, Ecuador, Brasil, Argentina, EEUU, España, Panamá, México, Trinidad y Tobago, República Dominicana.

Usa coordenadas reales de las ciudades mencionadas. Si no tienes la dirección exacta del centro, usa la dirección de la organización conocida. Solo devuelve el JSON array.`;

  try {
    const data = await queryGeminiWithRetry(prompt);
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  } catch (err: any) {
    throw new Error(`La IA está experimentando alta demanda en Google actualmente. Por favor intenta de nuevo en unos segundos. Detalles: ${err.message}`);
  }
}

export async function POST(req: Request) {
  const password = req.headers.get('x-auth-password') || '';

  if (
    password !== process.env.ADMIN_PASSWORD &&
    password !== process.env.MODERATOR_PASSWORD
  ) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'Gemini API key no configurada' },
      { status: 500 }
    );
  }

  try {
    const rawCenters = await searchCentersWithGemini();

    if (!Array.isArray(rawCenters) || rawCenters.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: 'La IA no encontró centros nuevos en esta búsqueda.',
      });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const centersToInsert = rawCenters
      .filter((c) => c.responsable && c.direccion && c.lat && c.lng)
      .map((c) => ({
        responsable: String(c.responsable).slice(0, 200),
        direccion: String(c.direccion).slice(0, 400),
        pais: String(c.pais || 'Internacional').slice(0, 100),
        ciudad: c.ciudad ? String(c.ciudad).slice(0, 100) : null,
        telefono: c.telefono ? String(c.telefono) : null,
        suministros: Array.isArray(c.suministros) ? c.suministros.slice(0, 20) : [],
        necesita: Array.isArray(c.necesita) ? c.necesita.slice(0, 20) : [],
        sobra: [],
        lat: Number(c.lat),
        lng: Number(c.lng),
        estado: 'pendiente',
        fuente: 'ia_gemini',
        verificaciones: 0,
        updated_at: new Date().toISOString(),
      }));

    if (centersToInsert.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: 'Los centros encontrados no tenían suficiente información para agregarlos.',
      });
    }

    const { data, error } = await supabase
      .from('centros_de_acopio')
      .insert(centersToInsert)
      .select('id, responsable, pais');

    if (error) throw error;

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      centers: data,
    });
  } catch (error: any) {
    console.error('Error en buscar-ia:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
