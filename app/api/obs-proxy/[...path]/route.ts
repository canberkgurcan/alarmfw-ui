import { makeProxyHandler } from "@/lib/proxy-handler";

const handler = makeProxyHandler(process.env.OBSERVE_URL ?? "http://alarmfw-observe:8001");

export const GET    = handler;
export const POST   = handler;
export const PUT    = handler;
export const DELETE = handler;
export const PATCH  = handler;
