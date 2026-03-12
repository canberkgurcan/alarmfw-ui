import { auth } from "@/auth";
import { NextRequest } from "next/server";

const UPSTREAM = process.env.OBSERVE_URL ?? "http://alarmfw-observe:8001";

function resolveApiKey(role: string): string {
  const map: Record<string, string> = {
    admin:    ((process.env.ALARMFW_API_KEY_ADMIN    ?? "").trim() || (process.env.ALARMFW_API_KEY ?? "").trim()),
    operator: (process.env.ALARMFW_API_KEY_OPERATOR  ?? "").trim(),
    readonly: (process.env.ALARMFW_API_KEY_READONLY  ?? "").trim(),
  };
  return map[role] ?? "";
}

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { path } = await params;
  const reqUrl = new URL(req.url);
  const targetUrl = new URL("/" + path.join("/"), UPSTREAM);
  reqUrl.searchParams.forEach((v, k) => targetUrl.searchParams.set(k, v));

  const headers = new Headers();
  for (const name of ["content-type", "accept"]) {
    const val = req.headers.get(name);
    if (val) headers.set(name, val);
  }
  headers.set("X-API-Key", resolveApiKey(session.user.role));
  headers.set("X-Actor", session.user.name ?? "");

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const upstream = await fetch(targetUrl, {
    method: req.method,
    headers,
    ...(hasBody ? { body: req.body, duplex: "half" } : {}),
  } as RequestInit);

  const contentType = upstream.headers.get("Content-Type") ?? "application/json";
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "Content-Type": contentType },
  });
}

export const GET    = handler;
export const POST   = handler;
export const PUT    = handler;
export const DELETE = handler;
export const PATCH  = handler;
