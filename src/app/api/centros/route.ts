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

// GET — all centers for moderator/admin (all estados)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const password = req.headers.get('x-auth-password') || '';
  const role = validateAuth(password);

  if (!role) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const estado = searchParams.get('estado');
  const supabase = getSupabase();

  let query = supabase
    .from('centros_de_acopio')
    .select('*')
    .order('created_at', { ascending: false });

  if (estado) {
    query = query.eq('estado', estado);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

// PATCH — update estado of a center
export async function PATCH(req: Request) {
  const password = req.headers.get('x-auth-password') || '';
  const role = validateAuth(password);

  if (!role) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const { id, estado, notas_moderacion } = body;

  if (!id || !estado) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from('centros_de_acopio')
    .update({
      estado,
      notas_moderacion: notas_moderacion || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

// DELETE — delete a center (admin only)
export async function DELETE(req: Request) {
  const password = req.headers.get('x-auth-password') || '';
  const role = validateAuth(password);

  if (role !== 'admin') {
    return NextResponse.json({ error: 'Solo el admin puede borrar centros' }, { status: 403 });
  }

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Falta el ID' }, { status: 400 });

  const supabase = getSupabase();
  const { error } = await supabase.from('centros_de_acopio').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
