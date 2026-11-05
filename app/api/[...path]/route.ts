import { NextRequest, NextResponse } from 'next/server';
const COOKIE = 'gym_session';
const permitted = new Set(['auth', 'admin', 'catalog']);
async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!permitted.has(path[0]) || path.some(p => p === '..' || p.includes('/'))) return NextResponse.json({ message: '요청을 찾을 수 없습니다.' }, { status: 404 });
  const origin = request.headers.get('origin');
  if (request.method !== 'GET' && origin) {
    let originHost = '';
    try { originHost = new URL(origin).host; } catch { /* Invalid origins are rejected below. */ }
    if (originHost !== request.headers.get('host')) return NextResponse.json({ message: '허용되지 않은 요청입니다.' }, { status: 403 });
  }
  const base = process.env.BACKEND_URL;
  if (!base) return NextResponse.json({ message: '서버 연결 설정을 확인해 주세요.' }, { status: 503 });
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = request.cookies.get(COOKIE)?.value;
    if (token) headers.Authorization = `Bearer ${token}`;
    const upstream = await fetch(`${base.replace(/\/$/, '')}/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`, {
      method: request.method, headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text(), cache: 'no-store', signal: AbortSignal.timeout(20000),
    });
    const body = await upstream.json().catch(() => ({ message: '서버 응답을 확인할 수 없습니다.' }));
    const authAction = path[0] === 'auth' && ['login', 'signup'].includes(path[1]);
    const sessionToken = authAction && upstream.ok && typeof body.token === 'string' ? body.token : undefined;
    delete body.token;
    const response = NextResponse.json(body, { status: upstream.status });
    response.headers.set('Cache-Control', 'no-store');
    if (sessionToken) response.cookies.set(COOKIE, sessionToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
    const passwordChange = path[0] === 'auth' && path[1] === 'change-password';
    if ((upstream.status === 401 && !passwordChange) || (path[0] === 'auth' && path[1] === 'logout')) response.cookies.set(COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
  } catch {
    const response = NextResponse.json({ message: '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 502 });
    if (path[0] === 'auth' && path[1] === 'logout') response.cookies.set(COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
  }
}
export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
