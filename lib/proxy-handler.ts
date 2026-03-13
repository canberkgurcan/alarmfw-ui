import { auth } from "@/auth";
import { NextRequest } from "next/server";

function resolveApiKey(role: string): string {
  const map: Record<string, string> = {
    admin:    ((process.env.ALARMFW_API_KEY_ADMIN    ?? "").trim() || (process.env.ALARMFW_API_KEY ?? "").trim()),
    operator: (process.env.ALARMFW_API_KEY_OPERATOR  ?? "").trim(),
    readonly: (process.env.ALARMFW_API_KEY_READONLY  ?? "").trim(),
  };
  return map[role] ?? "";
}

export function makeProxyHandler(upstream: string) {
  async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const session = await auth();
    const role = session?.user?.role;
    if (!session || !session.user || !role) return new Response("Unauthorized", { status: 401 });
    const apiKey = resolveApiKey(role);
    if (!apiKey) return new Response("API key is not configured for this role", { status: 500 });

    const { path } = await params;
    const reqUrl = new URL(req.url);
    const targetUrl = new URL("/" + path.join("/"), upstream);
    reqUrl.searchParams.forEach((v, k) => targetUrl.searchParams.set(k, v));

    const headers = new Headers();
    for (const name of ["content-type", "accept"]) {
      const val = req.headers.get(name);
      if (val) headers.set(name, val);
    }
    headers.set("X-API-Key", apiKey);
    headers.set("X-Actor", session.user.name ?? role);

    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    const res = await fetch(targetUrl, {
      method: req.method,
      headers,
      ...(hasBody ? { body: req.body, duplex: "half" } : {}),
    } as RequestInit);

    const contentType = res.headers.get("Content-Type") ?? "application/json";
    return new Response(res.body, {
      status: res.status,
      headers: { "Content-Type": contentType },
    });
  }
  return handler;
}
