import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import TASKS_TEMPLATE_NAME, app, es, service_index_name


@pytest.fixture(scope="module")
def client():
    # Context-manager form triggers the startup events (ensure_index,
    # ensure_tasks_template) against the real Elasticsearch instance —
    # same "integration, not mocked" posture as gofeeler's tests.
    with TestClient(app) as c:
        yield c


def test_service_index_name():
    assert service_index_name("gofeeler") == "tasks-gofeeler"


def test_health_reports_elasticsearch_up(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["elasticsearch"] == "up"


def test_tasks_template_registered(client):
    template = es.indices.get_index_template(name=TASKS_TEMPLATE_NAME).body
    names = [t["name"] for t in template["index_templates"]]
    assert TASKS_TEMPLATE_NAME in names


def test_new_service_index_inherits_tasks_mapping(client):
    # Disposable service name, not a real one — never touch tasks-gofeeler.
    index = service_index_name(f"citest-{uuid.uuid4().hex[:8]}")
    task_id = str(uuid.uuid4())
    try:
        es.index(
            index=index,
            id=task_id,
            document={"title": "CI test order", "status": "unassigned"},
            refresh="wait_for",
        )
        mapping = es.indices.get_mapping(index=index).body[index]["mappings"]["properties"]
        assert mapping["title"]["type"] == "text"
        assert mapping["context"]["type"] == "text"
        assert mapping["status"]["type"] == "keyword"
        assert mapping["assignee_ids"]["type"] == "keyword"
        assert mapping["created_at"]["type"] == "date"
        assert "service" not in mapping  # implicit in the index name, not a field
    finally:
        es.indices.delete(index=index, ignore_unavailable=True)


def test_tag_suggest_still_works(client):
    # Regression check — this endpoint predates 6.1 and shares main.py.
    resp = client.get("/tags/suggest", params={"q": "urg"})
    assert resp.status_code == 200
    assert any(m["name"] == "urgency" for m in resp.json()["matches"])
