import base64
import json
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import (
    TASKS_TEMPLATE_NAME,
    app,
    build_search_query,
    claims_from_header,
    es,
    resolve_scope,
    service_index_name,
)


@pytest.fixture(scope="module")
def client():
    # Context-manager form triggers the startup events (ensure_index,
    # ensure_tasks_template) against the real Elasticsearch instance —
    # same "integration, not mocked" posture as gofeeler's tests.
    with TestClient(app) as c:
        yield c


def _bearer_token(roles):
    # Unverified-decode posture (6.4) — only the payload segment matters
    # for these tests, header/signature are throwaway since nothing here
    # checks them (see claims_from_header's docstring comment in main.py).
    payload = base64.urlsafe_b64encode(json.dumps({"realm_access": {"roles": roles}}).encode()).rstrip(b"=")
    return b"Bearer header." + payload + b".sig"


def test_service_index_name():
    assert service_index_name("gofeeler") == "tasks-gofeeler"


def test_claims_from_header_decodes_unverified_payload():
    token = _bearer_token(["platform:analyst", "service:gofeeler"]).decode()
    claims = claims_from_header(token)
    assert claims["realm_access"]["roles"] == ["platform:analyst", "service:gofeeler"]


@pytest.mark.parametrize("authorization", [None, "", "not-a-bearer-token", "Bearer onlyonepart"])
def test_claims_from_header_rejects_malformed_input(authorization):
    assert claims_from_header(authorization) is None


def test_resolve_scope_admin_has_no_scope():
    claims = {"realm_access": {"roles": ["platform:admin", "service:gofeeler"]}}
    assert resolve_scope(claims) == []


def test_resolve_scope_maps_service_roles_to_indices():
    claims = {"realm_access": {"roles": ["platform:analyst", "service:gofeeler", "service:rustledger"]}}
    assert set(resolve_scope(claims)) == {"tasks-gofeeler", "tasks-rustledger"}


@pytest.mark.parametrize("claims", [None, {}, {"realm_access": {"roles": ["platform:analyst"]}}])
def test_resolve_scope_fails_closed_without_service_roles(claims):
    assert resolve_scope(claims) == []


def test_build_search_query_has_no_service_clause():
    # Service access is enforced by index selection (resolve_scope), not
    # a query-time filter — there's no `service` field to filter on.
    query = build_search_query("widget", status="open")
    assert "service" not in json.dumps(query)
    assert query["bool"]["filter"] == [{"term": {"status": "open"}}]


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


@pytest.fixture
def scoped_task(client):
    # Disposable service name, not a real one — mirrors
    # test_new_service_index_inherits_tasks_mapping's posture of never
    # touching a real tasks-<service> index from tests.
    service = f"citest-{uuid.uuid4().hex[:8]}"
    index = service_index_name(service)
    task_id = str(uuid.uuid4())
    es.index(
        index=index,
        id=task_id,
        document={"title": "Widget order delayed", "context": "customer is asking for a refund", "status": "open"},
        refresh="wait_for",
    )
    try:
        yield service, task_id
    finally:
        es.indices.delete(index=index, ignore_unavailable=True)


def test_search_returns_hits_within_scope(client, scoped_task):
    service, task_id = scoped_task
    token = _bearer_token(["platform:analyst", f"service:{service}"]).decode()
    resp = client.get("/search", params={"q": "widget"}, headers={"Authorization": token})
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["hits"][0]["task_id"] == task_id
    assert body["hits"][0]["service"] == service


def test_search_fails_closed_without_matching_service_role(client, scoped_task):
    service, _ = scoped_task
    # Analyst for a *different* service — must not see this task even
    # though the query text matches.
    token = _bearer_token(["platform:analyst", "service:some-other-service"]).decode()
    resp = client.get("/search", params={"q": "widget"}, headers={"Authorization": token})
    assert resp.status_code == 200
    assert resp.json() == {"hits": [], "total": 0, "page": 1, "size": 10}


def test_search_admin_has_no_results(client, scoped_task):
    service, _ = scoped_task
    token = _bearer_token(["platform:admin", f"service:{service}"]).decode()
    resp = client.get("/search", params={"q": "widget"}, headers={"Authorization": token})
    assert resp.json()["total"] == 0


def test_search_service_param_outside_scope_returns_empty(client, scoped_task):
    service, _ = scoped_task
    token = _bearer_token(["platform:analyst", f"service:{service}"]).decode()
    resp = client.get(
        "/search", params={"q": "widget", "service": "some-other-service"}, headers={"Authorization": token}
    )
    assert resp.json()["total"] == 0


def test_search_without_query_returns_empty_without_auth(client):
    resp = client.get("/search", params={"q": "  "})
    assert resp.status_code == 200
    assert resp.json() == {"hits": [], "total": 0, "page": 1, "size": 10}


def test_tag_suggest_still_works(client):
    # Regression check — this endpoint predates 6.1 and shares main.py.
    resp = client.get("/tags/suggest", params={"q": "urg"})
    assert resp.status_code == 200
    assert any(m["name"] == "urgency" for m in resp.json()["matches"])
