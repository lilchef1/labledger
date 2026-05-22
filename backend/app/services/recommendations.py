import re

from app.services.config_loader import DisciplineConfig
from app.services.ratings import get_recommendation
from app.services.computations import COMPUTATION_REGISTRY


def compute_all_recommendations(sample: dict, config: DisciplineConfig) -> dict:
    crop_hort = sample.get("Crop/Hort") or ""
    is_crop = bool(re.search(r"crop", crop_hort, re.IGNORECASE))
    rec_unit = "lb/ac" if is_crop else "lb/1000 sq.ft."

    recommendations = {}

    for key, analyte in config.analytes.items():
        if not analyte.has_recommendation:
            continue
        value = sample.get(key)
        needs = get_recommendation(config, key, value)
        recommendations[key] = {
            "needs_recs": needs == "Needs Recs",
            "value": "",
            "unit": rec_unit,
        }

    for comp in config.computed_recommendations:
        func = COMPUTATION_REGISTRY.get(comp.computation_type)
        if func is None:
            continue
        result = func(sample, comp.params)
        if isinstance(result, dict):
            recommendations[comp.analyte_key] = {
                "needs_recs": result.get("recommendation") == "Needs Recs",
                "value": result.get("recommendation", ""),
                "unit_conv": result.get("unit_conv", ""),
                "unit": result.get("unit", rec_unit),
            }

    return recommendations
