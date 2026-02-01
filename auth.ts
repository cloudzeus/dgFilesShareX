import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: UserRole }).role ?? "EMPLOYEE";
        token.companyId = (user as { companyId?: number }).companyId ?? 0;
        token.departmentId = (user as { departmentId?: number | null }).departmentId ?? null;
      }
      if (trigger === "update" && session) {
        token.role = (session as { role?: UserRole }).role ?? token.role;
        token.companyId = (session as { companyId?: number }).companyId ?? token.companyId;
        token.departmentId = (session as { departmentId?: number | null }).departmentId ?? token.departmentId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token && typeof token.id === "string") {
        session.user.id = token.id;
        session.user.role = token.role as import("@prisma/client").UserRole;
        session.user.companyId = token.companyId as number;
        session.user.departmentId = token.departmentId as number | null;
      }
      return session;
    },
    authorized({ auth: authState, request }) {
      const { pathname } = request.nextUrl;
      if (pathname.startsWith("/api/auth")) return true;
      const isDashboard = pathname.startsWith("/dashboard") || pathname.startsWith("/files") || pathname.startsWith("/departments") || pathname.startsWith("/reports") || pathname.startsWith("/gdpr");
      const isAuthPage = pathname === "/login";
      if (isDashboard && !authState) return false;
      if (isAuthPage && authState) return Response.redirect(new URL("/dashboard", request.url));
      return true;
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || typeof credentials.password !== "string") return null;
        const user = await prisma.user.findUnique({
          where: { email: String(credentials.email).toLowerCase(), isActive: true },
          include: { company: true, department: true },
        });
        if (!user?.hashedPassword) return null;
        const ok = await compare(credentials.password, user.hashedPassword);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          companyId: user.companyId,
          departmentId: user.departmentId,
        };
      },
    }),
  ],
});
