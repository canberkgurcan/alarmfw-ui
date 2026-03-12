# alarmfw-ui

AlarmFW yönetim arayüzü. Next.js 15, port 3000.

## Sayfalar

| Sayfa | Açıklama |
|---|---|
| `/dashboard` | Alarm özeti ve durum |
| `/monitor` | Pod snapshot izleme |
| `/observe` | Prometheus metrikleri, alerts, pod detay |
| `/checks` | Check YAML yönetimi |
| `/config` | Cluster ve namespace config |
| `/maintenance` | Maintenance/silence pencereleri |
| `/run` | Manuel alarm run |
| `/secrets` | Token yönetimi |
| `/env` | Ortam değişkenleri |
| `/admin-console` | OCP terminal (oc komutları) |

## Ortam Değişkenleri

| Değişken | Ne Zaman | Açıklama |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Build-time | Tarayıcının API'ye erişeceği URL |
| `NEXT_PUBLIC_OBSERVE_URL` | Build-time | Tarayıcının Observe API'ye erişeceği URL |
| `NEXT_PUBLIC_ALARMFW_API_KEY` | Build-time | alarmfw-api korumalı endpoint'ler için `X-API-Key` |
| `NEXT_PUBLIC_ALARMFW_ACTOR` | Build-time | Audit log için opsiyonel `X-Actor` kullanıcı adı |
| `API_URL` | Runtime | Container içi server-side API URL |
| `OBSERVE_URL` | Runtime | Container içi server-side Observe URL |
| `ALARMFW_ACTOR` | Runtime | Server-side çağrılar için opsiyonel audit aktörü |

> `NEXT_PUBLIC_*` değişkenleri image build sırasında baked-in olur. Docker Compose'da `localhost` kullanılır, OCP'de Jenkinsfile `--build-arg` ile dış route URL'lerini geçer.

## Geliştirme

```bash
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 \
NEXT_PUBLIC_OBSERVE_URL=http://localhost:8001 \
NEXT_PUBLIC_ALARMFW_API_KEY=change-me \
npm run dev
```

## Docker

```bash
# Geliştirme (localhost API)
docker build -t alarmfw-ui:latest .

# OCP için (dış route URL'leri)
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://alarmfw-api.apps.CLUSTER.DOMAIN \
  --build-arg NEXT_PUBLIC_OBSERVE_URL=https://alarmfw-observe.apps.CLUSTER.DOMAIN \
  --build-arg NEXT_PUBLIC_ALARMFW_API_KEY=change-me \
  -t alarmfw-ui:latest .
```

## OCP Deploy

```bash
oc apply -f ocp/deployment.yaml -n alarmfw-prod
oc set image deployment/alarmfw-ui alarmfw-ui=REGISTRY/alarmfw-ui:TAG -n alarmfw-prod
oc get route alarmfw-ui -n alarmfw-prod
```

## Jenkins Pipeline

4 stage: **Checkout SCM → Docker Build → Nexus Push → OCP Deploy**

`NEXT_PUBLIC_*` URL'leri `OCP_APPS_DOMAIN` üzerinden otomatik türetilir ve `--build-arg` ile image'a baked-in olur.

| Değişken | Açıklama |
|---|---|
| `REGISTRY_URL` | Nexus registry adresi |
| `REGISTRY_CREDS` | Jenkins credential ID (Docker kullanıcı/şifre) |
| `OCP_API_URL` | OpenShift API endpoint |
| `OCP_TOKEN_CREDS` | Jenkins credential ID (OCP service account token) |
| `DEPLOY_NAMESPACE` | Deploy namespace (ör: `alarmfw-prod`) |
| `OCP_APPS_DOMAIN` | OCP apps domain (ör: `apps.cluster.local`) |
| `ALARMFW_API_KEY` | alarmfw-api için `X-API-Key` (API auth açıksa gerekli) |

## Maintenance notu

`/maintenance` sayfasında yeni kayıt eklemeden önce **Dry-run** ile etkilenecek alarm adayları önizlenebilir ve aynı ekranda **Audit Log** tablosu görülür.
