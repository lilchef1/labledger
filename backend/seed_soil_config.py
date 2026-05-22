"""Seed the database with the CSU Soil Testing Lab configuration.

Run once to initialize: python -m seed_soil_config
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.services.database import init_db, get_session
from app.models.config import (
    Organization, Discipline, Analyte, RatingBucket, RequestCode,
    SimpleField, CustomBlock, ComputedRecommendation, Trigger,
    ReportTemplate, LabInfo,
)


def seed():
    init_db()
    session = get_session()

    existing = session.query(Organization).first()
    if existing:
        print("Database already seeded. Delete labledger.db to re-seed.")
        session.close()
        return

    org = Organization(name="CSU Soil, Water, and Plant Testing Laboratory")
    session.add(org)
    session.flush()

    lab = LabInfo(
        org_id=org.id,
        name="Soil, Water, and Plant Testing Laboratory",
        address="4780 National Western Drive",
        city="Denver",
        state="CO",
        zip="80216",
        phone="(970) 491-5061",
        email="soiltestinglab@colostate.edu",
        logo_paths_json={
            "left": "csu_aes.png",
            "center": "csu_spur.png",
            "right": "image1.jpeg",
        },
    )
    session.add(lab)

    disc = Discipline(
        org_id=org.id,
        name="Soil",
        green_bar_title="Soil Analysis",
        spreadsheet_id_prefix="S",
        report_filename_pattern="Report - {lab_id}.pdf",
    )
    session.add(disc)
    session.flush()

    # --- Analytes with rating buckets ---
    # Breakpoint convention: bucket 0 = value < first breakpoint,
    # bucket i = value > breakpoints[i-1] AND value <= breakpoints[i],
    # last bucket = value > last breakpoint (upper_breakpoint = NULL)

    analyte_defs = [
        {
            "key": "pH", "display_name": "1:1 Soil pH", "unit": "", "color": "#FFC000",
            "sort_order": 0, "has_recommendation": False,
            "buckets": [
                ("Strongly Acid", "<5.4", 5.4),
                ("Moderately Acid", "5.4-5.7", 5.7),
                ("Slightly Acid", "5.8-6.4", 6.4),
                ("Neutral", "6.5-7.2", 7.2),
                ("Slightly Alkaline", "7.3-7.6", 7.6),
                ("Moderately Alkaline", "7.7-7.9", 7.9),
                ("Strongly Alkaline", ">7.9", None),
            ],
        },
        {
            "key": "EC", "display_name": "1:1 Soluble Salts (EC)", "unit": "mmho/cm",
            "color": "#92D050", "sort_order": 1, "has_recommendation": False,
            "buckets": [
                ("Very Low", "<0.2", 0.2),
                ("Low", "0.2-0.7", 0.7),
                ("Moderate", "0.8-1.2", 1.2),
                ("Moderately High", "1.3-2.5", 2.5),
                ("High", "2.6-5.0", 5.0),
                ("Very High", ">5.0", None),
            ],
        },
        {
            "key": "OM", "display_name": "Organic Matter LOI", "unit": "%",
            "color": "#9CC3E5", "sort_order": 2, "has_recommendation": False,
            "buckets": [
                ("Very Low", "<0.5", 0.5),
                ("Low", "0.5-1.5", 1.5),
                ("Medium", "1.6-3.0", 3.0),
                ("High", "3.1-5.0", 5.0),
                ("Very High", ">5.0", None),
            ],
        },
        {
            "key": "Nitrate", "display_name": "KCl Nitrate-N", "unit": "ppm",
            "color": "#7030A0", "sort_order": 3, "has_recommendation": False,
            "buckets": [
                ("Very Low", "<5", 5.0),
                ("Low", "5-10", 10.0),
                ("Medium", "11-25", 25.0),
                ("High", "26-50", 50.0),
                ("Very High", ">50", None),
            ],
        },
        {
            "key": "P", "display_name": "Phosphorus (P)", "unit": "ppm",
            "color": "#948A53", "sort_order": 4, "has_recommendation": True,
            "recommendation_threshold": 11, "recommendation_operator": "le",
            "section_name": "Olsen Bicarbonate",
            "buckets": [
                ("Very Low", "0-3", 3.0),
                ("Low", "4-6", 6.0),
                ("Medium", "7-10", 10.0),
                ("Optimum", "11-15", 15.0),
                ("High", "16-20", 20.0),
                ("Very High", ">20", None),
            ],
        },
        {
            "key": "K", "display_name": "Potassium (K)", "unit": "ppm",
            "color": "#B04F0F", "sort_order": 5, "has_recommendation": True,
            "recommendation_threshold": 161, "recommendation_operator": "le",
            "buckets": [
                ("Very Low", "<60", 60.0),
                ("Low", "60-120", 120.0),
                ("Medium", "121-160", 160.0),
                ("Optimum", "161-220", 220.0),
                ("High", "221-280", 280.0),
                ("Very High", ">280", None),
            ],
        },
        {
            "key": "Ca", "display_name": "Calcium (Ca)", "unit": "ppm",
            "color": "#305496", "sort_order": 6, "has_recommendation": True,
            "recommendation_threshold": 301, "recommendation_operator": "le",
            "buckets": [
                ("Very Low", "<100", 100.0),
                ("Low", "100-200", 200.0),
                ("Medium", "201-300", 300.0),
                ("Optimum", "301-2500", 2500.0),
                ("High", ">2500", 5000.0),
                ("Very High", ">5000", None),
            ],
        },
        {
            "key": "Mg", "display_name": "Magnesium (Mg)", "unit": "ppm",
            "color": "#C9C9C9", "sort_order": 7, "has_recommendation": True,
            "recommendation_threshold": 75, "recommendation_operator": "le",
            "buckets": [
                ("Very Low", "<25", 25.0),
                ("Low", "25-50", 50.0),
                ("Medium", "51-75", 75.0),
                ("Optimum", "75-100", 100.0),
                ("High", "100-200", 200.0),
                ("Very High", ">200", None),
            ],
        },
        {
            "key": "CEC", "display_name": "Cation Exchange Capacity (CEC)",
            "unit": "meq/100g", "color": "#2FF5C7", "sort_order": 8,
            "has_recommendation": False,
            "buckets": [
                ("Sand", "3-10", 10.0),
                ("Loam", "10-15", 15.0),
                ("Silt Loams", "15-25", 25.0),
                ("Clay & Clay Loam", "25-50", 50.0),
                ("Organic Soils", "50-100", None),
            ],
        },
        {
            "key": "S", "display_name": "Sulfate-S", "unit": "ppm",
            "color": "#336600", "sort_order": 9, "has_recommendation": True,
            "recommendation_threshold": 10, "recommendation_operator": "le",
            "buckets": [
                ("Very Low", "<2", 2.0),
                ("Low", "2-5", 5.0),
                ("Medium", "6-10", 10.0),
                ("Optimum", "11-15", 15.0),
                ("High", ">15", None),
            ],
        },
        {
            "key": "Zn", "display_name": "Zinc (Zn)", "unit": "ppm",
            "color": "#FF00FF", "sort_order": 10, "has_recommendation": True,
            "recommendation_threshold": 0.9, "recommendation_operator": "le",
            "buckets": [
                ("Very Low", "<0.3", 0.3),
                ("Low", "0.3-0.5", 0.5),
                ("Medium", "0.6-0.8", 0.8),
                ("Optimum", "0.9-1.2", 1.2),
                ("High", "1.3-2.0", 2.0),
                ("Very High", ">2.0", None),
            ],
        },
        {
            "key": "Fe", "display_name": "Iron (Fe)", "unit": "ppm",
            "color": "#0033CC", "sort_order": 11, "has_recommendation": True,
            "recommendation_threshold": 5.1, "recommendation_operator": "le",
            "buckets": [
                ("Very Low", "<1.0", 1.0),
                ("Low", "1.0-2.5", 2.5),
                ("Medium", "2.6-5.0", 5.0),
                ("Optimum", "5.1-15.0", 15.0),
                ("High", "15.1-30", 30.0),
                ("Very High", ">30", None),
            ],
        },
        {
            "key": "Mn", "display_name": "Manganese (Mn)", "unit": "ppm",
            "color": "#FFFF00", "sort_order": 12, "has_recommendation": True,
            "recommendation_threshold": 3.1, "recommendation_operator": "le",
            "buckets": [
                ("Very Low", "<0.5", 0.5),
                ("Low", "0.5-1.0", 1.0),
                ("Medium", "1.1-3.0", 3.0),
                ("Optimum", "3.1-6.0", 6.0),
                ("High", "6.1-10.0", 10.0),
                ("Very High", ">10", None),
            ],
        },
        {
            "key": "Cu", "display_name": "Copper (Cu)", "unit": "ppm",
            "color": "#00B050", "sort_order": 13, "has_recommendation": True,
            "recommendation_threshold": 0.449, "recommendation_operator": "lt",
            "buckets": [
                ("Very Low", "<0.1", 0.1),
                ("Low", "0.1-0.2", 0.2),
                ("Medium", "0.3-0.4", 0.4),
                ("Optimum", "0.5-0.8", 0.8),
                ("High", "0.9-1.5", 1.5),
                ("Very High", ">1.5", None),
            ],
        },
        {
            "key": "B", "display_name": "Boron (B)", "unit": "ppm",
            "color": "#A6A6A6", "sort_order": 14, "has_recommendation": False,
            "buckets": [
                ("Very Low", "<0.2", 0.2),
                ("Low", "0.2-0.5", 0.5),
                ("Medium", "0.6-0.8", 0.8),
                ("Optimum", "0.9-1.5", 1.5),
                ("High", "1.6-2.5", 2.5),
                ("Very High", ">2.5", None),
            ],
        },
    ]

    for adef in analyte_defs:
        analyte = Analyte(
            discipline_id=disc.id,
            key=adef["key"],
            display_name=adef["display_name"],
            unit=adef.get("unit", ""),
            color=adef["color"],
            sort_order=adef["sort_order"],
            has_recommendation=adef.get("has_recommendation", False),
            recommendation_threshold=adef.get("recommendation_threshold"),
            recommendation_operator=adef.get("recommendation_operator", "le"),
            section_name=adef.get("section_name"),
        )
        session.add(analyte)
        session.flush()

        for i, (label, range_text, upper_bp) in enumerate(adef["buckets"]):
            bucket = RatingBucket(
                analyte_id=analyte.id,
                sort_order=i,
                label=label,
                range_text=range_text,
                upper_breakpoint=upper_bp,
            )
            session.add(bucket)

    # --- Request codes ---
    request_code_map = {
        "S3": "sar_paste",
        "S14": "carbon_nitrogen",
        "S15": "carbon_nitrogen",
        "S17": "carbon_nitrogen",
        "S18": "carbon_nitrogen",
        "S19": "mineralization",
        "S20": "wsa",
        "S21": "paw",
    }
    for code, section in request_code_map.items():
        session.add(RequestCode(discipline_id=disc.id, code=code, section_key=section))

    # --- Simple fields ---
    simple_fields = [
        ("Lime", "Excess Lime", "", 0),
        ("Na", "Sodium (Na)", "ppm", 1),
        ("Cl", "Chloride (Cl)", "ppm", 2),
    ]
    for key, name, unit, order in simple_fields:
        session.add(SimpleField(
            discipline_id=disc.id, key=key, display_name=name,
            unit=unit, sort_order=order,
        ))

    # --- Custom blocks ---
    session.add(CustomBlock(
        discipline_id=disc.id, block_key="heavy_metals",
        fields_json=[
            {"key": "As", "name": "Arsenic (As)", "unit": "ppm"},
            {"key": "Cd", "name": "Cadmium (Cd)", "unit": "ppm"},
            {"key": "Cr", "name": "Chromium (Cr)", "unit": "ppm"},
            {"key": "Pb", "name": "Lead (Pb)", "unit": "ppm"},
            {"key": "Mo", "name": "Molybdenum (Mo)", "unit": "ppm"},
            {"key": "Se", "name": "Selenium (Se)", "unit": "ppm"},
        ],
    ))

    session.add(CustomBlock(
        discipline_id=disc.id, block_key="soil_texture",
        fields_json=[
            {"key": "Sand", "name": "% Sand", "unit": "%"},
            {"key": "Silt", "name": "% Silt", "unit": "%"},
            {"key": "Clay", "name": "% Clay", "unit": "%"},
            {"key": "Texture Class", "name": "Texture by Hydrometer", "unit": ""},
        ],
    ))

    session.add(CustomBlock(
        discipline_id=disc.id, block_key="sar_paste",
        fields_json=[
            {"key": "Paste_Saturation", "name": "Saturation", "unit": "%", "optimum": ""},
            {"key": "Paste_pH", "name": "Paste pH", "unit": "", "optimum": ""},
            {"key": "Paste_EC", "name": "Electric Conductivity (EC)", "unit": "mmho/cm", "optimum": ""},
            {"key": "Paste_Bicarbonate", "name": "Bicarbonate (HCO3)", "unit": "meq/L", "optimum": "3-10"},
            {"key": "Paste_Cl", "name": "Chloride (Cl)", "unit": "meq/L", "optimum": "<10"},
            {"key": "Paste_Ca", "name": "Calcium (Ca)", "unit": "meq/L", "optimum": "1-8"},
            {"key": "Paste_Mg", "name": "Magnesium (Mg)", "unit": "meq/L", "optimum": "0.3-4.6"},
            {"key": "Paste_Na", "name": "Sodium (Na)", "unit": "meq/L", "optimum": "0.2-1"},
            {"key": "Paste_K", "name": "Potassium (K)", "unit": "meq/L", "optimum": "1-3"},
            {"key": "Paste_SO4", "name": "Sulfur (SO4)", "unit": "meq/L", "optimum": "5-10"},
        ],
    ))

    session.add(CustomBlock(
        discipline_id=disc.id, block_key="carbon_nitrogen",
        fields_json=[
            {"key": "TC", "name": "Total Carbon (C)", "unit": "%"},
            {"key": "TOC", "name": "Total Organic Carbon (TOC)", "unit": "%"},
            {"key": "TIC", "name": "Total Inorganic Carbon (TIC)", "unit": "%"},
            {"key": "TN", "name": "Total Nitrogen (N)", "unit": "%"},
            {"key": "_cn_ratio", "name": "C:N Ratio", "unit": ""},
            {"key": "Soil_Respiration", "name": "Soil Respiration", "unit": ""},
            {"key": "POX_C", "name": "POX-C", "unit": ""},
        ],
    ))

    session.add(CustomBlock(
        discipline_id=disc.id, block_key="paw",
        fields_json=[
            {"key": "FC", "name": "Field Capacity", "unit": "%"},
            {"key": "WP", "name": "Wilting Point", "unit": "%"},
            {"key": "PAW", "name": "Plant Available Water", "unit": "%"},
        ],
    ))

    session.add(CustomBlock(
        discipline_id=disc.id, block_key="wsa",
        fields_json=[
            {"key": ">2000", "name": ">2000", "unit": "%"},
            {"key": "2000-500", "name": "2000-500", "unit": "%"},
            {"key": "500-250", "name": "500-250", "unit": "%"},
            {"key": "250-53", "name": "250-53", "unit": "%"},
            {"key": "<53", "name": "<53", "unit": "%"},
            {"key": "WSA", "name": "Total", "unit": "%"},
        ],
    ))

    session.add(CustomBlock(
        discipline_id=disc.id, block_key="mineralization",
        fields_json=[
            {"key": "NO3_Mineralization", "name": "NO3-N", "unit": "ppm"},
            {"key": "NH4_Mineralization", "name": "NH4-N", "unit": "ppm"},
            {"key": "Total_Mineralization", "name": "Total Mineralization", "unit": "ppm"},
        ],
    ))

    # --- Computed recommendations ---
    session.add(ComputedRecommendation(
        discipline_id=disc.id,
        analyte_key="Nitrate",
        computation_type="nitrate_conversion",
        params_json={
            "conversion_factor": 2,
            "default_depth": 6.0,
            "hort_targets": {"lawn": 5, "vegetables": 3},
        },
    ))

    session.add(ComputedRecommendation(
        discipline_id=disc.id,
        analyte_key="_base_saturation",
        computation_type="base_saturation_sum",
        params_json={"components": ["K%", "Ca%", "Mg%", "Na%"]},
    ))

    # --- Triggers ---
    session.add(Trigger(
        discipline_id=disc.id,
        field="pH",
        operator="lt",
        threshold=6.2,
        action="show_woodruff",
    ))

    # --- Report template ---
    template_path = Path(__file__).parent / "app" / "templates" / "soil_report.html"
    if template_path.exists():
        template_html = template_path.read_text()
        session.add(ReportTemplate(
            discipline_id=disc.id,
            template_html=template_html,
        ))

    session.commit()
    org_id = org.id
    disc_id = disc.id
    session.close()
    print(f"Seeded: org={org_id}, discipline={disc_id} (Soil)")
    print(f"  {len(analyte_defs)} analytes with rating buckets")
    print(f"  {len(request_code_map)} request codes")
    print(f"  7 custom blocks")
    print(f"  1 trigger (Woodruff pH < 6.2)")
    print(f"  2 computed recommendations (Nitrate, Base Saturation)")


if __name__ == "__main__":
    seed()
