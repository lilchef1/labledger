"""Generate soil report PDFs from parsed spreadsheet data."""

import tempfile
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

from app.services.soil_ratings import (
    get_rating_index,
    get_rating_labels,
    get_recommendation,
    needs_woodruff,
)
from app.services.spreadsheet_parser import (
    build_address_line2,
    determine_crop_hort,
    determine_template_sections,
    format_date,
    format_value,
    parse_soil_spreadsheet,
)

TEMPLATE_DIR = Path(__file__).parent.parent / "templates"
STATIC_DIR = Path(__file__).parent.parent / "static"

env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))


class AnalyteData:
    """Prepared data for one analyte row in the report."""

    def __init__(self, key, value, crop_hort_info=None):
        self.key = key
        self.display = format_value(value)
        self.labels = get_rating_labels(key)
        self.active_index = get_rating_index(key, value)

        self.recommendation = get_recommendation(key, value)
        self.unit_conv = ""
        self.unit_label = ""
        self.rec_unit = "lb/1000 sq.ft."

        if crop_hort_info and crop_hort_info.get("is_crop"):
            self.rec_unit = "lb/ac"


def _build_analyte(key, sample_dict, crop_hort_info=None):
    return AnalyteData(key, sample_dict.get(key), crop_hort_info)


def _build_optional_section_data(sample, sections):
    """Build data dicts for optional report sections."""
    result = {}

    if "sar_paste" in sections:
        result["sar_paste_data"] = [
            {"name": "Saturation", "unit": "%", "value": format_value(sample.get("Paste_Saturation")), "optimum": ""},
            {"name": "Paste pH", "unit": "", "value": format_value(sample.get("Paste_pH")), "optimum": ""},
            {"name": "Electric Conductivity (EC)", "unit": "mmho/cm", "value": format_value(sample.get("Paste_EC")), "optimum": ""},
            {"name": "Bicarbonate (HCO3)", "unit": "meq/L", "value": format_value(sample.get("Paste_Bicarbonate")), "optimum": "3-10"},
            {"name": "Chloride (Cl)", "unit": "meq/L", "value": format_value(sample.get("Paste_Cl")), "optimum": "<10"},
            {"name": "Calcium (Ca)", "unit": "meq/L", "value": format_value(sample.get("Paste_Ca")), "optimum": "1-8"},
            {"name": "Magnesium (Mg)", "unit": "meq/L", "value": format_value(sample.get("Paste_Mg")), "optimum": "0.3-4.6"},
            {"name": "Sodium (Na)", "unit": "meq/L", "value": format_value(sample.get("Paste_Na")), "optimum": "0.2-1"},
            {"name": "Potassium (K)", "unit": "meq/L", "value": format_value(sample.get("Paste_K")), "optimum": "1-3"},
            {"name": "Sulfur (SO4)", "unit": "meq/L", "value": format_value(sample.get("Paste_SO4")), "optimum": "5-10"},
        ]

    if "carbon_nitrogen" in sections:
        tc = sample.get("TC")
        tn = sample.get("TN")
        cn_ratio = ""
        if tc is not None and tn is not None and tn != 0:
            try:
                cn_ratio = format_value(float(tc) / float(tn))
            except (ValueError, TypeError):
                pass

        result["cn_data"] = [
            {"name": "Total Carbon (C)", "unit": "%", "value": format_value(tc)},
            {"name": "Total Organic Carbon (TOC)", "unit": "%", "value": format_value(sample.get("TOC"))},
            {"name": "Total Inorganic Carbon (TIC)", "unit": "%", "value": format_value(sample.get("TIC"))},
            {"name": "Total Nitrogen (N)", "unit": "%", "value": format_value(tn)},
            {"name": "C:N Ratio", "unit": "", "value": cn_ratio},
            {"name": "Soil Respiration", "unit": "", "value": format_value(sample.get("Soil_Respiration"))},
            {"name": "POX-C", "unit": "", "value": format_value(sample.get("POX_C"))},
        ]

    if "paw" in sections:
        result["paw_data"] = [
            {"name": "Field Capacity", "unit": "%", "value": format_value(sample.get("FC"))},
            {"name": "Wilting Point", "unit": "%", "value": format_value(sample.get("WP"))},
            {"name": "Plant Available Water", "unit": "%", "value": format_value(sample.get("PAW"))},
        ]

    if "wsa" in sections:
        result["wsa_data"] = [
            {"name": ">2000", "unit": "%", "value": format_value(sample.get(">2000"))},
            {"name": "2000-500", "unit": "%", "value": format_value(sample.get("2000-500"))},
            {"name": "500-250", "unit": "%", "value": format_value(sample.get("500-250"))},
            {"name": "250-53", "unit": "%", "value": format_value(sample.get("250-53"))},
            {"name": "<53", "unit": "%", "value": format_value(sample.get("<53"))},
            {"name": "Total", "unit": "%", "value": format_value(sample.get("WSA"))},
        ]

    if "mineralization" in sections:
        result["mineralization_data"] = [
            {"name": "NO3-N", "unit": "ppm", "value": format_value(sample.get("NO3_Mineralization"))},
            {"name": "NH4-N", "unit": "ppm", "value": format_value(sample.get("NH4_Mineralization"))},
            {"name": "Total Mineralization", "unit": "ppm", "value": format_value(sample.get("Total_Mineralization"))},
        ]

    return result


def _compute_base_saturation_total(sample):
    pcts = []
    for key in ("K%", "Ca%", "Mg%", "Na%"):
        val = sample.get(key)
        if val is not None:
            try:
                pcts.append(float(val))
            except (ValueError, TypeError):
                pass
    return format_value(sum(pcts)) if pcts else ""


def _determine_sar_value(sample, request_code):
    """Determine which SAR value to use based on request codes."""
    code = (request_code or "").upper()
    has_s3 = "S3" in code
    has_s12 = "S12" in code

    if has_s3:
        return format_value(sample.get("Paste_SAR"))
    if has_s12:
        return format_value(sample.get("SAR"))
    return ""


def prepare_report_context(sample: dict) -> dict:
    """Transform a raw sample dict into the template context."""
    crop_hort_info = determine_crop_hort(sample)
    request_code = sample.get("Request", "")
    sections = determine_template_sections(request_code)

    rated_keys = ["pH", "EC", "OM", "Nitrate", "P", "K", "Ca", "Mg",
                  "CEC", "S", "Zn", "Fe", "Mn", "Cu", "B"]
    analytes = {}
    for key in rated_keys:
        analytes[key] = _build_analyte(key, sample, crop_hort_info)

    heavy_metals = [
        {"name": "Arsenic (As)", "value": format_value(sample.get("As"))},
        {"name": "Cadmium (Cd)", "value": format_value(sample.get("Cd"))},
        {"name": "Chromium (Cr)", "value": format_value(sample.get("Cr"))},
        {"name": "Lead (Pb)", "value": format_value(sample.get("Pb"))},
        {"name": "Molybdenum (Mo)", "value": format_value(sample.get("Mo"))},
        {"name": "Selenium (Se)", "value": format_value(sample.get("Se"))},
    ]

    context = {
        "static_path": str(STATIC_DIR.resolve()),
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
            "sar": _determine_sar_value(sample, request_code),
            "show_woodruff": needs_woodruff(sample.get("pH")),
            "woodruff_buffer": format_value(sample.get("Woodruff Buffer")),
            "h_pct": format_value(sample.get("H%")),
            "k_pct": format_value(sample.get("K%")),
            "ca_pct": format_value(sample.get("Ca%")),
            "mg_pct": format_value(sample.get("Mg%")),
            "na_pct": format_value(sample.get("Na%")),
            "base_sat_total": _compute_base_saturation_total(sample),
            "comments": "",
        },
        "analytes": analytes,
        "sections": sections,
    }

    optional_data = _build_optional_section_data(sample, sections)
    context.update(optional_data)

    return context


def generate_soil_report_pdf(sample: dict, output_path: str | Path) -> Path:
    """Generate a single soil report PDF."""
    context = prepare_report_context(sample)
    template = env.get_template("soil_report.html")
    html_content = template.render(**context)

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    html_doc = HTML(
        string=html_content,
        base_url=str(STATIC_DIR.resolve()),
    )
    html_doc.write_pdf(str(output_path))
    return output_path


def generate_soil_reports_from_spreadsheet(
    spreadsheet_path: str | Path,
    output_dir: str | Path,
) -> list[dict]:
    """Parse a spreadsheet and generate PDF reports for all samples.

    Returns a list of result dicts with lab_id, output_path, and status.
    """
    samples = parse_soil_spreadsheet(spreadsheet_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    results = []
    for sample in samples:
        lab_id = sample.get("Lab ID", "unknown")
        output_path = output_dir / f"Report - {lab_id}.pdf"

        try:
            generate_soil_report_pdf(sample, output_path)
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
