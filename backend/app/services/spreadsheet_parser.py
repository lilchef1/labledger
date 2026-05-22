import re

import pandas as pd
from pathlib import Path

from app.services.config_loader import DisciplineConfig


def parse_spreadsheet(file_path: str | Path) -> list[dict]:
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


def determine_template_sections(request_code: str | None, config: DisciplineConfig) -> list[str]:
    if not request_code:
        return []

    sections = []
    code = request_code.upper()

    for code_key, section_keys in config.request_codes.items():
        if code_key.upper() in code:
            for sk in section_keys:
                if sk not in sections:
                    sections.append(sk)

    return sections


def determine_crop_hort(sample: dict) -> dict:
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
    if value is None:
        return ""
    if isinstance(value, float):
        if value == int(value) and abs(value) < 1e10:
            return str(int(value))
        return str(value)
    return str(value)


def format_date(value) -> str:
    if value is None:
        return ""
    if hasattr(value, "strftime"):
        return value.strftime("%m/%d/%Y")
    return str(value)


def build_address_line2(sample: dict) -> str:
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
