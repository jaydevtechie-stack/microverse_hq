import http.server
import json
import threading
import time
import uuid

import jwt as pyjwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app.main import (
    BLOG_INDEX,
    TASKS_TEMPLATE_NAME,
    app,
    build_search_query,
    claims_from_header,
    es,
    resolve_scope,
    service_index_name,
    set_jwks_url_for_tests,
)

_TEST_KID = "test-key-1"


def _b64url_uint(n: int) -> str:
    length = (n.bit_length() + 7) // 8
    from base64 import urlsafe_b64encode

    return urlsafe_b64encode(n.to_bytes(length, "big")).rstrip(b"=").decode()


class _JWKSHandler(http.server.BaseHTTPRequestHandler):
    public_numbers = None  # set per-server instance below

    def do_GET(self):  # noqa: N802 - stdlib naming
        body = json.dumps(
            {
                "keys": [
                    {
                        "kty": "RSA",
                        "kid": _TEST_KID,
                        "use": "sig",
                        "alg": "RS256",
                        "n": _b64url_uint(self.public_numbers.n),
                        "e": _b64url_uint(self.public_numbers.e),
                    }
                ]
            }
        ).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass  # keep test output quiet


_current_private_key = None  # set by the jwks_keypair fixture below


@pytest.fixture(scope="module", autouse=True)
def jwks_keypair():
    # Real RSA keypair + a real local HTTP server standing in for
    # Keycloak's JWKS endpoint, so signature verification (6.4) is
    # exercised against real crypto rather than mocked away entirely —
    # module-scoped and autouse so every test in this file shares one
    # running mock server and one key without each test needing to
    # request this fixture explicitly (kept _bearer_token's original
    # call signature — `_bearer_token(roles)` — unchanged everywhere
    # else in this file).
    global _current_private_key
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    _current_private_key = private_key

    handler = type("Handler", (_JWKSHandler,), {"public_numbers": private_key.public_key().public_numbers()})
    server = http.server.HTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    url = f"http://127.0.0.1:{server.server_port}/certs"
    set_jwks_url_for_tests(url)
    try:
        yield private_key
    finally:
        server.shutdown()
        set_jwks_url_for_tests(None)
        _current_private_key = None


@pytest.fixture(scope="module")
def client(jwks_keypair):
    # Context-manager form triggers the startup events (ensure_index,
    # ensure_tasks_template) against the real Elasticsearch instance —
    # same "integration, not mocked" posture as gofeeler's tests.
    with TestClient(app) as c:
        yield c


def _sign(private_key, claims: dict, kid: str = _TEST_KID, expires_in: float = 300) -> str:
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    payload = {"exp": int(time.time() + expires_in), **claims}
    return pyjwt.encode(payload, private_pem, algorithm="RS256", headers={"kid": kid})


def _bearer_token(roles, private_key=None, **kwargs):
    # Real Keycloak access tokens always carry aud: "account" — included
    # by default so this suite exercises the same shape a real token
    # has. A sibling Rust implementation of this exact fix shipped a
    # real bug where the JWT library's default validation silently
    # rejected every real token over this exact field, caught only
    # because a live check happened to include it — baking it in here
    # so that class of bug can't hide behind this test suite either.
    claims = {"sub": "user-1", "aud": "account", "realm_access": {"roles": roles}}
    token = _sign(private_key or _current_private_key, claims, **kwargs)
    return f"Bearer {token}".encode()


def test_service_index_name():
    assert service_index_name("gofeeler") == "tasks-gofeeler"


def test_claims_from_header_verifies_a_real_token(jwks_keypair):
    token = _bearer_token(["platform:analyst", "service:gofeeler"], jwks_keypair).decode()
    claims = claims_from_header(token)
    assert claims["realm_access"]["roles"] == ["platform:analyst", "service:gofeeler"]


@pytest.mark.parametrize("authorization", [None, "", "not-a-bearer-token", "Bearer onlyonepart"])
def test_claims_from_header_rejects_malformed_input(authorization):
    assert claims_from_header(authorization) is None


def test_claims_from_header_rejects_a_forged_token(jwks_keypair):
    other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    # Signed with a different key than the one the mock JWKS serves
    # under this kid — the actual forged-token scenario this fix closes.
    forged = _bearer_token(["platform:admin"], other_key).decode()
    assert claims_from_header(forged) is None


def test_claims_from_header_rejects_an_expired_token(jwks_keypair):
    expired = _bearer_token(["platform:admin"], jwks_keypair, expires_in=-3600).decode()
    assert claims_from_header(expired) is None


def test_claims_from_header_rejects_an_unrecognized_kid(jwks_keypair):
    token = _bearer_token(["platform:admin"], jwks_keypair, kid="not-the-real-kid").decode()
    assert claims_from_header(token) is None


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


@pytest.fixture
def scoped_blog_post(client):
    # Writes straight to ES, bypassing blog-service/Kafka entirely — same
    # posture as scoped_task, which does the same for tasks-<service>.
    post_id = str(uuid.uuid4())
    slug = f"citest-post-{uuid.uuid4().hex[:8]}"
    es.index(
        index=BLOG_INDEX,
        id=post_id,
        document={"title": "Widgetopolis launch notes", "context": "how we shipped the widget dashboard", "slug": slug},
        refresh="wait_for",
    )
    try:
        yield post_id, slug
    finally:
        es.options(ignore_status=404).delete(index=BLOG_INDEX, id=post_id)


def test_search_includes_blog_articles_for_anonymous_caller(client, scoped_blog_post):
    post_id, slug = scoped_blog_post
    resp = client.get("/search", params={"q": "widgetopolis"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["hits"][0] == {
        "type": "blog",
        "task_id": None,
        "slug": slug,
        "title": "Widgetopolis launch notes",
        "snippet": "how we shipped the widget dashboard",
        "service": "blog",
        "score": body["hits"][0]["score"],
    }


def test_search_blends_blog_articles_with_scoped_tasks(client, scoped_task, scoped_blog_post):
    # Both fixtures use "widget" so one query surfaces one of each type.
    service, task_id = scoped_task
    _, slug = scoped_blog_post
    token = _bearer_token(["platform:analyst", f"service:{service}"]).decode()
    resp = client.get("/search", params={"q": "widget"}, headers={"Authorization": token})
    assert resp.status_code == 200
    types = {hit["type"] for hit in resp.json()["hits"]}
    assert types == {"task", "blog"}


def test_search_service_param_excludes_blog(client, scoped_blog_post):
    # `service` is task-only narrowing (see /search's own comment) — it
    # should never surface blog-articles, even for a caller with no
    # matching task scope at all.
    resp = client.get("/search", params={"q": "widgetopolis", "service": "gofeeler"})
    assert resp.json() == {"hits": [], "total": 0, "page": 1, "size": 10}
