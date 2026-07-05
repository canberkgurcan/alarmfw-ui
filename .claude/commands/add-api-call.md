# Yeni Backend Çağrısı Ekle

**Kullanım:** `/add-api-call <hangi backend endpoint'ini çağıracaksın>`

Tüm backend erişimi `lib/api.ts` üzerinden geçer. Component'ten doğrudan `fetch` **etme** — base URL seçimi (sunucu vs istemci proxy) ve auth header'ları orada merkezîdir.

## Hangi yardımcı?

| Backend | Yardımcı | Path örneği |
|---|---|---|
| `alarmfw-api` (8000) | `req<T>` | `/api/checks`, `/api/config/clusters` |
| `alarmfw-observe` (8001) | `obsReq<T>` | `/api/observe/health/overview` |

İkisi de base'i (`/api/proxy` vs `/api/obs-proxy` istemcide; `API_URL`/`OBSERVE_URL` sunucuda) ve `X-API-Key`/`X-Actor`'ı otomatik ekler.

## Ekleme

**1.** `lib/api.ts`'e fonksiyon + tip:

```ts
// ── <Grup> ──
export const getThings = (cluster: string) =>
  req<Thing[]>(`/api/things?cluster=${encodeURIComponent(cluster)}`);

export const createThing = (body: Thing) =>
  req<{ ok: boolean }>("/api/things", { method: "POST", body: JSON.stringify(body) });

export interface Thing {
  name: string;
  enabled: boolean;
}
```

- Query parametrelerini `encodeURIComponent` / `URLSearchParams` ile kur (mevcut `getAlarmHistory` örneği).
- Yanıt tipini **mutlaka** export et; component'ler `any` kullanmasın.
- Observe çağrısıysa dönüş tipi genelde `{ ok: boolean; error?: string; result: [...] }` — soft error'ı modelle.

**2.** Hata davranışı hazır: `req`/`obsReq` `!res.ok`'ta `Error` fırlatır. Component'te `try/catch` veya `useSWR`/`useEffect` error state'i ile yakala ve `QueryErrorBanner` benzeri bir UI göster.

## Yapma

- `process.env.NEXT_PUBLIC_*`'ı component içinde okuyup elle `fetch` kurma.
- API key'i client koduna gömme — proxy zaten rol-bazlı ekliyor.
- `cache` ayarını değiştirme; `req` zaten `no-store` (her zaman taze veri).

## Test

`tests/api.unit.test.ts` pattern'ı: global `fetch`'i mock'la, fonksiyonu çağır, doğru path/method/body ile çağrıldığını ve tipin parse edildiğini doğrula.

```bash
npm test
```
