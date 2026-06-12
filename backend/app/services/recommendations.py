from app.services.config_loader import DisciplineConfig
from app.services.ratings import get_recommendation
from app.services.computations import COMPUTATION_REGISTRY


def compute_all_recommendations(sample: dict, config: DisciplineConfig) -> dict:
    recommendations = {}

    for key, analyte in config.analytes.items():
        if not analyte.has_recommendation:
            continue
        value = sample.get(key)
        needs = get_recommendation(config, key, value)
        recommendations[key] = {
            "needs_recs": needs == "Needs Recs",
            "value": "",
            "unit": analyte.unit or "",
        }

    for comp in config.computed_recommendations:
        func = COMPUTATION_REGISTRY.get(comp.computation_type)
        if func is None:
            continue
        result = func(sample, comp.params)
        if isinstance(result, dict):
            recommendations[comp.analyte_key] = {
                "needs_recs": result.get("recommendation") == "Needs Recs",
                "value": result.get("recommendation", result.get("value", "")),
                "unit_conv": result.get("unit_conv", result.get("value", "")),
                "unit": result.get("unit", analyte.unit if (analyte := config.analytes.get(comp.analyte_key)) else ""),
            }

    return recommendations
