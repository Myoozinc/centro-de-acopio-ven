import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function validateAuth(password: string): 'admin' | 'moderador' | null {
  if (password === process.env.ADMIN_PASSWORD) return 'admin';
  if (password === process.env.MODERATOR_PASSWORD) return 'moderador';
  return null;
}

function cleanHtml(html: string): string {
  // Remove script and style tags and their contents
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  // Remove all other HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Compress whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text.slice(0, 40000); // limit to 40k chars to avoid token blowout
}

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

export async function POST(req: Request) {
  try {
    const password = req.headers.get('x-auth-password') || '';
    const role = validateAuth(password);

    if (!role) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key no configurada' }, { status: 500 });
    }

    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: 'Falta el URL para analizar' }, { status: 400 });
    }

    // 1. Fetch external webpage HTML
    let htmlContent = '';
    try {
      const pageRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
        next: { revalidate: 0 }
      });

      if (!pageRes.ok) {
        throw new Error(`Código de estado HTTP ${pageRes.status}`);
      }
      htmlContent = await pageRes.text();
    } catch (fetchErr: any) {
      return NextResponse.json({ error: `Error al acceder al sitio web: ${fetchErr.message}` }, { status: 500 });
    }

    // 2. Clean HTML content
    const cleanedText = cleanHtml(htmlContent);
    if (!cleanedText) {
      return NextResponse.json({ error: 'El sitio web no devolvió contenido de texto legible.' }, { status: 400 });
    }

    // 3. Prompt Gemini to extract data
    const prompt = `Analiza el siguiente texto extraído de una página web humanitaria/redes sociales. 
Tu tarea es identificar y extraer información sobre CENTROS DE ACOPIO, puntos de recolección de donaciones o ayuda humanitaria activos para la emergencia sismica de Venezuela en el mundo.

Texto de la página web:
"""
${cleanedText}
"""

Devuelve ÚNICAMENTE un JSON array con hasta 5 centros humanitarios encontrados (no expliques nada, no agregues código markdown, solo el JSON array).
Si el texto no contiene centros de acopio claros, devuelve un array vacío [].

Cada objeto del array debe seguir este formato exacto:
{
  "responsable": "Nombre de la organización o responsable del centro (máx 200 caracteres)",
  "direccion": "Dirección completa y detallada (máx 400 caracteres)",
  "pais": "País donde se ubica (ej. 'Venezuela', 'Colombia', 'España', etc.)",
  "ciudad": "Ciudad (ej. 'Bogotá', 'Caracas', 'Madrid', etc.)",
  "telefono": "Teléfono de contacto o null si no se menciona",
  "suministros": ["ropa", "alimentos", "medicinas"], // Suministros que ya tienen o aceptan
  "necesita": ["agua", "medicinas"], // Suministros que les faltan o solicitan con urgencia
  "lat": 10.4806, // Latitud estimada (trata de buscar coordenadas reales para la ciudad/dirección si la conoces)
  "lng": -66.9036 // Longitud estimada (trata de buscar coordenadas reales para la ciudad/dirección si la conoces)
}

Reglas importantes:
- Si no encuentras coordenadas geográficas en el texto, estima las coordenadas según la ciudad o el país de forma aproximada pero válida.
- Devuelve únicamente el JSON. No markdown.`;

    const geminiData = await queryGeminiWithRetry(prompt);
    const rawText: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    
    // Extract JSON array
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ success: true, count: 0, message: 'No se encontraron centros estructurados por la IA.' });
    }

    const rawCenters = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(rawCenters) || rawCenters.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'No se identificaron centros de acopio en el enlace.' });
    }

    // 4. Connect with Supabase and insert
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
        estado: 'pendiente', // Insert in pending status for review
        fuente: 'ia_gemini',
        verificaciones: 0,
        updated_at: new Date().toISOString(),
      }));

    if (centersToInsert.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'La información extraída estaba incompleta para ser registrada.' });
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
  } catch (err: any) {
    console.error('Error en analizar-enlace:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
