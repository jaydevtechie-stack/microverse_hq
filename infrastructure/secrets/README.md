# infrastructure/secrets

Local-dev TLS material for nginx. Not committed (see `.gitignore`) —
generate it once after cloning:

```sh
openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
  -keyout infrastructure/secrets/microverse.local.key \
  -out infrastructure/secrets/microverse.local.crt \
  -subj "/CN=microverse.local/O=Microverse Dev" \
  -addext "subjectAltName=DNS:microverse.local,DNS:sso.microverse.local,DNS:gofeeler.microverse.local,DNS:storage.microverse.local,DNS:springpix.microverse.local,DNS:pyreel.microverse.local,DNS:djaboard.microverse.local,DNS:elixtempo.microverse.local,DNS:rustledger.microverse.local,DNS:rubykudos.microverse.local,DNS:mailhog.microverse.local,DNS:listmonk.microverse.local,DNS:localhost"
```

(On Git Bash/MSYS, prefix with `MSYS_NO_PATHCONV=1` — otherwise it mangles the leading `/CN=...` as a path.)

Self-signed, so browsers will warn on first visit — expected for local
dev. Map `microverse.local`, `sso.microverse.local`,
`gofeeler.microverse.local`, `storage.microverse.local`,
`mailhog.microverse.local`, `listmonk.microverse.local`, and every
domain-service microsite subdomain
(`springpix`, `pyreel`, `djaboard`, `elixtempo`, `rustledger`,
`rubykudos` — see `data/services.js`'s `SERVICE_THEME`) to `127.0.0.1`
in your hosts file.
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
`mailhog.microverse.local` is the same kind of exception as `storage` —
dev tooling, not a domain-service microsite, given its own host purely
so the MailHog UI (`infrastructure/nginx/conf.d/mailhog.conf`) is
reachable by hostname instead of a raw port. MailHog has no
authentication of its own — anyone who can resolve the hostname can
browse every recipient's mail, not just their own.
`listmonk.microverse.local` is the same kind of dev-tooling exception,
for the Listmonk admin UI (`infrastructure/nginx/conf.d/listmonk.conf`)
— unlike MailHog it does have its own login (`LISTMONK_ADMIN_USER`/
`LISTMONK_ADMIN_PASSWORD` in `.env`).

If you generated your cert before this line existed, re-run the
`openssl` command above to pick up the new SAN entry — Chrome/Firefox
won't accept a cert whose SAN list doesn't include the host you're
visiting, even if the CN matches something else on the same cert.
