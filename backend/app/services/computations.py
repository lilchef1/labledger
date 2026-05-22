import re


def compute_nitrate_recommendation(sample: dict, params: dict) -> dict:
    """Compute Nitrate-N unit conversion and recommendation.

    params keys: conversion_factor, default_depth, hort_targets
    """
    crop_hort = sample.get("Crop/Hort") or ""
    plant_type = sample.get("Plant Type") or ""
    nitrate = sample.get("Nitrate")
    soil_depth = sample.get("Soil Depth")

    conversion_factor = params.get("conversion_factor", 2)
    default_depth = params.get("default_depth", 6.0)
    hort_targets = params.get("hort_targets", {"lawn": 5, "vegetables": 3})

    is_crop = bool(re.search(r"crop", crop_hort, re.IGNORECASE))
    is_hort = bool(re.search(r"hort", crop_hort, re.IGNORECASE))
    unit = "lb/ac" if is_crop else "lb/1000 sq.ft."

    if nitrate is None:
        return {"unit_conv": "", "recommendation": "", "unit": unit}

    try:
        nitrate_val = float(nitrate)
    except (ValueError, TypeError):
        return {"unit_conv": "", "recommendation": "", "unit": unit}

    depth = default_depth
    if soil_depth is not None:
        try:
            depth = float(soil_depth)
        except (ValueError, TypeError):
            depth = default_depth

    lb_per_ac = nitrate_val * conversion_factor * (depth / default_depth)

    if is_crop:
        conv = max(0, lb_per_ac)
        conv_display = round(conv, 2) if conv != int(conv) else int(conv)
        return {
            "unit_conv": conv_display,
            "recommendation": "Needs Recs",
            "unit": "lb/ac",
        }

    conv = max(0, lb_per_ac * 1000 / 43560)
    conv_display = round(conv, 2) if conv != int(conv) else int(conv)

    if is_hort:
        rec = ""
        lawn_target = hort_targets.get("lawn", 5)
        veg_target = hort_targets.get("vegetables", 3)

        if re.search(r"Lawn|\bGrass\b|Turf", plant_type, re.IGNORECASE):
            rec = max(0, round(lawn_target - conv, 2))
        elif re.search(
            r"Trees|Flowers|Flower Beds|Vegetables|Vegetable Garden",
            plant_type, re.IGNORECASE,
        ):
            rec = max(0, round(veg_target - conv, 2))
        return {
            "unit_conv": conv_display,
            "recommendation": rec,
            "unit": "lb/1000 sq.ft.",
        }

    return {"unit_conv": conv_display, "recommendation": "", "unit": unit}


def compute_base_saturation_total(sample: dict, params: dict) -> str:
    """Sum base saturation percentage components."""
    components = params.get("components", ["K%", "Ca%", "Mg%", "Na%"])
    pcts = []
    for key in components:
        val = sample.get(key)
        if val is not None:
            try:
                pcts.append(float(val))
            except (ValueError, TypeError):
                pass
    if not pcts:
        return ""
    total = sum(pcts)
    if total == int(total):
        return str(int(total))
    return str(total)


COMPUTATION_REGISTRY: dict[str, callable] = {
    "nitrate_conversion": compute_nitrate_recommendation,
    "base_saturation_sum": compute_base_saturation_total,
}
