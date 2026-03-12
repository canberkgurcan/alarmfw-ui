import NextAuth, { type NextAuthConfig, type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";

// ── Session type augmentation ─────────────────────────
declare module "next-auth" {
  interface Session {
    user: {
      name: string;
      role: "admin" | "operator" | "readonly";
      apiKey: string;
      obsApiKey: string;
    } & DefaultSession["user"];
  }
  interface User {
    role: "admin" | "operator" | "readonly";
    apiKey: string;
    obsApiKey: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: "admin" | "operator" | "readonly";
    apiKey: string;
    obsApiKey: string;
  }
}

// ── Role → API key mapping ────────────────────────────
const ROLE_MAP: Array<{
  username: string;
  role: "admin" | "operator" | "readonly";
  passwordEnv: string;
  apiKeyEnv: string;
  obsApiKeyEnv: string;
}> = [
  {
    username: "admin",
    role: "admin",
    passwordEnv: "UI_ADMIN_PASSWORD",
    apiKeyEnv: "ALARMFW_API_KEY_ADMIN",
    obsApiKeyEnv: "ALARMFW_API_KEY_ADMIN",
  },
  {
    username: "operator",
    role: "operator",
    passwordEnv: "UI_OPERATOR_PASSWORD",
    apiKeyEnv: "ALARMFW_API_KEY_OPERATOR",
    obsApiKeyEnv: "ALARMFW_API_KEY_OPERATOR",
  },
  {
    username: "readonly",
    role: "readonly",
    passwordEnv: "UI_READONLY_PASSWORD",
    apiKeyEnv: "ALARMFW_API_KEY_READONLY",
    obsApiKeyEnv: "ALARMFW_API_KEY_READONLY",
  },
];

const config: NextAuthConfig = {
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = (credentials?.username as string | undefined)?.trim() ?? "";
        const password = (credentials?.password as string | undefined) ?? "";
        if (!username || !password) return null;

        for (const entry of ROLE_MAP) {
          const expected = process.env[entry.passwordEnv] ?? "";
          if (!expected) continue;
          if (username !== entry.username) continue;
          if (password !== expected) return null; // username matches but wrong pw → fail fast

          // Resolve API key: role-specific key, with fallback to legacy ALARMFW_API_KEY for admin
          const apiKey =
            (process.env[entry.apiKeyEnv] ?? "").trim() ||
            (entry.role === "admin" ? (process.env.ALARMFW_API_KEY ?? "").trim() : "");

          return {
            id: entry.username,
            name: entry.username,
            role: entry.role,
            apiKey,
            obsApiKey: apiKey, // observe servis şimdilik aynı key kullanıyor
          };
        }
        return null;
      },
    }),

    // ── Gelecek: Keycloak entegrasyonu ────────────────
    // import Keycloak from "next-auth/providers/keycloak";
    // Keycloak({
    //   clientId:     process.env.AUTH_KEYCLOAK_ID,
    //   clientSecret: process.env.AUTH_KEYCLOAK_SECRET,
    //   issuer:       process.env.AUTH_KEYCLOAK_ISSUER,
    // }),
  ],

  pages: {
    signIn: "/login",
  },

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.apiKey = user.apiKey;
        token.obsApiKey = user.obsApiKey;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.role = token.role;
      session.user.apiKey = token.apiKey;
      session.user.obsApiKey = token.obsApiKey;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
