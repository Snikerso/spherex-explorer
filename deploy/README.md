# SPHEREx — DigitalOcean App Platform

- Team: Optymalista
- App: `spherex-explorer`, ID `9770a672-6907-488a-89d3-112c8373e850`
- Source: `Snikerso/spherex-explorer`, branch `main` (`app-platform-release` is kept in sync as a release reference)
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

App Platform local storage is ephemeral. The API now supports private DigitalOcean Spaces
for durable FITS, PNG, radiance and sequence manifests, restoring local cache on demand.
Doppler `sphere_x/prd` contains `SPACES_BUCKET`, `SPACES_REGION`, `SPACES_ACCESS_KEY_ID`,
`SPACES_SECRET_ACCESS_KEY`, `SPACES_PREFIX`. Map these to encrypted app-level RUN_TIME
variables when releasing the storage-enabled code; Doppler is not automatically synchronized.
Do not publish the bucket or expose access keys to the frontend. Dev/prod buckets and keys
are separate. No production code release is implied by provisioning storage.

Pricing: service $25/month, plus taxes, excess transfer and OpenAI usage.
Atlas Free has no charge or managed backups.

Live URL: https://spherex-explorer-l9m4r.ondigitalocean.app

Verified ACTIVE deployment `8263185f-18c3-47bf-b8bf-7baebcada296`, source commit
`3b58bc488d7d42780a495d72ecc5e135e98e0d38`: HTTPS, database readiness, secure
session cookie, view write/read, targets and frontend HTTP 200. Browser reports
SYSTEM ONLINE and connection to API and MongoDB. Full imaging and paid OpenAI
conversation were not exercised during deployment verification.
