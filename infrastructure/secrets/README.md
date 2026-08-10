# infrastructure/secrets

Local-dev TLS material for nginx. Not committed (see `.gitignore`) —
generate it once after cloning:

```sh
openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
  -keyout infrastructure/secrets/microverse.local.key \
  -out infrastructure/secrets/microverse.local.crt \
  -subj "/CN=microverse.local/O=Microverse Dev" \
  -addext "subjectAltName=DNS:microverse.local,DNS:sso.microverse.local,DNS:gofeeler.microverse.local,DNS:storage.microverse.local,DNS:springpix.microverse.local,DNS:pyreel.microverse.local,DNS:djaboard.microverse.local,DNS:elixtempo.microverse.local,DNS:rustledger.microverse.local,DNS:rubykudos.microverse.local,DNS:localhost"
```

(On Git Bash/MSYS, prefix with `MSYS_NO_PATHCONV=1` — otherwise it mangles the leading `/CN=...` as a path.)

Self-signed, so browsers will warn on first visit — expected for local
dev. Map `microverse.local`, `sso.microverse.local`,
`gofeeler.microverse.local`, `storage.microverse.local`, and every
domain-service microsite subdomain (`springpix`, `pyreel`, `djaboard`,
`elixtempo`, `rustledger`, `rubykudos` — see `data/services.js`'s
`SERVICE_THEME`) to `127.0.0.1` in your hosts file.
Domain-service microsites each get their own `DNS:` entry here, their
own line in the hosts file, and their own `server_name` entry in
[applications.conf](../nginx/conf.d/applications.conf) — platform
features (dashboard, customer, analyst) stay under paths on
`microverse.local` itself, no subdomain needed. All 7 known services
are provisioned as of the real `services` table (see
[docs/schema.md](../../docs/schema.md)); a genuinely new service still
needs this same three-place addition (cert SAN, hosts file, nginx
`server_name`) before its subdomain will actually resolve, even after
it's added to the `services` table and `SERVICE_THEME`.
`storage.microverse.local` is a different kind of exception:
plumbing, not a feature, but MinIO's S3 SigV4 presigned URLs need
their own clean host rather than a path prefix — see asset-service's
S3_ENDPOINT in docker-compose.yml.
