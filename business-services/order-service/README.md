# order-service

**Status:** not yet implemented — folder scaffold only.

Entry point of the core workflow: a customer creates an Order and uploads
the media that needs analysis (e.g. a raster image to check for hotspots
in a forest). Owns the order lifecycle and customer-facing state; the
media itself is owned by
[`asset-service`](../../platform-services/asset-service/README.md), not
this service.
