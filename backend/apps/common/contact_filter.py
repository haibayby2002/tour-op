"""Detection of contact details and off-platform invitations.

Tour-op requires both parties to communicate inside the app. This module
scans free text for:

* phone numbers (incl. separators and digits spelled out in English/Vietnamese)
* email addresses (incl. "name (at) domain (dot) com" style obfuscation)
* links / bare domains
* invitations to move to another channel (Zalo, WhatsApp, "call me", ...)
* social handles (@name)

Hard contact details (phone, email) are BLOCKED; softer signals are WARNED.
No filter catches every obfuscation; this is a deterrent plus an audit trail,
not a guarantee.
"""
from __future__ import annotations

from dataclasses import dataclass, field
import re
import unicodedata

ALLOW = "allow"
WARN = "warn"
BLOCK = "block"

# Reason codes are stable identifiers that the clients translate.
PHONE = "phone"
EMAIL = "email"
LINK = "link"
EXTERNAL_CHANNEL = "external_channel"
SOCIAL_HANDLE = "social_handle"

BLOCKING_REASONS = {PHONE, EMAIL}

_DATE_RE = re.compile(r"\b\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4}\b")
_TIME_RE = re.compile(r"\b\d{1,2}\s?[:h]\s?\d{2}\b", re.IGNORECASE)
# Money written with thousands separators: 1.500.000 / 250,000
_MONEY_RE = re.compile(r"(?<![\d.,])\d{1,3}(?:[.,]\d{3})+(?![\d.,])")
# 9-15 digits, allowing a single separator character between digits.
_PHONE_RE = re.compile(r"(?<!\w)\+?\d(?:[\s.\-()]?\d){8,14}(?!\w)")

_EMAIL_RE = re.compile(
    r"[\w.+-]+\s*(?:@|\(\s*at\s*\)|\[\s*at\s*\]|\s+at\s+|\s+a\s*cong\s+)\s*"
    r"[\w-]+(?:\s*(?:\.|\(\s*dot\s*\)|\[\s*dot\s*\]|\s+dot\s+|\s+cham\s+)\s*[\w-]+)*"
    r"\s*(?:\.|\(\s*dot\s*\)|\[\s*dot\s*\]|\s+dot\s+|\s+cham\s+)\s*(?:com|net|org|vn|io|me|co|edu|gov|info)\b",
    re.IGNORECASE,
)

_LINK_RE = re.compile(
    r"(?:https?://|www\.)\S+|\b[\w-]+\.(?:com|net|org|vn|io|me|ly|gl|co|link|page|site|app)(?:/\S*)?\b",
    re.IGNORECASE,
)

_HANDLE_RE = re.compile(r"(?<![\w@])@[A-Za-z0-9_.]{3,30}\b")

# Keywords are matched against accent-stripped lowercase text.
_EXTERNAL_KEYWORDS = [
    r"zalo", r"whats\s?app", r"viber", r"telegram", r"wechat", r"we\s?chat",
    r"line\s?id", r"kakao", r"signal\s?app", r"messenger", r"facebook", r"\bfb\b",
    r"instagram", r"\binsta\b", r"\big\b", r"tiktok", r"skype",
    r"call me", r"text me", r"message me (?:on|at|via)", r"email me", r"dm me",
    r"add me", r"my number", r"phone number", r"contact me (?:on|at|via|outside)",
    r"pay (?:me )?(?:directly|outside|in cash outside)", r"outside (?:the|this) app",
    r"so dien thoai", r"\bsdt\b", r"goi cho (?:minh|toi|em|anh|chi)", r"goi (?:minh|toi|em|anh|chi)",
    r"nhan rieng", r"inbox (?:minh|toi|em|anh|chi)", r"ket ban", r"lien he (?:rieng|ngoai)",
    r"chuyen khoan (?:truc tiep|rieng)", r"ngoai app", r"ngoai ung dung",
]
_EXTERNAL_RE = re.compile("|".join(_EXTERNAL_KEYWORDS))

_NUMBER_WORDS = {
    # English
    "zero": "0", "oh": "0", "one": "1", "two": "2", "three": "3", "four": "4",
    "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9",
    # Vietnamese (accent-stripped)
    "khong": "0", "mot": "1", "hai": "2", "ba": "3", "bon": "4", "tu": "4",
    "nam": "5", "lam": "5", "sau": "6", "bay": "7", "tam": "8", "chin": "9",
}
_WORD_TOKEN_RE = re.compile(r"[a-z]+|\d")


@dataclass
class ScanResult:
    action: str = ALLOW
    reasons: list[str] = field(default_factory=list)

    @property
    def blocked(self) -> bool:
        return self.action == BLOCK

    @property
    def warned(self) -> bool:
        return self.action == WARN


def _strip_accents(text: str) -> str:
    text = text.replace("đ", "d").replace("Đ", "D")
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def _spelled_out_digits(plain: str) -> bool:
    """Detect 9+ consecutive digit words/digits, e.g. 'khong chin mot hai ...'."""
    run = 0
    for token in _WORD_TOKEN_RE.findall(plain):
        if token.isdigit() or token in _NUMBER_WORDS:
            run += 1
            if run >= 9:
                return True
        else:
            run = 0
    return False


def _has_phone(text: str) -> bool:
    cleaned = _DATE_RE.sub(" # ", text)
    cleaned = _TIME_RE.sub(" # ", cleaned)
    cleaned = _MONEY_RE.sub(" # ", cleaned)
    for match in _PHONE_RE.finditer(cleaned):
        digits = re.sub(r"\D", "", match.group())
        if 9 <= len(digits) <= 15:
            return True
    return False


def scan(text: str | None) -> ScanResult:
    if not text:
        return ScanResult()

    plain = _strip_accents(text).lower()
    reasons: list[str] = []

    if _EMAIL_RE.search(text) or _EMAIL_RE.search(plain):
        reasons.append(EMAIL)
    if _has_phone(text) or _spelled_out_digits(plain):
        reasons.append(PHONE)
    if EMAIL not in reasons and _LINK_RE.search(text):
        reasons.append(LINK)
    if _EXTERNAL_RE.search(plain):
        reasons.append(EXTERNAL_CHANNEL)
    if EMAIL not in reasons and _HANDLE_RE.search(text):
        reasons.append(SOCIAL_HANDLE)

    if any(r in BLOCKING_REASONS for r in reasons):
        action = BLOCK
    elif reasons:
        action = WARN
    else:
        action = ALLOW
    return ScanResult(action=action, reasons=reasons)
