import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { pais = 'Desconocido', ciudad } = body;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Obtener IP en el servidor
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const ip = realIp || (forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1');

    const baseRecord = {
      pais,
      ciudad: ciudad || null,
      fecha: new Date().toISOString().split('T')[0],
    };

    // Intentar insertar incluyendo el campo 'ip'
    const { error } = await supabase.from('visitas_sesiones').insert([{ ...baseRecord, ip }]);
    
    // Si la columna 'ip' no existe en la BD por falta de migración, se inserta normalmente sin ella
    if (error && error.message.includes('column "ip" of relation "visitas_sesiones" does not exist')) {
      await supabase.from('visitas_sesiones').insert([baseRecord]);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false });
  }
}

export async function GET(req: Request) {
  const password = req.headers.get('x-auth-password') || '';
  if (
    password !== process.env.ADMIN_PASSWORD &&
    password !== process.env.MODERATOR_PASSWORD
  ) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start') || '';
  const end = searchParams.get('end') || '';

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  let query = supabase.from('visitas_sesiones').select('*');

  if (start) {
    query = query.gte('fecha', start);
  }
  if (end) {
    query = query.lte('fecha', end);
  }

  const { data: sessions, error } = await query
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Agrupar visitas por fecha y por país en memoria
  const diarias: Record<string, number> = {};
  const porPais: Record<string, number> = {};

  (sessions || []).forEach((s: any) => {
    const fecha = s.fecha || (s.created_at ? s.created_at.split('T')[0] : 'Desconocido');
    diarias[fecha] = (diarias[fecha] || 0) + 1;

    const pais = s.pais || 'Desconocido';
    porPais[pais] = (porPais[pais] || 0) + 1;
  });

  const diariasRanking = Object.entries(diarias)
    .map(([fecha, visitas]) => ({ fecha, visitas }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const paisesRanking = Object.entries(porPais)
    .map(([pais, visitas]) => ({ pais, visitas }))
    .sort((a, b) => b.visitas - a.visitas)
    .slice(0, 10);

  const hoy = new Date().toISOString().split('T')[0];
  const visitasHoy = diarias[hoy] || 0;

  return NextResponse.json({
    total: sessions?.length || 0,
    hoy: visitasHoy,
    porPais: paisesRanking,
    diarias: diariasRanking,
    sesiones: sessions || [],
  });
}
