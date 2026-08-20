import uuid

import pytest

from app.main import BLOG_INDEX, es
from app.blog_kafka_consumer import index_post_event, post_event_to_doc


# Same "integration, not mocked" posture as test_kafka_consumer.py — no
# live Kafka broker here, just the event -> ES upsert logic that's
# actually novel/risky, hit against real Elasticsearch directly.


def test_post_event_to_doc_whitelists_fields():
    event = {
        "event": "post.published",
        "post_id": "some-id",
        "title": "Post title",
        "slug": "post-title",
        "context": "excerpt plus stripped body text",
        "tags": ["shipping"],
        "author_name": "Jay",
        "published_at": "2026-01-01T00:00:00Z",
        "published": True,
    }
    doc = post_event_to_doc(event)
    assert doc["title"] == "Post title"
    assert doc["slug"] == "post-title"
    # routing info doesn't leak into the doc body
    assert "event" not in doc
    assert "post_id" not in doc
    assert "published" not in doc


def test_post_event_to_doc_defaults_missing_tags():
    doc = post_event_to_doc({"post_id": "x", "title": "t"})
    assert doc["tags"] == []


@pytest.fixture
def post_id():
    pid = str(uuid.uuid4())
    yield pid
    es.options(ignore_status=404).delete(index=BLOG_INDEX, id=pid)


def test_index_post_event_upserts_when_published(post_id):
    event = {
        "post_id": post_id,
        "title": "First draft, now live",
        "slug": "first-draft-now-live",
        "context": "shipped it",
        "published": True,
    }
    index_post_event(es, event, BLOG_INDEX)
    es.indices.refresh(index=BLOG_INDEX)
    doc = es.get(index=BLOG_INDEX, id=post_id)
    assert doc.body["_source"]["title"] == "First draft, now live"

    # A later update republishes full state — same _id, an overwrite.
    updated_event = {**event, "title": "Retitled after publish"}
    index_post_event(es, updated_event, BLOG_INDEX)
    es.indices.refresh(index=BLOG_INDEX)
    doc = es.get(index=BLOG_INDEX, id=post_id)
    assert doc.body["_source"]["title"] == "Retitled after publish"


def test_index_post_event_skips_when_missing_post_id():
    index_post_event(es, {"title": "no id", "published": True}, BLOG_INDEX)  # no exception


def test_index_post_event_deletes_when_not_published(post_id):
    event = {"post_id": post_id, "title": "Now a draft again", "published": True}
    index_post_event(es, event, BLOG_INDEX)
    es.indices.refresh(index=BLOG_INDEX)
    assert es.exists(index=BLOG_INDEX, id=post_id)

    unpublished_event = {**event, "published": False}
    index_post_event(es, unpublished_event, BLOG_INDEX)
    es.indices.refresh(index=BLOG_INDEX)
    assert not es.exists(index=BLOG_INDEX, id=post_id)


def test_index_post_event_deleting_missing_doc_is_a_noop(post_id):
    event = {"post_id": post_id, "published": False}
    index_post_event(es, event, BLOG_INDEX)  # no exception
    es.indices.refresh(index=BLOG_INDEX, ignore_unavailable=True)
    assert not es.exists(index=BLOG_INDEX, id=post_id)
