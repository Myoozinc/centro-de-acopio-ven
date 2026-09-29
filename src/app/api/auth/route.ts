import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { password } = await req.json();

    const modPass = process.env.MODERATOR_PASSWORD;
    const adminPass = process.env.ADMIN_PASSWORD;

    if (password === adminPass) {
      return NextResponse.json({ success: true, role: 'admin' });
    }
    if (password === modPass) {
      return NextResponse.json({ success: true, role: 'moderador' });
    }

    return NextResponse.json({ success: false, error: 'Contraseña incorrecta' }, { status: 401 });
  } catch {
    return NextResponse.json({ success: false, error: 'Error del servidor' }, { status: 500 });
  }
}
