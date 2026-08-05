# asset-service

**Status:** not yet implemented — folder scaffold only.

Owns uploaded media itself: storage, versions, and permissions. Separate
from [`order-service`](../order-service/README.md), which owns the order
that references the asset — this service only cares about the file.
Likely backed by MinIO (already running in the stack; see
`microverse-minio` in docker-compose.yml).
