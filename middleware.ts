import { edgeAuth } from "@/auth.config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const withAuth = edgeAuth((req) => {
  // req.auth is set by Auth.js; authorized callback controls redirects
  return;
});

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
      return NextResponse.redirect(new URL("/login", request.url));
    }
    throw err;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
