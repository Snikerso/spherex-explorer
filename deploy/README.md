# SPHEREx — DigitalOcean App Platform

- Team: Optymalista
- App: `spherex-explorer`, ID `9770a672-6907-488a-89d3-112c8373e850`
- Source: `Snikerso/spherex-explorer`, branch `codex/app-platform-release`
- Region: Frankfurt (`fra`)
- One instance, `apps-s-1vcpu-2gb`; do not scale horizontally with the current local queue/cache.
- Nginx exposes port 8080; `/api/` proxies to NestJS on loopback port 3000.
- Readiness: `/api/v1/health/ready`.
- Startup creates MongoDB indexes before starting API and Nginx.
- Atlas organization: `SPHEREx Explorer` (`6af883f4e7b8cb31fdb9002e`).
- Atlas project: `spherex-production` (`6af88417a4daa1e82d04f00c`).
- Atlas cluster: `spherex-prod`, Free, AWS Frankfurt.

Secrets belong in Doppler `sphere_x/prd`: `MONGO_DB_URL`, `OPENAI_API_KEY`.
Map `MONGO_DB_URL` to the application's `MONGODB_URI` and set the database to `/spherex`.
Copy them to app-level encrypted RUN_TIME variables when deploying. There is no
automatic Doppler synchronization configured yet. Never put values in this spec.
The committed app spec is a template: preserve live encrypted variables when
updating the app.

Atlas database user has `readWrite` only on `spherex`. The owner explicitly chose
the Atlas network entry `0.0.0.0/0`; dedicated egress is therefore unnecessary.

App Platform storage is ephemeral: restarts/redeployments can remove generated
FITS/PNG/video cache. MongoDB metadata persists, but stored frames may need to be
prepared again. Durable image storage requires a separate object-storage change.

Pricing: service $25/month, plus taxes, excess transfer and OpenAI usage.
Atlas Free has no charge or managed backups.

Creation is complete; live readiness is pending database credentials/network setup.
