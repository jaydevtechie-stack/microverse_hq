# infrastructure/secrets

Local-dev TLS material for nginx. Not committed (see `.gitignore`) —
generate it once after cloning:

```sh
openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
  -keyout infrastructure/secrets/microverse.local.key \
  -out infrastructure/secrets/microverse.local.crt \
  -subj "/CN=microverse.local/O=Microverse Dev" \
  -addext "subjectAltName=DNS:microverse.local,DNS:sso.microverse.local,DNS:gofeeler.microverse.local,DNS:localhost"
```

Self-signed, so browsers will warn on first visit — expected for local
dev. Map `microverse.local`, `sso.microverse.local`, and
`gofeeler.microverse.local` to `127.0.0.1` in your hosts file.
Domain-service microsites each get their own `DNS:` entry here and
their own line in the hosts file as they come online (gofeeler is the
first) — platform features (dashboard, customer, analyst) stay under
paths on `microverse.local` itself, no subdomain needed.
