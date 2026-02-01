import { edgeAuth } from "@/auth.config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const withAuth = edgeAuth((req) => {
  // req.auth is set by Auth.js; authorized callback controls redirects
  return;
});

/** Clear Auth.js session cookie to stop redirect loop when JWT is invalid. */
function clearSessionCookieResponse(redirectUrl: URL): NextResponse {
  const res = NextResponse.redirect(redirectUrl);
  res.headers.append(
    "Set-Cookie",
    "authjs.session-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax"
  );
  res.headers.append(
    "Set-Cookie",
    "__Secure-authjs.session-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax; Secure"
  );
  return res;
}

export default async function middleware(request: NextRequest) {
  try {
    return await withAuth(request as never, {} as never);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string })?.code;
    if (
      code === "JWTSessionError" ||
      message.includes("decryption") ||
      message.includes("matching decryption secret")
    ) {
      return clearSessionCookieResponse(new URL("/login", request.url));
    }
    throw err;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
