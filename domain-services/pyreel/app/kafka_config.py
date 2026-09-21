import os

# task-service's own Kafka broker — reused rather than standing up a second
# one (see docs/roadmap/1.1/domain-services.md's PyReel Phase 1).
KAFKA_BROKERS = os.environ.get("KAFKA_BROKERS", "microverse-kafka:9092")

# Producer-owns-its-topic naming, matching task-service.tasks/elixtempo.sessions.
REQUESTS_TOPIC = "pyreel.analyze-requests"
RESULTS_TOPIC = "pyreel.videos"
