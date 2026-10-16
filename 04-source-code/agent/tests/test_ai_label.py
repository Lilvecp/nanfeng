"""CAC Measures for Labelling AI-Generated Synthetic Content (in force Sept 2025): AI-written messages shown
to people in China carry an explicit label (05-security-self-assessment-report/privacy-compliance.md). NanFeng labels every
message it writes to an importer, in the importer's language."""

import pytest

from nanfeng_agent import fixtures, templates


def test_importer_in_china_gets_the_reminder_labelled_in_chinese(agent, hub):
    agent.handle_document(fixtures.shanghai_notice())
    [reminder] = [d for d in hub.outbox if d.message.kind == "collection"]
    assert reminder.channel == "wecom" and reminder.message.language == "zh"
    assert "由AI生成" in reminder.message.text


@pytest.mark.parametrize("lang,label", [("zh", "由AI生成"), ("en", "AI-generated"), ("es", "generado por IA")])
def test_every_importer_language_has_a_label(lang, label):
    assert label in templates.ai_label(lang)


def test_messages_to_the_owner_are_not_labelled(agent, hub):
    """The owner uses NanFeng knowingly; the label is for third parties."""
    agent.handle_document(fixtures.shanghai_notice())
    owner = [d for d in hub.outbox if d.message.kind in ("alert", "approval")]
    assert owner and not any("由AI生成" in d.message.text or "generado por IA" in d.message.text for d in owner)
