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
| `/run` | Manuel alarm run |
| `/secrets` | Token yönetimi |
| `/env` | Ortam değişkenleri |
| `/admin-console` | OCP terminal (oc komutları) |

## Ortam Değişkenleri

| Değişken | Ne Zaman | Açıklama |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Build-time | Tarayıcının API'ye erişeceği URL |
| `NEXT_PUBLIC_OBSERVE_URL` | Build-time | Tarayıcının Observe API'ye erişeceği URL |
| `API_URL` | Runtime | Container içi server-side API URL |
| `OBSERVE_URL` | Runtime | Container içi server-side Observe URL |

> `NEXT_PUBLIC_*` değişkenleri image build sırasında baked-in olur. Docker Compose'da `localhost` kullanılır, OCP'de Jenkinsfile `--build-arg` ile dış route URL'lerini geçer.

## Geliştirme

```bash
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 \
NEXT_PUBLIC_OBSERVE_URL=http://localhost:8001 \
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
  -t alarmfw-ui:latest .
```

## OCP Deploy

```bash
oc apply -f ocp/deployment.yaml -n alarmfw-prod
oc get route alarmfw-ui -n alarmfw-prod
```

Pipeline: `Jenkinsfile` (`OCP_APPS_DOMAIN` değişkeni ile `--build-arg` otomatik ayarlanır)
