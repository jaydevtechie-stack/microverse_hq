# infrastructure/secrets

Local-dev TLS material for nginx. Not committed (see `.gitignore`) —
generate it once after cloning:

```sh
openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
  -keyout infrastructure/secrets/microverse.local.key \
  -out infrastructure/secrets/microverse.local.crt \
  -subj "/CN=microverse.local/O=Microverse Dev" \
  -addext "subjectAltName=DNS:microverse.local,DNS:sso.microverse.local,DNS:localhost"
```

Self-signed, so browsers will warn on first visit — expected for local
dev. Map `microverse.local` and `sso.microverse.local` to `127.0.0.1` in
your hosts file.
