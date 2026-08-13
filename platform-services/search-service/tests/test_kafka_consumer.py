import uuid

import pytest

from app.main import es, service_index_name
from app.kafka_consumer import index_task_event, task_event_to_doc


# No live Kafka broker in this suite — CI's docker-compose profile is the
# real end-to-end check (see docs/development/TESTING.md's manual section
# for 6.2). What's actually novel/risky here is the event -> ES upsert
# logic, not the third-party Kafka client's wire protocol, so these hit
# real Elasticsearch directly with a fabricated event dict, same
# "integration, not mocked" posture as the rest of this suite applied to
# the one boundary that matters.


def test_task_event_to_doc_whitelists_fields():
    event = {
        "event": "task.assigned",
        "task_id": "some-id",
        "service": "gofeeler",
        "title": "Order title",
        "context": "order context",
        "status": "analyst",
        "tags": ["urgency"],
        "owner": "analyst@microverse.local",
        "assignee_ids": ["analyst@microverse.local"],
        "customer_id": "cust-1",
        "account_id": "acct-1",
        "project_id": None,
        "created_at": "2026-01-01T00:00:00Z",
        "assigned_at": "2026-01-01T00:00:01Z",
    }
    doc = task_event_to_doc(event)
    assert doc["title"] == "Order title"
    assert doc["assignee_ids"] == ["analyst@microverse.local"]
    # routing info doesn't leak into the doc body
    assert "event" not in doc
    assert "task_id" not in doc
    assert "service" not in doc


def test_task_event_to_doc_defaults_missing_arrays():
    doc = task_event_to_doc({"task_id": "x", "service": "gofeeler"})
    assert doc["tags"] == []
    assert doc["assignee_ids"] == []


@pytest.fixture
def disposable_index():
    index = service_index_name(f"citest-{uuid.uuid4().hex[:8]}")
    yield index
    es.indices.delete(index=index, ignore_unavailable=True)


def test_index_task_event_upserts_by_task_id(disposable_index):
    task_id = str(uuid.uuid4())
    service = disposable_index.removeprefix("tasks-")
    event = {
        "event": "task.assigned",
        "task_id": task_id,
        "service": service,
        "title": "First pass",
        "status": "analyst",
        "assignee_ids": ["analyst@microverse.local"],
    }

    index_task_event(es, event, service_index_name)
    es.indices.refresh(index=disposable_index)
    doc = es.get(index=disposable_index, id=task_id)
    assert doc.body["_source"]["title"] == "First pass"
    assert doc.body["_source"]["status"] == "analyst"
    assert doc.body["_source"]["assignee_ids"] == ["analyst@microverse.local"]

    # A later lifecycle event (e.g. task.approved) republishes the task's
    # full current state — same _id, so this is an overwrite, not a
    # second document (6.1.3's idempotent-upsert design).
    approved_event = {
        **event,
        "event": "task.approved",
        "title": "First pass",
        "status": "done",
        "assignee_ids": [],
    }
    index_task_event(es, approved_event, service_index_name)
    es.indices.refresh(index=disposable_index)

    count = es.count(index=disposable_index)
    assert count.body["count"] == 1

    doc = es.get(index=disposable_index, id=task_id)
    assert doc.body["_source"]["status"] == "done"
    assert doc.body["_source"]["assignee_ids"] == []


def test_index_task_event_skips_when_missing_task_id_or_service(disposable_index):
    service = disposable_index.removeprefix("tasks-")
    # Missing task_id — nothing to key the upsert on, must be a no-op,
    # not a crash.
    index_task_event(es, {"service": service, "title": "no id"}, service_index_name)
    es.indices.refresh(index=disposable_index, ignore_unavailable=True)
    count = es.count(index=disposable_index, ignore_unavailable=True)
    assert count.body["count"] == 0


def test_index_task_event_deletes_on_no_index(disposable_index):
    # 6.3 — a no_index: true event removes an already-indexed doc, not
    # just suppresses future writes. Index it first via a normal event,
    # then flag it, and confirm the doc is actually gone.
    task_id = str(uuid.uuid4())
    service = disposable_index.removeprefix("tasks-")
    event = {
        "event": "task.assigned",
        "task_id": task_id,
        "service": service,
        "title": "Sensitive order",
        "status": "analyst",
    }
    index_task_event(es, event, service_index_name)
    es.indices.refresh(index=disposable_index)
    assert es.exists(index=disposable_index, id=task_id)

    flagged_event = {**event, "event": "task.no-index-changed", "no_index": True}
    index_task_event(es, flagged_event, service_index_name)
    es.indices.refresh(index=disposable_index)
    assert not es.exists(index=disposable_index, id=task_id)


def test_index_task_event_deleting_missing_doc_is_a_noop(disposable_index):
    # A no_index: true event for a task that was never indexed (or
    # already removed by an earlier no_index event) must not raise.
    task_id = str(uuid.uuid4())
    service = disposable_index.removeprefix("tasks-")
    event = {"task_id": task_id, "service": service, "no_index": True}
    index_task_event(es, event, service_index_name)  # no exception
    es.indices.refresh(index=disposable_index, ignore_unavailable=True)
    count = es.count(index=disposable_index, ignore_unavailable=True)
    assert count.body["count"] == 0


def test_index_task_event_reindexes_after_un_flagging(disposable_index):
    # Reconcile the other direction — a later no_index: false event
    # (unflagging) re-indexes the task, same as any other upsert.
    task_id = str(uuid.uuid4())
    service = disposable_index.removeprefix("tasks-")
    flagged_event = {"task_id": task_id, "service": service, "title": "Was hidden", "no_index": True}
    index_task_event(es, flagged_event, service_index_name)
    es.indices.refresh(index=disposable_index, ignore_unavailable=True)
    assert not es.exists(index=disposable_index, id=task_id)

    unflagged_event = {**flagged_event, "no_index": False}
    index_task_event(es, unflagged_event, service_index_name)
    es.indices.refresh(index=disposable_index)
    doc = es.get(index=disposable_index, id=task_id)
    assert doc.body["_source"]["title"] == "Was hidden"
