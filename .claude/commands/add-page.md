# Yeni Sayfa Ekle

**Kullanım:** `/add-page <sayfa adı> <ne gösterecek>`

## Nereye?

Korumalı sayfalar `app/(app)/<isim>/page.tsx` altında. `(app)` route group `layout.tsx`'i (AppShell + Sidebar + auth kabuğu) paylaşır. `middleware.ts` `login`/`api/auth` dışındaki her yolu zaten korur — yeni sayfa otomatik korumalı olur.

Login gibi auth-dışı bir sayfa gerekiyorsa `(app)` dışına koy ve `middleware.ts` matcher'ına ekle (nadiren gerekir).

## İskelet

```tsx
"use client";

import { useEffect, useState } from "react";
import { Table, Alert } from "antd";
import { getThings, type Thing } from "@/lib/api";

export default function ThingsPage() {
  const [data, setData]   = useState<Thing[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getThings()
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <Alert type="error" message={error} />;
  return <Table dataSource={data} rowKey="name" columns={[/* ... */]} />;
}
```

- Veri çeken sayfalar `"use client"` (state + effect). Backend erişimi **her zaman** `lib/api.ts` üzerinden (`/add-api-call`).
- UI bileşenleri Antd 5'ten; ortak parçalar `components/` (`StatusBadge`, `AlarmGroupTable`, `AppShell`).
- Observe verisi gösteriyorsan `{ ok: false }` halini ele al — `QueryErrorBanner` kullan.

## Sidebar'a ekle

Yeni sayfa menüde görünsün diye `components/Sidebar.tsx`'e route + ikon ekle. Rol bazlı gizleme gerekiyorsa session rolüne göre koşullandır (`useSession`/`auth`).

## Stil

Tailwind 3 + Antd. Global stiller `app/globals.css`. Antd provider `components/AntdProvider.tsx`'te kurulu — sarmaya gerek yok.

## Test

`tests/*.page.test.tsx` pattern'ı (`maintenance.page.test.tsx`): Testing Library ile render et, `lib/api` fonksiyonlarını mock'la, beklenen içeriği doğrula.

```bash
npm test
```
