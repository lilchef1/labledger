from app.services.config_loader import DisciplineConfig


def _parse_value(value):
    if value is None or (isinstance(value, float) and value != value):
        return None
    s = str(value).strip()
    if s.startswith("<") or s.startswith(">"):
        try:
            return float(s[1:])
        except ValueError:
            return None
    try:
        return float(s)
    except ValueError:
        return None


def rate_value(value, breakpoints: list[float]) -> int | None:
    """Return the bucket index for a value given sorted breakpoints.

    Bucket 0: value < breakpoints[0]
    Bucket i: breakpoints[i-1] < value <= breakpoints[i]
    Last bucket: value > breakpoints[-1]
    """
    num = _parse_value(value)
    if num is None:
        return None
    if not breakpoints:
        return None
    if num < breakpoints[0]:
        return 0
    for i in range(len(breakpoints) - 1):
        if num <= breakpoints[i + 1]:
            return i + 1
    return len(breakpoints)


def get_rating_index(config: DisciplineConfig, analyte_key: str, value) -> int | None:
    analyte = config.analytes.get(analyte_key)
    if analyte is None:
        return None
    breakpoints = [
        b.upper_breakpoint for b in analyte.rating_buckets
        if b.upper_breakpoint is not None
    ]
    return rate_value(value, breakpoints)


def get_rating_labels(config: DisciplineConfig, analyte_key: str) -> list[tuple[str, str]]:
    analyte = config.analytes.get(analyte_key)
    if analyte is None:
        return []
    return [(b.label, b.range_text) for b in analyte.rating_buckets]


def get_recommendation(config: DisciplineConfig, analyte_key: str, value) -> str:
    analyte = config.analytes.get(analyte_key)
    if analyte is None or not analyte.has_recommendation:
        return ""

    if value is None or (isinstance(value, float) and value != value):
        return ""

    value_str = str(value).strip()
    is_below_detect = value_str.startswith("<")

    num = _parse_value(value)
    if num is None and not is_below_detect:
        return ""

    threshold = analyte.recommendation_threshold
    if threshold is None:
        return ""

    v = num if num is not None else 0
    op = analyte.recommendation_operator

    needs = is_below_detect
    if not needs:
        if op == "le":
            needs = v <= threshold
        elif op == "lt":
            needs = v < threshold
        elif op == "ge":
            needs = v >= threshold
        elif op == "gt":
            needs = v > threshold

    return "Needs Recs" if needs else "0"


def check_triggers(config: DisciplineConfig, sample: dict) -> dict[str, bool]:
    results = {}
    for trigger in config.triggers:
        val = _parse_value(sample.get(trigger.field))
        if val is None:
            results[trigger.action] = False
            continue
        op = trigger.operator
        if op == "lt":
            results[trigger.action] = val < trigger.threshold
        elif op == "le":
            results[trigger.action] = val <= trigger.threshold
        elif op == "gt":
            results[trigger.action] = val > trigger.threshold
        elif op == "ge":
            results[trigger.action] = val >= trigger.threshold
        elif op == "eq":
            results[trigger.action] = val == trigger.threshold
        else:
            results[trigger.action] = False
    return results
