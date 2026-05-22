from dataclasses import dataclass, field
from functools import lru_cache

from app.services.database import get_session
from app.models.config import (
    Discipline, Analyte, RatingBucket, RequestCode, SimpleField,
    CustomBlock, ComputedRecommendation, Trigger, ReportTemplate, LabInfo,
)


@dataclass
class RatingBucketConfig:
    label: str
    range_text: str
    upper_breakpoint: float | None


@dataclass
class AnalyteConfig:
    key: str
    display_name: str
    unit: str
    color: str
    sort_order: int
    has_recommendation: bool
    recommendation_threshold: float | None
    recommendation_operator: str
    section_name: str | None
    rating_buckets: list[RatingBucketConfig]


@dataclass
class TriggerConfig:
    field: str
    operator: str
    threshold: float
    action: str


@dataclass
class ComputedRecConfig:
    analyte_key: str
    computation_type: str
    params: dict


@dataclass
class DisciplineConfig:
    id: int
    org_id: int
    name: str
    green_bar_title: str
    spreadsheet_id_prefix: str
    report_filename_pattern: str
    analytes: dict[str, AnalyteConfig]
    spreadsheet_columns: dict[str, str]
    request_codes: dict[str, list[str]]
    simple_fields: list[dict]
    custom_blocks: dict[str, list[dict]]
    computed_recommendations: list[ComputedRecConfig]
    triggers: list[TriggerConfig]
    template_html: str | None
    lab_info: dict = field(default_factory=dict)


def _load_analyte(analyte: Analyte) -> AnalyteConfig:
    buckets = [
        RatingBucketConfig(
            label=b.label,
            range_text=b.range_text,
            upper_breakpoint=b.upper_breakpoint,
        )
        for b in analyte.rating_buckets
    ]
    return AnalyteConfig(
        key=analyte.key,
        display_name=analyte.display_name,
        unit=analyte.unit,
        color=analyte.color,
        sort_order=analyte.sort_order,
        has_recommendation=analyte.has_recommendation,
        recommendation_threshold=analyte.recommendation_threshold,
        recommendation_operator=analyte.recommendation_operator,
        section_name=analyte.section_name,
        rating_buckets=buckets,
    )


def load_discipline_config(discipline_id: int) -> DisciplineConfig | None:
    session = get_session()
    try:
        disc = session.get(Discipline, discipline_id)
        if disc is None:
            return None

        analytes = {a.key: _load_analyte(a) for a in disc.analytes}

        columns = {sc.internal_key: sc.header_name for sc in disc.spreadsheet_columns}

        rc_map: dict[str, list[str]] = {}
        for rc in disc.request_codes:
            rc_map.setdefault(rc.code, []).append(rc.section_key)

        simple = [
            {"key": sf.key, "display_name": sf.display_name, "unit": sf.unit}
            for sf in disc.simple_fields
        ]

        blocks = {}
        for cb in disc.custom_blocks:
            blocks[cb.block_key] = cb.fields_json

        computed = [
            ComputedRecConfig(
                analyte_key=cr.analyte_key,
                computation_type=cr.computation_type,
                params=cr.params_json,
            )
            for cr in disc.computed_recommendations
        ]

        trigs = [
            TriggerConfig(
                field=t.field, operator=t.operator,
                threshold=t.threshold, action=t.action,
            )
            for t in disc.triggers
        ]

        tmpl = disc.report_template
        template_html = tmpl.template_html if tmpl else None

        lab = disc.organization.lab_info
        lab_dict = {}
        if lab:
            lab_dict = {
                "name": lab.name,
                "address": lab.address,
                "city": lab.city,
                "state": lab.state,
                "zip": lab.zip,
                "phone": lab.phone,
                "email": lab.email,
                "logos": lab.logo_paths_json or {},
            }

        return DisciplineConfig(
            id=disc.id,
            org_id=disc.org_id,
            name=disc.name,
            green_bar_title=disc.green_bar_title,
            spreadsheet_id_prefix=disc.spreadsheet_id_prefix,
            report_filename_pattern=disc.report_filename_pattern,
            analytes=analytes,
            spreadsheet_columns=columns,
            request_codes=rc_map,
            simple_fields=simple,
            custom_blocks=blocks,
            computed_recommendations=computed,
            triggers=trigs,
            template_html=template_html,
            lab_info=lab_dict,
        )
    finally:
        session.close()


def load_discipline_by_name(org_id: int, name: str) -> DisciplineConfig | None:
    session = get_session()
    try:
        disc = session.query(Discipline).filter_by(org_id=org_id, name=name).first()
        if disc is None:
            return None
        return load_discipline_config(disc.id)
    finally:
        session.close()


def list_disciplines(org_id: int) -> list[dict]:
    session = get_session()
    try:
        discs = session.query(Discipline).filter_by(org_id=org_id).all()
        return [{"id": d.id, "name": d.name, "title": d.green_bar_title} for d in discs]
    finally:
        session.close()


_config_cache: dict[int, DisciplineConfig] = {}


def get_discipline_config(discipline_id: int) -> DisciplineConfig | None:
    if discipline_id not in _config_cache:
        config = load_discipline_config(discipline_id)
        if config is not None:
            _config_cache[discipline_id] = config
    return _config_cache.get(discipline_id)


def clear_config_cache():
    _config_cache.clear()
