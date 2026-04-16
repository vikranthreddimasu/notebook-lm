from __future__ import annotations

import pytest
from notebooklm_backend.config import AppConfig
from notebooklm_backend.services.conversation_store import ConversationStore


@pytest.fixture
def store(tmp_path):
    settings = AppConfig(
        workspace_root=tmp_path,
        data_dir=tmp_path / "data",
        models_dir=tmp_path / "models",
        index_dir=tmp_path / "indexes",
        cache_dir=tmp_path / "cache",
    )
    return ConversationStore(settings)


def test_create_and_list_conversations(store):
    conv = store.create_conversation(notebook_id="nb1", title="Test Chat")
    assert conv.id
    assert conv.notebook_id == "nb1"
    assert conv.title == "Test Chat"

    convs = store.list_conversations("nb1")
    assert len(convs) == 1
    assert convs[0].id == conv.id


def test_list_conversations_filters_by_notebook(store):
    store.create_conversation(notebook_id="nb1", title="Chat A")
    store.create_conversation(notebook_id="nb2", title="Chat B")
    assert len(store.list_conversations("nb1")) == 1
    assert len(store.list_conversations("nb2")) == 1
    assert len(store.list_conversations("nb3")) == 0


def test_create_and_list_messages(store):
    conv = store.create_conversation(notebook_id="nb1")
    msg = store.add_message(conv.id, role="user", content="Hello")
    assert msg.id
    assert msg.role == "user"
    assert msg.content == "Hello"

    store.add_message(conv.id, role="assistant", content="Hi there",
                      sources=[{"source_path": "doc.pdf", "preview": "chunk"}])

    msgs = store.list_messages(conv.id)
    assert len(msgs) == 2
    assert msgs[0].role == "user"
    assert msgs[1].role == "assistant"
    assert msgs[1].sources == [{"source_path": "doc.pdf", "preview": "chunk"}]


def test_delete_conversation_cascades_to_messages(store):
    conv = store.create_conversation(notebook_id="nb1")
    store.add_message(conv.id, role="user", content="Hello")
    store.add_message(conv.id, role="assistant", content="Hi")

    store.delete_conversation(conv.id)
    assert store.get_conversation(conv.id) is None
    assert store.list_messages(conv.id) == []


def test_delete_conversations_for_notebook(store):
    c1 = store.create_conversation(notebook_id="nb1", title="Chat 1")
    c2 = store.create_conversation(notebook_id="nb1", title="Chat 2")
    store.add_message(c1.id, role="user", content="msg1")
    store.add_message(c2.id, role="user", content="msg2")

    store.delete_conversations_for_notebook("nb1")
    assert store.list_conversations("nb1") == []
    assert store.list_messages(c1.id) == []
    assert store.list_messages(c2.id) == []


def test_auto_title_sets_from_first_message(store):
    conv = store.create_conversation(notebook_id="nb1")
    assert conv.title is None

    title = store.auto_title_if_needed(conv.id, "What are the key findings in this paper?")
    assert title == "What are the key findings in this paper?"

    updated = store.get_conversation(conv.id)
    assert updated.title == "What are the key findings in this paper?"


def test_auto_title_truncates_to_50_chars(store):
    conv = store.create_conversation(notebook_id="nb1")
    long_msg = "A" * 100
    title = store.auto_title_if_needed(conv.id, long_msg)
    assert len(title) == 50


def test_auto_title_does_not_overwrite_existing(store):
    conv = store.create_conversation(notebook_id="nb1", title="Existing Title")
    result = store.auto_title_if_needed(conv.id, "New message")
    assert result is None
    assert store.get_conversation(conv.id).title == "Existing Title"


def test_unicode_in_title_and_content(store):
    conv = store.create_conversation(notebook_id="nb1", title="研究ノート 📝")
    assert conv.title == "研究ノート 📝"

    msg = store.add_message(conv.id, role="user", content="مرحبا بالعالم 🌍")
    assert msg.content == "مرحبا بالعالم 🌍"

    msgs = store.list_messages(conv.id)
    assert msgs[0].content == "مرحبا بالعالم 🌍"


def test_update_title(store):
    conv = store.create_conversation(notebook_id="nb1", title="Old")
    store.update_title(conv.id, "New Title")
    updated = store.get_conversation(conv.id)
    assert updated.title == "New Title"


def test_connect_rollback_on_exception(store):
    """Verify that failed operations don't leave partial writes."""
    conv = store.create_conversation(notebook_id="nb1")

    # Try to add a message with invalid role (CHECK constraint violation)
    with pytest.raises(Exception):
        store.add_message(conv.id, role="invalid_role", content="test")

    # Conversation should still exist and have no messages
    assert store.get_conversation(conv.id) is not None
    assert store.list_messages(conv.id) == []


def test_messages_ordered_by_created_at(store):
    conv = store.create_conversation(notebook_id="nb1")
    store.add_message(conv.id, role="user", content="First")
    store.add_message(conv.id, role="assistant", content="Second")
    store.add_message(conv.id, role="user", content="Third")

    msgs = store.list_messages(conv.id)
    assert [m.content for m in msgs] == ["First", "Second", "Third"]


def test_conversations_ordered_by_updated_at(store):
    c1 = store.create_conversation(notebook_id="nb1", title="Older")
    c2 = store.create_conversation(notebook_id="nb1", title="Newer")

    # c2 was created after c1, so it should appear first (DESC order)
    convs = store.list_conversations("nb1")
    assert convs[0].title == "Newer"
    assert convs[1].title == "Older"

    # Adding a message to c1 bumps its updated_at
    store.add_message(c1.id, role="user", content="bump")
    convs = store.list_conversations("nb1")
    assert convs[0].title == "Older"  # Now most recently updated
