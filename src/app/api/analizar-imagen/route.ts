import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function queryGeminiMultimodal(
  prompt: string,
  base64Image: string,
  mimeType: string,
  attempt = 1
): Promise<any> {
  const model = 'gemini-2.5-flash';
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
            maxOutputTokens: 2500,
          },
        }),
      }
    );

    if (response.status === 429 || response.status === 503) {
      if (attempt <= 4) {
        const delay = (1 + attempt * 2) * 1000;
        console.warn(`Gemini busy (status ${response.status}). Retrying attempt ${attempt} in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return queryGeminiMultimodal(prompt, base64Image, mimeType, attempt + 1);
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini vision error status ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (err: any) {
    if (attempt <= 4) {
      const delay = (1 + attempt * 2) * 1000;
      console.warn(`Connection failed. Retrying attempt ${attempt} in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return queryGeminiMultimodal(prompt, base64Image, mimeType, attempt + 1);
    }
    throw err;
  }
}

export async function POST(req: Request) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Gemini API key no configurada' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { image, mimeType = 'image/jpeg', centroId } = body;

    if (!image) {
      return NextResponse.json({ error: 'Falta la imagen en formato base64' }, { status: 400 });
    }

    // Process image format
    let base64Data = image;
    let resolvedMimeType = mimeType;

    if (image.startsWith('data:')) {
      const match = image.match(/^data:([^;]+);base64,(.*)$/);
      if (match) {
        resolvedMimeType = match[1];
        base64Data = match[2];
      }
    }

    // Prompt for Gemini Vision
    const prompt = `Analiza esta imagen que puede ser una foto de cajas de insumos, un cartel informativo de ayuda humanitaria o una lista escrita en una pizarra/papel.
Tu tarea es transcribir los insumos y recolectar la información sobre suministros humanitarios y centros de acopio.

Devuelve ÚNICAMENTE un JSON estructurado con este formato:
{
  "responsable": "Nombre de la organización, centro o persona responsable visible, o 'Centro de Acopio Identificado' si no se menciona",
  "direccion": "Dirección completa si se ve, o una descripción de la ubicación física visible, o 'Dirección por confirmar'",
  "pais": "País (ej. 'Venezuela', 'Colombia', 'Chile', 'España' u otro país detectable)",
  "ciudad": "Ciudad detectable o 'Desconocida'",
  "telefono": "Teléfono de contacto visible o null si no hay",
  "suministros": ["ropa", "agua", "alimentos"], // Lista de suministros que están disponibles, donados o listos para ser distribuidos
  "necesita": ["medicinas", "baterías"], // Lista de insumos solicitados con urgencia, que faltan o se necesitan
  "sobra": ["ropa"], // Lista de insumos que sobran o de los cuales hay excedente
  "lat": 10.4806, // Latitud estimada del lugar (trata de aproximar según la ciudad/país que detectes)
  "lng": -66.9036 // Longitud estimada del lugar (trata de aproximar según la ciudad/país que detectes)
}

Reglas importantes:
- Sé lo más específico posible al extraer la lista de suministros, necesidades y excedentes.
- Si no hay dirección o ciudad explícita, trata de deducirlo del contexto visual o del nombre de la organización.
- Devuelve únicamente el JSON. No markdown.`;

    const geminiData = await queryGeminiMultimodal(prompt, base64Data, resolvedMimeType);
    const rawText: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'La IA no pudo estructurar la información de la imagen.' }, { status: 422 });
    }

    const extracted = JSON.parse(jsonMatch[0]);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // If centroId is passed, update the existing center
    if (centroId) {
      // 1. Fetch current center
      const { data: currentCenter, error: fetchErr } = await supabase
        .from('centros_de_acopio')
        .select('*')
        .eq('id', centroId)
        .single();

      if (fetchErr || !currentCenter) {
        return NextResponse.json({ error: 'Centro de acopio no encontrado' }, { status: 404 });
      }

      // Merge supplies
      const mergeArrays = (arr1: any[], arr2: any[]) => {
        const set = new Set([...(arr1 || []), ...(arr2 || [])]);
        return Array.from(set);
      };

      const updatedSuministros = mergeArrays(currentCenter.suministros, extracted.suministros);
      const updatedNecesita = mergeArrays(currentCenter.necesita, extracted.necesita);
      const updatedSobra = mergeArrays(currentCenter.sobra, extracted.sobra);

      const { data: updatedData, error: updateErr } = await supabase
        .from('centros_de_acopio')
        .update({
          suministros: updatedSuministros,
          necesita: updatedNecesita,
          sobra: updatedSobra,
          updated_at: new Date().toISOString(),
        })
        .eq('id', centroId)
        .select('*')
        .single();

      if (updateErr) throw updateErr;

      return NextResponse.json({
        success: true,
        updated: true,
        center: updatedData,
        extracted
      });
    } else {
      // Return the extracted data to the client for validation and review
      return NextResponse.json({
        success: true,
        updated: false,
        extracted
      });
    }
  } catch (err: any) {
    console.error('Error en analizar-imagen:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
