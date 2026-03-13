import { makeProxyHandler } from "@/lib/proxy-handler";

const handler = makeProxyHandler(process.env.API_URL ?? "http://alarmfw-api:8000");

export const GET    = handler;
export const POST   = handler;
export const PUT    = handler;
export const DELETE = handler;
export const PATCH  = handler;
