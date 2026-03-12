export { auth as middleware } from "./auth";

export const config = {
  matcher: [
    /*
     * /login, /api/auth/*, _next/*, favicon.ico hariç tüm yolları koru.
     * Proxy rotaları (/api/proxy, /api/obs-proxy) session kontrolünü
     * kendi içinde yapıyor; middleware yine de bunları korur.
     */
    "/((?!login|api/auth|_next/static|_next/image|favicon\\.ico).*)",
  ],
};
