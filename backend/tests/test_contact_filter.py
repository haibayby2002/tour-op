import pytest

from apps.common.contact_filter import BLOCK, EMAIL, EXTERNAL_CHANNEL, LINK, PHONE, SOCIAL_HANDLE, WARN, scan


@pytest.mark.parametrize(
    "text",
    [
        "call me 0901234567",
        "my number is 090 123 4567",
        "+84 90-123-4567",
        "zero nine zero one two three four five six seven",
        "không chín không một hai ba bốn năm sáu",
        "0901.234.567",
    ],
)
def test_phone_numbers_are_blocked(text):
    result = scan(text)
    assert PHONE in result.reasons
    assert result.action == BLOCK


@pytest.mark.parametrize(
    "text",
    ["mail me at linh@gmail.com", "linh (at) gmail (dot) com", "linh at gmail dot com"],
)
def test_emails_are_blocked(text):
    result = scan(text)
    assert EMAIL in result.reasons
    assert result.action == BLOCK


@pytest.mark.parametrize(
    "text,reason",
    [
        ("add me on zalo", EXTERNAL_CHANNEL),
        ("Nhắn riêng cho mình qua Zalo nhé", EXTERNAL_CHANNEL),
        ("let's talk on WhatsApp", EXTERNAL_CHANNEL),
        ("follow @linh.saigon", SOCIAL_HANDLE),
        ("see www.mytours.com", LINK),
    ],
)
def test_off_platform_invites_warn(text, reason):
    result = scan(text)
    assert reason in result.reasons
    assert result.action == WARN


@pytest.mark.parametrize(
    "text",
    [
        "Let's meet at 09:30 on 2026-10-05 near the lake",
        "Price is 1.500.000 VND for the group, or 500,000 per person",
        "The tour takes 3 hours and covers 6 stops",
        "Năm nay mình hai mươi tám tuổi",
        "",
    ],
)
def test_normal_text_is_allowed(text):
    assert scan(text).action == "allow"
