"""Auto-detect spreadsheet column types and propose key mappings."""

import re
from dataclasses import dataclass, field

import pandas as pd

DATE_PATTERNS = [
    re.compile(r"^\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4}$"),
    re.compile(r"^\d{4}[/\-\.]\d{1,2}[/\-\.]\d{1,2}$"),
    re.compile(r"^\d{1,2}\s+\w+\s+\d{2,4}$"),
    re.compile(r"^\w+\s+\d{1,2},?\s+\d{2,4}$"),
]

POSSIBLE_DATE_LENGTH = {8}


@dataclass
class DetectedColumn:
    header: str
    detected_type: str
    sample_values: list[str]
    flags: list[str] = field(default_factory=list)
    suggested_key_id: int | None = None
    suggested_key_name: str | None = None
    match_confidence: str = "unmapped"
    decimal_places: int | None = None


def _is_delimited_date(value: str) -> bool:
    s = str(value).strip()
    return any(p.match(s) for p in DATE_PATTERNS)


def _has_leading_zeros(value: str) -> bool:
    """Detect leading zeros that indicate text (IDs, codes), not numeric values.

    0.5 is NOT a leading zero (standard decimal notation).
    007 IS a leading zero (would lose the zeros if cast to int).
    00 IS a leading zero.
    """
    s = str(value).strip()
    if not s or s[0] != "0":
        return False
    # 0.xxx is normal decimal notation, not a meaningful leading zero
    if len(s) > 1 and s[1] == ".":
        return False
    # "0" alone is fine
    if len(s) == 1:
        return False
    # "00", "007", "0192" — leading zeros on integers
    return True


def _is_numeric(value: str) -> bool:
    s = str(value).strip()
    try:
        float(s)
        return True
    except (ValueError, TypeError):
        return False


def _is_numeric_like(value: str) -> bool:
    """Recognizes pure numbers AND below/above detection limit values like <0.001, >5."""
    s = str(value).strip()
    if _is_numeric(s):
        return True
    if s and s[0] in ("<", ">"):
        return _is_numeric(s[1:])
    return False


def _could_be_undelimited_date(value: str) -> bool:
    s = str(value).strip()
    return s.isdigit() and len(s) in POSSIBLE_DATE_LENGTH


def _infer_decimal_places(values: list) -> int | None:
    places = []
    for v in values:
        s = str(v).strip()
        if "." in s:
            places.append(len(s.split(".")[-1]))
    if not places:
        return 0
    return max(places)


ZIPCODE_HEADERS = {"zip", "zipcode", "zip code", "postal", "postal code"}


def detect_column_type(
    values: list,
    header: str = "",
) -> tuple[str, list[str], int | None]:
    non_null = [v for v in values if v is not None and str(v).strip() != ""]
    flags: list[str] = []

    # No data — check if matched FieldKey can provide a hint
    if not non_null:
        return "text", ["no_data"], None

    # Zipcode detection by header name
    if header.strip().lower() in ZIPCODE_HEADERS:
        return "text", [], None

    str_values = [str(v).strip() for v in non_null]

    # Native datetime objects from pandas
    if hasattr(non_null[0], "strftime"):
        return "date", [], None

    # Delimited date strings
    date_count = sum(1 for s in str_values if _is_delimited_date(s))
    if date_count > len(str_values) * 0.5:
        return "date", [], None

    # Leading zeros — text (with possible date flag)
    leading_zero_count = sum(1 for s in str_values if _has_leading_zeros(s))
    if leading_zero_count > 0:
        undelimited_date_count = sum(
            1 for s in str_values if _could_be_undelimited_date(s)
        )
        if undelimited_date_count > len(str_values) * 0.5:
            flags.append("possible_undelimited_date")
        return "text", flags, None

    # Numeric: if all non-null values are numeric-like (including <0.001, >5 etc.)
    numeric_like_count = sum(1 for s in str_values if _is_numeric_like(s))
    if numeric_like_count == len(str_values):
        dp = _infer_decimal_places(non_null)
        return "numeric", flags, dp

    return "text", flags, None


def detect_spreadsheet(
    file_path: str,
    existing_keys: list[dict] | None = None,
) -> list[DetectedColumn]:
    df = pd.read_excel(file_path, sheet_name=0, nrows=20)

    results = []
    key_lookup = {}
    if existing_keys:
        for k in existing_keys:
            key_lookup[k["name"].lower()] = k
            key_lookup[k["display_name"].lower()] = k

    for col_name in df.columns:
        values = df[col_name].dropna().tolist()
        sample = [str(v) for v in values[:5]]

        detected_type, flags, decimal_places = detect_column_type(values, str(col_name))

        suggested_key_id = None
        suggested_key_name = None
        matched_key = None
        confidence = "unmapped"

        header_lower = str(col_name).strip().lower()
        if header_lower in key_lookup:
            matched_key = key_lookup[header_lower]
            suggested_key_id = matched_key["id"]
            suggested_key_name = matched_key["name"]
            confidence = "auto"
        elif existing_keys:
            best_score = 0.0
            best_key = None
            for k in existing_keys:
                score = _match_score(header_lower, k["name"], k["display_name"])
                if score > best_score:
                    best_score = score
                    best_key = k
            if best_key and best_score >= MATCH_THRESHOLD:
                matched_key = best_key
                suggested_key_id = best_key["id"]
                suggested_key_name = best_key["name"]
                confidence = "auto" if best_score >= 0.9 else "suggested"

        # When no data but matched a key, surface the key's type as a hint
        if "no_data" in flags and matched_key and "data_type" in matched_key:
            flags.append(f"key_type:{matched_key['data_type']}")

        results.append(DetectedColumn(
            header=str(col_name),
            detected_type=detected_type,
            sample_values=sample,
            flags=flags,
            suggested_key_id=suggested_key_id,
            suggested_key_name=suggested_key_name,
            match_confidence=confidence,
            decimal_places=decimal_places,
        ))

    return results


def _match_score(header: str, key_name: str, display_name: str) -> float:
    h_raw = header.strip().lower()
    kn_raw = key_name.strip().lower()
    dn_raw = display_name.strip().lower()

    if not h_raw:
        return 0.0

    # Exact match on name (preserving %, _, etc.)
    if h_raw == kn_raw:
        return 1.0
    # Exact match on display name
    if h_raw == dn_raw:
        return 0.95

    # Normalize: keep % and _ as meaningful characters
    def normalize(s: str) -> str:
        return re.sub(r"[^a-z0-9_%]", "", s)

    h = normalize(h_raw)
    kn = normalize(kn_raw)
    dn = normalize(dn_raw)

    if h == kn:
        return 0.9
    if h == dn:
        return 0.85

    # Short strings (either side < 4 chars) — exact only, no fuzzy
    if len(h) < 4 or len(kn) < 4:
        # Check if header matches the parenthetical abbreviation in display name
        # e.g., header "Fe" matching "Iron (Fe)" — extract the parens content
        paren_match = re.search(r"\(([^)]+)\)", dn_raw)
        if paren_match and normalize(paren_match.group(1)) == h:
            return 0.8
        return 0.0

    # Substring matching on longer strings — score by overlap ratio
    if h in kn or kn in h:
        overlap = min(len(h), len(kn)) / max(len(h), len(kn))
        return 0.5 + (overlap * 0.3)

    if h in dn or dn in h:
        overlap = min(len(h), len(dn)) / max(len(h), len(dn))
        return 0.4 + (overlap * 0.3)

    return 0.0


MATCH_THRESHOLD = 0.5


def parse_template_placeholders(html: str) -> list[str]:
    placeholders: list[str] = []
    seen: set[str] = set()

    def _add(name: str) -> None:
        if name not in seen:
            seen.add(name)
            placeholders.append(name)

    for m in re.findall(r"\[([^\[\]]+)\]", html):
        _add(m)

    for m in re.findall(r"sample\.(\w+)", html):
        _add(f"sample.{m}")

    for m in re.findall(r"analytes\.(\w+)", html):
        _add(f"analytes.{m}")

    return placeholders


def match_placeholders_to_keys(
    placeholders: list[str],
    existing_keys: list[dict],
) -> list[dict]:
    key_lookup = {}
    for k in existing_keys:
        key_lookup[k["name"].lower()] = k
        key_lookup[k["display_name"].lower()] = k

    results = []
    for ph in placeholders:
        ph_lower = ph.strip().lower()
        suggested_key_id = None
        suggested_key_name = None
        confidence = "unmapped"

        if ph_lower in key_lookup:
            k = key_lookup[ph_lower]
            suggested_key_id = k["id"]
            suggested_key_name = k["name"]
            confidence = "auto"
        else:
            best_score = 0.0
            best_key = None
            for k in existing_keys:
                score = _match_score(ph_lower, k["name"], k["display_name"])
                if score > best_score:
                    best_score = score
                    best_key = k
            if best_key and best_score >= MATCH_THRESHOLD:
                suggested_key_id = best_key["id"]
                suggested_key_name = best_key["name"]
                confidence = "auto" if best_score >= 0.9 else "suggested"

        results.append({
            "placeholder_text": ph,
            "suggested_key_id": suggested_key_id,
            "suggested_key_name": suggested_key_name,
            "match_confidence": confidence,
        })

    return results
