# Proxy / Auth / Rol Sorununu Hata Ayıkla

**Kullanım:** `/debug-proxy <görülen hata: 401 / 403 / 500 / boş veri>`

İstemci çağrıları `lib/api.ts` → `/api/proxy` (veya `/api/obs-proxy`) → `proxy-handler.ts` → backend zincirinden geçer. Hatayı zincirde konumlandır.

## Belirtiye göre

| Belirti | Kök neden |
|---|---|
| `401 Unauthorized` (proxy'den) | Session yok/expired → `auth()` boş döndü. Login durumunu kontrol et. |
| `500 "API key is not configured for this role"` | Rolün key env'i boş — `ALARMFW_API_KEY_<ROLE>` set değil |
| `403` (backend'den, proxy geçtikten sonra) | Key var ama `alarmfw-api` onu reddediyor — yanlış/eski key |
| Sunucu component'te çalışıyor, istemcide değil | `API_URL` (server) doğru ama proxy/key zinciri kopuk |

## 1. Zincir neresinde kırılıyor?

```
Browser → /api/proxy/...        ← burada 401/500 ise proxy-handler
        → alarmfw-api:8000      ← burada 403 ise backend key reddi
```

Network tab'da isteğin **`/api/proxy/...`'e mi yoksa doğrudan backend'e mi** gittiğine bak. Doğrudan gidiyorsa biri `lib/api.ts`'i baypas edip elle `fetch` kurmuş — düzelt.

## 2. Rol → key eşlemesi (`proxy-handler.ts:resolveApiKey`)

```
admin    → ALARMFW_API_KEY_ADMIN || ALARMFW_API_KEY
operator → ALARMFW_API_KEY_OPERATOR
readonly → ALARMFW_API_KEY_READONLY
```

`500` alıyorsan ilgili env boştur. `auth.ts` aslında login'de bunu doğrular (key yoksa login reddedilir) — yine de runtime'da env değişmişse login'li kullanıcı `500` görebilir.

## 3. Login neden reddediliyor? (`auth.ts:authorize`)

Sırayla: kullanıcı adı `ROLE_MAP`'te mi → `UI_<ROLE>_PASSWORD` set mi → parola eşleşiyor mu → rolün API key'i yapılandırılmış mı. Son adım başarısızsa (key yok) **login başarısız olur** — "parolam doğru ama giremiyorum" çoğu zaman eksik `ALARMFW_API_KEY_<ROLE>`'dur.

## 4. API key client'a sızıyor mu? (yapılmaması gereken)

Key **session/JWT'de olmamalı** — yalnız `proxy-handler` sunucu tarafında çözer. Bir component `session`'dan key okumaya çalışıyorsa bu bir bug; key oraya hiç konmaz (`auth.ts`'te yorum: "API key intentionally NOT included in session").

## 5. Middleware kapsamı

`middleware.ts` matcher `login`, `api/auth`, `_next`, `favicon` dışını korur. Yeni bir auth-dışı yol (ör. public health) eklediysen ve korunuyorsa matcher'a istisna ekle; tersine, korunması gereken yol açıkta kaldıysa matcher'ı daralt.

## 6. Observe boş/`ok:false`

`obsReq` `!res.ok`'ta fırlatır ama backend `200 + {ok:false}` dönerse fırlatmaz — bu "soft error"dur. UI'da `result` boş görünüyorsa yanıttaki `ok`/`error` alanına bak; bu `alarmfw-observe` tarafı sorunudur (Prometheus URL/token), proxy değil.
