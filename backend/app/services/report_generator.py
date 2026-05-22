import tempfile
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, BaseLoader

from app.services.config_loader import DisciplineConfig
from app.services.computations import COMPUTATION_REGISTRY
from app.services.ratings import get_rating_index, get_rating_labels, get_recommendation, check_triggers
from app.services.spreadsheet_parser import (
    build_address_line2,
    determine_crop_hort,
    determine_template_sections,
    format_date,
    format_value,
    parse_spreadsheet,
)

TEMPLATE_DIR = Path(__file__).parent.parent / "templates"
STATIC_DIR = Path(__file__).parent.parent / "static"


class AnalyteData:
    def __init__(self, key, value, config: DisciplineConfig, crop_hort_info=None):
        analyte_cfg = config.analytes.get(key)
        self.key = key
        self.display = format_value(value)
        self.labels = get_rating_labels(config, key)
        self.active_index = get_rating_index(config, key, value)
        self.color = analyte_cfg.color if analyte_cfg else "#FFC000"
        self.recommendation = get_recommendation(config, key, value)
        self.unit_conv = ""
        self.unit_label = ""
        self.rec_unit = "lb/1000 sq.ft."

        if crop_hort_info and crop_hort_info.get("is_crop"):
            self.rec_unit = "lb/ac"


def _build_analyte(key, sample_dict, config, crop_hort_info=None):
    return AnalyteData(key, sample_dict.get(key), config, crop_hort_info)


def _build_optional_section_data(sample, sections, config):
    result = {}
    blocks = config.custom_blocks

    if "sar_paste" in sections:
        fields = blocks.get("sar_paste", [])
        result["sar_paste_data"] = [
            {
                "name": f["name"],
                "unit": f.get("unit", ""),
                "value": format_value(sample.get(f["key"])),
                "optimum": f.get("optimum", ""),
            }
            for f in fields
        ]

    if "carbon_nitrogen" in sections:
        fields = blocks.get("carbon_nitrogen", [])
        cn_data = []
        tc = sample.get("TC")
        tn = sample.get("TN")

        for f in fields:
            if f["key"] == "_cn_ratio":
                cn_ratio = ""
                if tc is not None and tn is not None and tn != 0:
                    try:
                        cn_ratio = format_value(float(tc) / float(tn))
                    except (ValueError, TypeError):
                        pass
                cn_data.append({"name": f["name"], "unit": f.get("unit", ""), "value": cn_ratio})
            else:
                cn_data.append({
                    "name": f["name"],
                    "unit": f.get("unit", ""),
                    "value": format_value(sample.get(f["key"])),
                })
        result["cn_data"] = cn_data

    if "paw" in sections:
        fields = blocks.get("paw", [])
        result["paw_data"] = [
            {"name": f["name"], "unit": f.get("unit", ""), "value": format_value(sample.get(f["key"]))}
            for f in fields
        ]

    if "wsa" in sections:
        fields = blocks.get("wsa", [])
        result["wsa_data"] = [
            {"name": f["name"], "unit": f.get("unit", ""), "value": format_value(sample.get(f["key"]))}
            for f in fields
        ]

    if "mineralization" in sections:
        fields = blocks.get("mineralization", [])
        result["mineralization_data"] = [
            {"name": f["name"], "unit": f.get("unit", ""), "value": format_value(sample.get(f["key"]))}
            for f in fields
        ]

    return result


def _determine_sar_value(sample, request_code, config):
    code = (request_code or "").upper()
    if "S3" in code:
        return format_value(sample.get("Paste_SAR"))
    if "S12" in code:
        return format_value(sample.get("SAR"))
    return ""


def prepare_report_context(sample: dict, config: DisciplineConfig) -> dict:
    crop_hort_info = determine_crop_hort(sample)
    request_code = sample.get("Request", "")
    sections = determine_template_sections(request_code, config)

    analytes = {}
    for key in config.analytes:
        analytes[key] = _build_analyte(key, sample, config, crop_hort_info)

    for comp in config.computed_recommendations:
        func = COMPUTATION_REGISTRY.get(comp.computation_type)
        if func is None:
            continue
        if comp.analyte_key in analytes:
            result = func(sample, comp.params)
            if isinstance(result, dict):
                a = analytes[comp.analyte_key]
                a.unit_conv = format_value(result.get("unit_conv", ""))
                a.unit_label = result.get("unit", "")
                if result.get("recommendation", "") != "":
                    a.recommendation = str(result["recommendation"])

    trigger_results = check_triggers(config, sample)

    heavy_metals_block = config.custom_blocks.get("heavy_metals", [])
    heavy_metals = [
        {"name": f["name"], "value": format_value(sample.get(f["key"]))}
        for f in heavy_metals_block
    ]

    base_sat_total = ""
    for comp in config.computed_recommendations:
        if comp.computation_type == "base_saturation_sum":
            func = COMPUTATION_REGISTRY.get(comp.computation_type)
            if func:
                base_sat_total = func(sample, comp.params)
            break

    user_comments = sample.pop("_user_comments", "") or ""
    user_recs = sample.pop("_user_recommendations", {}) or {}

    for key in list(analytes.keys()):
        if key in user_recs and user_recs[key].get("value"):
            analytes[key].recommendation = str(user_recs[key]["value"])
        if key in user_recs and user_recs[key].get("unit"):
            analytes[key].rec_unit = user_recs[key]["unit"]

    context = {
        "static_path": str(STATIC_DIR.resolve()),
        "lab": config.lab_info,
        "sample": {
            "lab_id": sample.get("Lab ID"),
            "sample_id": sample.get("Sample ID") or "",
            "customer_name": sample.get("Customer Name"),
            "company_name": sample.get("Company Name") or "",
            "address": sample.get("Address"),
            "address_line2": build_address_line2(sample),
            "date_received": format_date(sample.get("Recieved")),
            "date_reported": format_date(sample.get("Reported")),
            "soil_depth": format_value(sample.get("Soil Depth")),
            "lime": format_value(sample.get("Lime")),
            "na": format_value(sample.get("Na")),
            "cl": format_value(sample.get("Cl")),
            "sand": format_value(sample.get("Sand")),
            "silt": format_value(sample.get("Silt")),
            "clay": format_value(sample.get("Clay")),
            "texture_class": sample.get("Texture Class") or "",
            "heavy_metals": heavy_metals,
            "sar": _determine_sar_value(sample, request_code, config),
            "show_woodruff": trigger_results.get("show_woodruff", False),
            "woodruff_buffer": format_value(sample.get("Woodruff Buffer")),
            "h_pct": format_value(sample.get("H%")),
            "k_pct": format_value(sample.get("K%")),
            "ca_pct": format_value(sample.get("Ca%")),
            "mg_pct": format_value(sample.get("Mg%")),
            "na_pct": format_value(sample.get("Na%")),
            "base_sat_total": base_sat_total,
            "comments": user_comments,
        },
        "analytes": analytes,
        "sections": sections,
    }

    optional_data = _build_optional_section_data(sample, sections, config)
    context.update(optional_data)

    return context


def generate_report_pdf(sample: dict, config: DisciplineConfig, output_path: str | Path) -> Path:
    context = prepare_report_context(sample, config)

    if config.template_html:
        from jinja2 import DictLoader
        loader = DictLoader({"report.html": config.template_html})
        macro_loader = FileSystemLoader(str(TEMPLATE_DIR))
        from jinja2 import ChoiceLoader
        env = Environment(loader=ChoiceLoader([loader, macro_loader]))
        template = env.get_template("report.html")
    else:
        env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))
        template = env.get_template("soil_report.html")

    html_content = template.render(**context)

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    from weasyprint import HTML
    html_doc = HTML(
        string=html_content,
        base_url=str(STATIC_DIR.resolve()),
    )
    html_doc.write_pdf(str(output_path))
    return output_path


def generate_reports_from_spreadsheet(
    spreadsheet_path: str | Path,
    output_dir: str | Path,
    config: DisciplineConfig,
) -> list[dict]:
    samples = parse_spreadsheet(spreadsheet_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    results = []
    for sample in samples:
        lab_id = sample.get("Lab ID", "unknown")
        pattern = config.report_filename_pattern
        filename = pattern.format(lab_id=lab_id)
        output_path = output_dir / filename

        try:
            generate_report_pdf(sample, config, output_path)
            results.append({
                "lab_id": lab_id,
                "output_path": str(output_path),
                "status": "success",
            })
        except Exception as e:
            results.append({
                "lab_id": lab_id,
                "output_path": "",
                "status": f"error: {e}",
            })

    return results
