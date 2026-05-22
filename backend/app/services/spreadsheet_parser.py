"""Parse uploaded soil data spreadsheets into structured dicts."""

import pandas as pd
from pathlib import Path


def parse_soil_spreadsheet(file_path: str | Path) -> list[dict]:
    """Read a soil data spreadsheet and return a list of sample dicts.

    Each dict contains all columns from the spreadsheet, keyed by header name.
    """
    df = pd.read_excel(file_path, sheet_name=0)
    samples = []
    for _, row in df.iterrows():
        sample = {}
        for col in df.columns:
            val = row[col]
            if pd.isna(val):
                sample[col] = None
            else:
                sample[col] = val
        samples.append(sample)
    return samples


def determine_template_sections(request_code: str | None) -> list[str]:
    """Determine which optional sections to include based on the request code.

    S1 = default (always included, base template)
    S3 = Saturated Paste Analysis (SAR section)
    S14/S15/S17/S18 = Carbon and Nitrogen
    S19 = 28-Day Mineralizable Nitrogen
    S20 = Wet Aggregate Stability
    S21 = Plant Available Water
    """
    if not request_code:
        return []

    sections = []
    code = request_code.upper()

    if "S3" in code:
        sections.append("sar_paste")
    if any(c in code for c in ("S14", "S15", "S17", "S18")):
        sections.append("carbon_nitrogen")
    if "S19" in code:
        sections.append("mineralization")
    if "S20" in code:
        sections.append("wsa")
    if "S21" in code:
        sections.append("paw")

    return sections


def determine_crop_hort(sample: dict) -> dict:
    """Extract crop/hort classification and related fields."""
    crop_hort = sample.get("Crop/Hort")
    plant_type = sample.get("Plant Type")
    soil_depth = sample.get("Soil Depth")

    is_crop = False
    is_hort = False
    if crop_hort and isinstance(crop_hort, str):
        is_crop = "crop" in crop_hort.lower()
        is_hort = "hort" in crop_hort.lower()

    return {
        "is_crop": is_crop,
        "is_hort": is_hort,
        "plant_type": plant_type,
        "soil_depth": soil_depth,
    }


def format_value(value) -> str:
    """Format a value for display in the report."""
    if value is None:
        return ""
    if isinstance(value, float):
        if value == int(value) and abs(value) < 1e10:
            return str(int(value))
        return f"{value:.2f}" if abs(value) < 100 else f"{value:.1f}"
    return str(value)


def format_date(value) -> str:
    """Format a date value as MM/DD/YYYY."""
    if value is None:
        return ""
    if hasattr(value, "strftime"):
        return value.strftime("%m/%d/%Y")
    return str(value)


def build_address_line2(sample: dict) -> str:
    """Build the city/state/zip line."""
    city = sample.get("City") or ""
    state = sample.get("State") or ""
    zipcode = sample.get("Zipcode") or ""
    if isinstance(zipcode, float):
        zipcode = str(int(zipcode))
    parts = []
    if city:
        parts.append(str(city))
    if state:
        if parts:
            parts[-1] += ","
        parts.append(str(state))
    if zipcode:
        parts.append(str(zipcode))
    return " ".join(parts)
