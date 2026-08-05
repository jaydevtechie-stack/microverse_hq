# email-service

**Status:** working. Node/Express, sends via MailHog in dev.

Shared email-sending service — any other service calls
`POST /email/send` with `{ to, subject, userName, message, brandName, template? }`
and this renders an HTML template (`src/templates/<template>/emailTemplate.html`,
defaults to `default`) and sends it. `GET /health` for a liveness check.

Talks to MailHog over SMTP (`MAILHOG_SMTP_SERVER`, e.g. `mailhog:1025`) —
in production this would point at a real SMTP provider instead.
