import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function validateAuth(password: string): 'admin' | 'moderador' | null {
  if (password === process.env.ADMIN_PASSWORD) return 'admin';
  if (password === process.env.MODERATOR_PASSWORD) return 'moderador';
  return null;
}

// GET — all flights (publicly accessible)
export async function GET(req: Request) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('vuelos_humanitarios')
      .select('*')
      .order('fecha_llegada_estimada', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — create a flight (admin/moderator only)
export async function POST(req: Request) {
  try {
    const password = req.headers.get('x-auth-password') || '';
    const role = validateAuth(password);

    if (!role) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const {
      numero_vuelo,
      aerolinea_organizacion,
      origen,
      destino,
      cargamento,
      estado = 'En Ruta',
      fecha_salida,
      fecha_llegada_estimada,
    } = body;

    if (!numero_vuelo || !aerolinea_organizacion || !origen || !destino) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('vuelos_humanitarios')
      .insert([
        {
          numero_vuelo,
          aerolinea_organizacion,
          origen,
          destino,
          cargamento,
          estado,
          fecha_salida: fecha_salida || null,
          fecha_llegada_estimada: fecha_llegada_estimada || null,
          created_at: new Date().toISOString(),
        },
      ])
      .select('*');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data?.[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — update status or details of a flight (admin/moderator only)
export async function PATCH(req: Request) {
  try {
    const password = req.headers.get('x-auth-password') || '';
    const role = validateAuth(password);

    if (!role) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Falta el ID del vuelo' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('vuelos_humanitarios')
      .update(updates)
      .eq('id', id)
      .select('*');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data?.[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — delete a flight (admin only)
export async function DELETE(req: Request) {
  try {
    const password = req.headers.get('x-auth-password') || '';
    const role = validateAuth(password);

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Solo el administrador puede borrar vuelos' }, { status: 403 });
    }

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Falta el ID del vuelo' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from('vuelos_humanitarios')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
