# alarmfw-ui

AlarmFW yönetim arayüzü. Next.js 15 (App Router), React 19, Antd 5, NextAuth 5, port 3000. İki backend'i tüketir: `alarmfw-api` (8000) ve `alarmfw-observe` (8001). Backend'lerle **doğrudan konuşmaz** — tarayıcı çağrıları rol-bazlı API key enjekte eden Next.js proxy rotalarından geçer.

## Veri Akışı — Sunucu vs İstemci İkiliği

`lib/api.ts` aynı fonksiyonları hem sunucu hem istemci tarafında çalıştırır ama base URL farklıdır:

```
Tarayıcı (use client component)
    │  lib/api.ts  req()/obsReq()   BASE = "/api/proxy" | "/api/obs-proxy"
    ▼
app/api/proxy/[...path]/route.ts  →  makeProxyHandler(API_URL)
    │   auth()  →  session.user.role
    │   resolveApiKey(role)  →  X-API-Key  +  X-Actor
    ▼
alarmfw-api (8000)  /  alarmfw-observe (8001)

Sunucu component (typeof window === "undefined")
    │  lib/api.ts  BASE = API_URL / OBSERVE_URL  (proxy YOK, doğrudan)
    │  X-API-Key = ALARMFW_API_KEY (server env)
    ▼
backend
```

```ts
const BASE = typeof window === "undefined"
  ? (process.env.API_URL ?? "http://alarmfw-api:8000")
  : "/api/proxy";   // istemci: proxy rotası session'dan key ekler
```

**Bu ikiliği bozma.** İstemci tarafının backend host'unu görmesi gerekmez; her zaman `/api/proxy` üzerinden gider. Yeni bir backend çağrısı eklerken `lib/api.ts`'in `req` (api) veya `obsReq` (observe) yardımcısını kullan — base seçimini onlar halleder.

## Auth & API Key — Güvenlik Sınırı

`auth.ts`: NextAuth Credentials provider, üç rol. Her rol bir parola ve bir API key env'ine bağlı:

| Kullanıcı | Rol | Parola env | API key env |
|---|---|---|---|
| `admin` | admin | `UI_ADMIN_PASSWORD` | `ALARMFW_API_KEY_ADMIN` (veya `ALARMFW_API_KEY`) |
| `operator` | operator | `UI_OPERATOR_PASSWORD` | `ALARMFW_API_KEY_OPERATOR` |
| `readonly` | readonly | `UI_READONLY_PASSWORD` | `ALARMFW_API_KEY_READONLY` |

**Kritik değişmez:** API key **session'a/JWT'ye asla konmaz**. `auth.ts` login'de yalnızca rolün düzgün yapılandırıldığını doğrular (key yoksa login reddedilir), gerçek key'i `proxy-handler.ts` her istekte `resolveApiKey(role)` ile sunucu tarafında çözer ve `X-API-Key` header'ına koyar. Bu sınırı koru — key'i client'a sızdıracak bir yol ekleme.

`proxy-handler.ts:makeProxyHandler`:
- session yoksa → `401`
- rol için key yapılandırılmamışsa → `500 "API key is not configured for this role"`
- `X-API-Key` + `X-Actor` (audit için kullanıcı adı) ekleyip upstream'e forward eder

`middleware.ts` `login`, `api/auth`, `_next`, `favicon` dışında **her yolu** korur. Proxy rotaları kendi session kontrolünü de yapar (çift koruma).

## API İstemci Kontratı (`lib/api.ts`)

İki yardımcı, iki backend:
- `req<T>(path, init)` → `alarmfw-api` (`/api/...`)
- `obsReq<T>(path, init)` → `alarmfw-observe` (`/api/observe/...`)

İkisi de: `Content-Type: application/json` ve (varsa) `X-API-Key`/`X-Actor` ekler, `cache: "no-store"`, `!res.ok` ise `Error("<status> <statusText>: <body>")` **fırlatır**. Çağıran taraf bu hatayı yakalayıp UI'da gösterir.

Tüm yanıt tipleri `lib/api.ts` içinde tanımlı (`Alarm`, `Check`, `HealthOverview`, `PromQLResult`, ...). `alarmfw-observe`'in `{ ok, error?, result }` soft-error şekli `PromQLResult`/`Health*` tiplerinde aynen modellenir — observe çağrısında `ok: false` gelebileceğini varsay, UI'da banner göster (`QueryErrorBanner`).

## Sayfa Haritası (`app/(app)/`)

```
/dashboard       Alarm özeti + pipeline health     (api: alarms/metrics)
/monitor         Pod snapshot                       (api: monitor)
/observe         Prometheus/alerts/pod detay        (observe: health/*, promql)
/checks          Check YAML yönetimi                (api: checks)
/config          Cluster + namespace config         (api: config)
/maintenance     Silence pencereleri + dry-run      (api: policies)
/run             Manuel alarm run                   (api: run)
/secrets         Token yönetimi                     (api: secrets)
/admin-console   OCP terminal                       (api: terminal)
```

`app/(app)/layout.tsx` korumalı kabuk (`AppShell`, `Sidebar`, `ProfileMenu`). `app/login/page.tsx` auth dışındadır.

## Ortam Değişkenleri — Build-time vs Runtime

| Değişken | Ne zaman | Kullanım |
|---|---|---|
| `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_OBSERVE_URL` | build-time | İstemcinin (gerekirse) doğrudan eriştiği URL — image'a baked-in |
| `NEXT_PUBLIC_ALARMFW_API_KEY` / `_ACTOR` | build-time | İstemci `X-API-Key`/`X-Actor` (proxy zaten ekler) |
| `API_URL` / `OBSERVE_URL` | runtime | Sunucu tarafı upstream host (`http://alarmfw-api:8000`) |
| `ALARMFW_API_KEY` / `_ADMIN` / `_OPERATOR` / `_READONLY` | runtime | Proxy'nin rol→key çözümü |
| `UI_{ADMIN,OPERATOR,READONLY}_PASSWORD` | runtime | Login parolaları |

> `NEXT_PUBLIC_*` build sırasında sabitlenir; OCP'de Jenkinsfile `--build-arg` ile dış route URL'lerini geçer. Runtime env'leri (proxy, parolalar) container'a deploy'da verilir.

## Çalıştırma & Test

```bash
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 \
NEXT_PUBLIC_OBSERVE_URL=http://localhost:8001 \
npm run dev                     # http://localhost:3000

npm test                        # vitest (tests/*.test.ts[x])
```

Testler `vitest` + Testing Library; `tests/setup.ts` jsdom kurar. `lib/api.ts` testlerinde `fetch` mock'lanır (TestClient yok).
