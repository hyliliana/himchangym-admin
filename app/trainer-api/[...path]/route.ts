import { NextRequest, NextResponse } from "next/server";

const COOKIE = "gym_trainer_session";
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/trainer-api",
};
async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const auth =
    path.length === 2 &&
    path[0] === "auth" &&
    ["login", "me", "logout", "change-password"].includes(path[1]);
  const reservations =
    path[0] === "trainer" &&
    path[1] === "reservations" &&
    (path.length === 2 || (path.length === 3 && /^\d+$/.test(path[2])));
  const allowedMethod =
    (auth &&
      ((path[1] === "me" && request.method === "GET") ||
        (path[1] !== "me" && request.method === "POST"))) ||
    (reservations &&
      ((path.length === 2 && request.method === "GET") ||
        (path.length === 3 && request.method === "PATCH")));
  if (!allowedMethod)
    return NextResponse.json(
      { message: "요청을 찾을 수 없습니다." },
      { status: 404 },
    );
  const origin = request.headers.get("origin");
  if (request.method !== "GET" && origin) {
    let host = "";
    try {
      host = new URL(origin).host;
    } catch {}
    if (host !== request.headers.get("host"))
      return NextResponse.json(
        { message: "허용되지 않은 요청입니다." },
        { status: 403 },
      );
  }
  const base = process.env.BACKEND_URL;
  if (!base)
    return NextResponse.json(
      { message: "서버 연결 설정을 확인해 주세요." },
      { status: 503 },
    );
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const token = request.cookies.get(COOKIE)?.value;
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload = ["GET", "HEAD"].includes(request.method)
      ? undefined
      : await request.text();
    if (auth && path[1] === "login") {
      let input;
      try {
        input = JSON.parse(payload || "{}");
      } catch {
        return NextResponse.json(
          { message: "입력 내용을 확인해 주세요." },
          { status: 400 },
        );
      }
      payload = JSON.stringify({
        email: input.email,
        password: input.password,
        kind: "trainer",
      });
    }
    const upstream = await fetch(
      `${base.replace(/\/$/, "")}/${path.join("/")}${request.nextUrl.search}`,
      {
        method: request.method,
        headers,
        body: payload,
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      },
    );
    const body = await upstream
      .json()
      .catch(() => ({
        message: "서버 응답을 확인하지 못했어요. 다시 시도해 주세요.",
      }));
    const sessionToken =
      auth &&
      path[1] === "login" &&
      upstream.ok &&
      body.user?.kind === "trainer" &&
      typeof body.token === "string"
        ? body.token
        : undefined;
    delete body.token;
    const response = NextResponse.json(body, { status: upstream.status });
    response.headers.set("Cache-Control", "no-store");
    if (sessionToken)
      response.cookies.set(COOKIE, sessionToken, {
        ...cookieOptions,
        maxAge: 60 * 60 * 24 * 7,
      });
    if (
      (upstream.status === 401 && path[1] !== "change-password") ||
      (auth && path[1] === "logout")
    )
      response.cookies.set(COOKIE, "", { ...cookieOptions, maxAge: 0 });
    return response;
  } catch {
    const response = NextResponse.json(
      { message: "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요." },
      { status: 502 },
    );
    if (auth && path[1] === "logout")
      response.cookies.set(COOKIE, "", { ...cookieOptions, maxAge: 0 });
    return response;
  }
}
export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
