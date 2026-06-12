"""
Generic computation engine for config-driven data transformations.

Computation types are defined in the database via ComputedRecommendation records.
Each record has a computation_type string and a params_json dict that fully
describes the operation. No deployment-specific logic lives here.

Supported computation types:
  - sum_fields: Sum numeric values from listed sample fields
  - formula: Evaluate an arithmetic expression with field references
  - unit_conversion: Multiply a field value by a factor with optional
    depth normalization and conditional branch logic
  - threshold_check: Compare a field value against a threshold and
    return a label
  - lookup_matrix: Two-dimensional matrix lookup (row key x column key)
"""

import operator
import re

OPERATORS = {
    "lt": operator.lt,
    "le": operator.le,
    "gt": operator.gt,
    "ge": operator.ge,
    "eq": operator.eq,
    "ne": operator.ne,
}


def _safe_float(value) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _resolve_field(sample: dict, field_ref: str):
    """Resolve a field reference from the sample, or return a literal number."""
    if field_ref in sample:
        return _safe_float(sample[field_ref])
    return _safe_float(field_ref)


def _match_condition(sample: dict, condition: dict) -> bool:
    """Evaluate a single condition against sample data.

    condition keys:
      field: sample field to check
      operator: comparison operator string (lt, le, gt, ge, eq, ne)
      value: threshold value
      pattern: regex pattern to match (alternative to operator/value)
    """
    field_val = sample.get(condition["field"], "")

    if "pattern" in condition:
        return bool(re.search(condition["pattern"], str(field_val), re.IGNORECASE))

    op_func = OPERATORS.get(condition.get("operator", "eq"))
    if op_func is None:
        return False

    numeric_val = _safe_float(field_val)
    threshold = _safe_float(condition.get("value"))
    if numeric_val is None or threshold is None:
        return False
    return op_func(numeric_val, threshold)


def _evaluate_branches(sample: dict, branches: list[dict], default=None):
    """Evaluate a list of conditional branches, return the first match.

    Each branch: {"conditions": [...], "result": <value or expression>}
    Conditions within a branch are AND-ed.
    """
    for branch in branches:
        conditions = branch.get("conditions", [])
        if all(_match_condition(sample, c) for c in conditions):
            return branch.get("result", default)
    return default


# --- Computation type handlers ---


def compute_sum_fields(sample: dict, params: dict) -> dict:
    """Sum numeric values from a list of sample fields.

    params:
      fields: list of field keys to sum
      output_key: key name for the result (default: "total")
      format: "integer" | "decimal" (default: "decimal")
    """
    fields = params.get("fields", [])
    values = []
    for key in fields:
        val = _safe_float(sample.get(key))
        if val is not None:
            values.append(val)

    if not values:
        return {"value": "", "recommendation": ""}

    total = sum(values)
    fmt = params.get("format", "decimal")
    if fmt == "integer" or total == int(total):
        display = str(int(total))
    else:
        display = str(total)

    return {"value": display, "recommendation": ""}


def compute_formula(sample: dict, params: dict) -> dict:
    """Evaluate an arithmetic expression with field references.

    params:
      expression: string like "{Nitrate} * 2 * ({Soil Depth} / 6)"
      output_unit: unit label for the result
      min_value: floor the result at this value (default: no floor)
      decimal_places: round to N places (default: 2)
      branches: optional conditional overrides evaluated before the formula
    """
    expression = params.get("expression", "")
    min_value = params.get("min_value")
    decimal_places = params.get("decimal_places", 2)
    output_unit = params.get("output_unit", "")

    if "branches" in params:
        branch_result = _evaluate_branches(sample, params["branches"])
        if branch_result is not None:
            return {"value": branch_result, "unit": output_unit, "recommendation": ""}

    def replace_field(match):
        field_name = match.group(1)
        val = _safe_float(sample.get(field_name))
        if val is None:
            return "None"
        return str(val)

    resolved = re.sub(r"\{([^}]+)\}", replace_field, expression)

    if "None" in resolved:
        return {"value": "", "unit": output_unit, "recommendation": ""}

    try:
        result = eval(resolved, {"__builtins__": {}}, {"max": max, "min": min, "abs": abs})
    except Exception:
        return {"value": "", "unit": output_unit, "recommendation": ""}

    if min_value is not None:
        result = max(result, min_value)

    result = round(result, decimal_places)
    if result == int(result):
        display = str(int(result))
    else:
        display = str(result)

    return {"value": display, "unit": output_unit, "recommendation": ""}


def compute_unit_conversion(sample: dict, params: dict) -> dict:
    """Convert a field value with optional conditional branching.

    params:
      input_field: field key to convert
      factor: multiplication factor
      normalize_by: optional field for normalization (e.g. depth)
      normalize_default: default value if normalize field is missing
      output_unit: unit label for the result
      min_value: floor (default: 0)
      branches: list of conditional branches for the recommendation value
    """
    input_field = params.get("input_field", "")
    factor = params.get("factor", 1)
    output_unit = params.get("output_unit", "")
    min_value = params.get("min_value", 0)

    input_val = _safe_float(sample.get(input_field))
    if input_val is None:
        return {"value": "", "unit_conv": "", "unit": output_unit, "recommendation": ""}

    result = input_val * factor

    normalize_by = params.get("normalize_by")
    if normalize_by:
        norm_default = params.get("normalize_default", 1)
        norm_val = _safe_float(sample.get(normalize_by)) or norm_default
        result = result * (norm_val / norm_default)

    if min_value is not None:
        result = max(result, min_value)

    result = round(result, 2)
    display = str(int(result)) if result == int(result) else str(result)

    recommendation = ""
    if "branches" in params:
        branch_result = _evaluate_branches(sample, params["branches"])
        if branch_result is not None:
            recommendation = branch_result

    return {
        "value": display,
        "unit_conv": display,
        "unit": output_unit,
        "recommendation": recommendation,
    }


def compute_threshold_check(sample: dict, params: dict) -> dict:
    """Compare a field value against threshold(s) and return a label.

    params:
      input_field: field key to check
      thresholds: list of {"value": N, "operator": "le", "label": "Low"}
                  evaluated in order, first match wins
      default_label: label if no threshold matches
    """
    input_field = params.get("input_field", "")
    thresholds = params.get("thresholds", [])
    default_label = params.get("default_label", "")

    input_val = _safe_float(sample.get(input_field))
    if input_val is None:
        return {"value": "", "recommendation": ""}

    for t in thresholds:
        op_func = OPERATORS.get(t.get("operator", "le"))
        threshold_val = _safe_float(t.get("value"))
        if op_func and threshold_val is not None and op_func(input_val, threshold_val):
            return {"value": t.get("label", ""), "recommendation": t.get("label", "")}

    return {"value": default_label, "recommendation": default_label}


def compute_lookup_matrix(sample: dict, params: dict) -> dict:
    """Two-dimensional matrix lookup.

    params:
      row_field: field key for row selection
      col_field: field key for column selection
      row_thresholds: list of {"value": N, "label": "key"} (ascending)
      col_thresholds: list of {"value": N, "label": "key"} (ascending)
      matrix: dict of {row_label: {col_label: result_value}}
      default: fallback value
    """
    row_field = params.get("row_field", "")
    col_field = params.get("col_field", "")
    row_thresholds = params.get("row_thresholds", [])
    col_thresholds = params.get("col_thresholds", [])
    matrix = params.get("matrix", {})
    default = params.get("default", "")

    row_val = _safe_float(sample.get(row_field))
    col_val = _safe_float(sample.get(col_field))

    if row_val is None or col_val is None:
        return {"value": default, "recommendation": ""}

    row_label = None
    for t in row_thresholds:
        if row_val <= t["value"]:
            row_label = t["label"]
            break
    if row_label is None and row_thresholds:
        row_label = row_thresholds[-1]["label"]

    col_label = None
    for t in col_thresholds:
        if col_val <= t["value"]:
            col_label = t["label"]
            break
    if col_label is None and col_thresholds:
        col_label = col_thresholds[-1]["label"]

    if row_label and col_label:
        result = matrix.get(row_label, {}).get(col_label, default)
    else:
        result = default

    return {"value": result, "recommendation": result}


COMPUTATION_REGISTRY: dict[str, callable] = {
    "sum_fields": compute_sum_fields,
    "formula": compute_formula,
    "unit_conversion": compute_unit_conversion,
    "threshold_check": compute_threshold_check,
    "lookup_matrix": compute_lookup_matrix,
}
