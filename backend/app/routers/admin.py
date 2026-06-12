from typing import Any
import tempfile

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import func

from app.models.config import (
    Analyte,
    ComputedRecommendation,
    CustomBlock,
    Discipline,
    FieldKey,
    LabInfo,
    RatingBucket,
    ReportTemplate,
    RequestCode,
    SimpleField,
    SpreadsheetColumn,
    TemplatePlaceholder,
    Trigger,
)
from app.services.config_loader import clear_config_cache
from app.services.column_detector import (
    detect_spreadsheet,
    parse_template_placeholders,
    match_placeholders_to_keys,
)
from app.services.database import get_session

router = APIRouter(prefix="/api/admin", tags=["admin"])

DEFAULT_ORG_ID = 1


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class LabInfoBody(BaseModel):
    name: str
    address: str = ""
    city: str = ""
    state: str = ""
    zip: str = ""
    phone: str = ""
    email: str = ""
    logo_paths_json: dict[str, Any] | None = None


class DisciplineCreate(BaseModel):
    name: str
    green_bar_title: str
    spreadsheet_id_prefix: str = ""
    report_filename_pattern: str = "Report - {lab_id}.pdf"


class DisciplineUpdate(BaseModel):
    name: str | None = None
    green_bar_title: str | None = None
    spreadsheet_id_prefix: str | None = None
    report_filename_pattern: str | None = None


class AnalyteCreate(BaseModel):
    key: str
    display_name: str
    unit: str = ""
    color: str = "#FFC000"
    sort_order: int = 0
    has_recommendation: bool = False
    recommendation_threshold: float | None = None
    recommendation_operator: str = "le"
    section_name: str | None = None


class AnalyteUpdate(BaseModel):
    key: str | None = None
    display_name: str | None = None
    unit: str | None = None
    color: str | None = None
    sort_order: int | None = None
    has_recommendation: bool | None = None
    recommendation_threshold: float | None = None
    recommendation_operator: str | None = None
    section_name: str | None = None


class BucketCreate(BaseModel):
    sort_order: int
    label: str
    range_text: str
    upper_breakpoint: float | None = None


class BucketUpdate(BaseModel):
    sort_order: int | None = None
    label: str | None = None
    range_text: str | None = None
    upper_breakpoint: float | None = None


class FieldKeyCreate(BaseModel):
    name: str
    display_name: str
    data_type: str = "text"
    formula: str | None = None
    date_format: str | None = None
    decimal_places: int | None = None


class FieldKeyUpdate(BaseModel):
    name: str | None = None
    display_name: str | None = None
    data_type: str | None = None
    formula: str | None = None
    date_format: str | None = None
    decimal_places: int | None = None


class ColumnCreate(BaseModel):
    internal_key: str
    header_name: str
    field_key_id: int | None = None
    data_type: str | None = None
    decimal_places: int | None = None
    date_format: str | None = None
    detected_type: str | None = None
    flags: dict[str, Any] | None = None


class ColumnUpdate(BaseModel):
    internal_key: str | None = None
    header_name: str | None = None
    field_key_id: int | None = None
    data_type: str | None = None
    decimal_places: int | None = None
    date_format: str | None = None
    detected_type: str | None = None
    flags: dict[str, Any] | None = None


class PlaceholderMapping(BaseModel):
    placeholder_text: str
    field_key_id: int | None = None


class RequestCodeCreate(BaseModel):
    code: str
    section_key: str
    template_id: int | None = None
    is_modifier: bool = False


class RequestCodeUpdate(BaseModel):
    code: str | None = None
    section_key: str | None = None
    template_id: int | None = None
    is_modifier: bool | None = None


class SimpleFieldCreate(BaseModel):
    key: str
    display_name: str
    unit: str = ""
    decimal_places: int | None = None


class SimpleFieldUpdate(BaseModel):
    key: str | None = None
    display_name: str | None = None
    unit: str | None = None
    decimal_places: int | None = None


class CustomBlockCreate(BaseModel):
    block_key: str
    fields_json: list[Any]


class CustomBlockUpdate(BaseModel):
    block_key: str | None = None
    fields_json: list[Any] | None = None


class ComputedRecCreate(BaseModel):
    analyte_key: str
    computation_type: str
    params_json: dict[str, Any] = {}


class ComputedRecUpdate(BaseModel):
    analyte_key: str | None = None
    computation_type: str | None = None
    params_json: dict[str, Any] | None = None


class TriggerCreate(BaseModel):
    field: str
    operator: str
    threshold: float
    action: str


class TriggerUpdate(BaseModel):
    field: str | None = None
    operator: str | None = None
    threshold: float | None = None
    action: str | None = None


class TemplateBody(BaseModel):
    template_html: str
    name: str | None = None
    file_suffix: str | None = None


# ---------------------------------------------------------------------------
# Lab Info
# ---------------------------------------------------------------------------

@router.get("/lab-info")
def get_lab_info():
    with get_session() as session:
        info = session.query(LabInfo).filter_by(org_id=DEFAULT_ORG_ID).first()
        if not info:
            return JSONResponse(status_code=404, content={"error": "Lab info not found"})
        return {
            "id": info.id,
            "name": info.name,
            "address": info.address,
            "city": info.city,
            "state": info.state,
            "zip": info.zip,
            "phone": info.phone,
            "email": info.email,
            "logo_paths_json": info.logo_paths_json,
        }


@router.put("/lab-info")
def upsert_lab_info(body: LabInfoBody):
    with get_session() as session:
        info = session.query(LabInfo).filter_by(org_id=DEFAULT_ORG_ID).first()
        if info:
            for key, val in body.model_dump().items():
                setattr(info, key, val)
        else:
            info = LabInfo(org_id=DEFAULT_ORG_ID, **body.model_dump())
            session.add(info)
        session.commit()
        session.refresh(info)
        clear_config_cache()
        return {"id": info.id, "name": info.name}


# ---------------------------------------------------------------------------
# Disciplines
# ---------------------------------------------------------------------------

@router.get("/disciplines")
def list_disciplines():
    with get_session() as session:
        discs = session.query(Discipline).filter_by(org_id=DEFAULT_ORG_ID).all()
        return [
            {
                "id": d.id,
                "name": d.name,
                "green_bar_title": d.green_bar_title,
                "spreadsheet_id_prefix": d.spreadsheet_id_prefix,
                "report_filename_pattern": d.report_filename_pattern,
            }
            for d in discs
        ]


@router.get("/disciplines/{disc_id}")
def get_discipline(disc_id: int):
    with get_session() as session:
        disc = session.query(Discipline).filter_by(id=disc_id, org_id=DEFAULT_ORG_ID).first()
        if not disc:
            return JSONResponse(status_code=404, content={"error": "Discipline not found"})
        return {
            "id": disc.id,
            "name": disc.name,
            "green_bar_title": disc.green_bar_title,
            "spreadsheet_id_prefix": disc.spreadsheet_id_prefix,
            "report_filename_pattern": disc.report_filename_pattern,
            "analyte_count": session.query(func.count(Analyte.id)).filter_by(discipline_id=disc_id).scalar(),
            "column_count": session.query(func.count(SpreadsheetColumn.id)).filter_by(discipline_id=disc_id).scalar(),
            "request_code_count": session.query(func.count(RequestCode.id)).filter_by(discipline_id=disc_id).scalar(),
            "simple_field_count": session.query(func.count(SimpleField.id)).filter_by(discipline_id=disc_id).scalar(),
            "custom_block_count": session.query(func.count(CustomBlock.id)).filter_by(discipline_id=disc_id).scalar(),
            "computed_rec_count": session.query(func.count(ComputedRecommendation.id)).filter_by(discipline_id=disc_id).scalar(),
            "trigger_count": session.query(func.count(Trigger.id)).filter_by(discipline_id=disc_id).scalar(),
        }


@router.post("/disciplines", status_code=201)
def create_discipline(body: DisciplineCreate):
    with get_session() as session:
        disc = Discipline(org_id=DEFAULT_ORG_ID, **body.model_dump())
        session.add(disc)
        session.commit()
        session.refresh(disc)
        clear_config_cache()
        return {"id": disc.id, "name": disc.name}


@router.patch("/disciplines/{disc_id}")
def update_discipline(disc_id: int, body: DisciplineUpdate):
    with get_session() as session:
        disc = session.query(Discipline).filter_by(id=disc_id, org_id=DEFAULT_ORG_ID).first()
        if not disc:
            return JSONResponse(status_code=404, content={"error": "Discipline not found"})
        for key, val in body.model_dump(exclude_unset=True).items():
            setattr(disc, key, val)
        session.commit()
        session.refresh(disc)
        clear_config_cache()
        return {"id": disc.id, "name": disc.name}


@router.delete("/disciplines/{disc_id}")
def delete_discipline(disc_id: int):
    with get_session() as session:
        disc = session.query(Discipline).filter_by(id=disc_id, org_id=DEFAULT_ORG_ID).first()
        if not disc:
            return JSONResponse(status_code=404, content={"error": "Discipline not found"})
        session.delete(disc)
        session.commit()
        clear_config_cache()
        return {"deleted": True}


# ---------------------------------------------------------------------------
# Analytes
# ---------------------------------------------------------------------------

def _serialize_analyte(a: Analyte) -> dict:
    return {
        "id": a.id,
        "key": a.key,
        "display_name": a.display_name,
        "unit": a.unit,
        "color": a.color,
        "sort_order": a.sort_order,
        "has_recommendation": a.has_recommendation,
        "recommendation_threshold": a.recommendation_threshold,
        "recommendation_operator": a.recommendation_operator,
        "section_name": a.section_name,
        "scope": a.scope,
        "rating_buckets": [
            {
                "id": b.id,
                "analyte_id": b.analyte_id,
                "sort_order": b.sort_order,
                "label": b.label,
                "range_text": b.range_text,
                "upper_breakpoint": b.upper_breakpoint,
            }
            for b in a.rating_buckets
        ],
    }


@router.get("/disciplines/{disc_id}/analytes")
def list_analytes(disc_id: int, include_global: bool = False):
    with get_session() as session:
        analytes = (
            session.query(Analyte)
            .filter_by(discipline_id=disc_id)
            .order_by(Analyte.sort_order)
            .all()
        )
        result = [_serialize_analyte(a) for a in analytes]
        if include_global:
            global_items = (
                session.query(Analyte)
                .filter_by(scope="global")
                .order_by(Analyte.sort_order)
                .all()
            )
            result.extend([{**_serialize_analyte(a), "scope": "global"} for a in global_items])
        return result


@router.post("/disciplines/{disc_id}/analytes", status_code=201)
def create_analyte(disc_id: int, body: AnalyteCreate):
    with get_session() as session:
        analyte = Analyte(discipline_id=disc_id, **body.model_dump())
        session.add(analyte)
        session.commit()
        session.refresh(analyte)
        clear_config_cache()
        return {"id": analyte.id, "key": analyte.key}


@router.patch("/analytes/{analyte_id}")
def update_analyte(analyte_id: int, body: AnalyteUpdate):
    with get_session() as session:
        analyte = session.query(Analyte).filter_by(id=analyte_id).first()
        if not analyte:
            return JSONResponse(status_code=404, content={"error": "Analyte not found"})
        for key, val in body.model_dump(exclude_unset=True).items():
            setattr(analyte, key, val)
        session.commit()
        session.refresh(analyte)
        clear_config_cache()
        return {"id": analyte.id, "key": analyte.key}


@router.delete("/analytes/{analyte_id}")
def delete_analyte(analyte_id: int):
    with get_session() as session:
        analyte = session.query(Analyte).filter_by(id=analyte_id).first()
        if not analyte:
            return JSONResponse(status_code=404, content={"error": "Analyte not found"})
        session.delete(analyte)
        session.commit()
        clear_config_cache()
        return {"deleted": True}


# ---------------------------------------------------------------------------
# Rating Buckets
# ---------------------------------------------------------------------------

@router.get("/analytes/{analyte_id}/buckets")
def list_buckets(analyte_id: int):
    with get_session() as session:
        buckets = (
            session.query(RatingBucket)
            .filter_by(analyte_id=analyte_id)
            .order_by(RatingBucket.sort_order)
            .all()
        )
        return [
            {
                "id": b.id,
                "sort_order": b.sort_order,
                "label": b.label,
                "range_text": b.range_text,
                "upper_breakpoint": b.upper_breakpoint,
            }
            for b in buckets
        ]


@router.post("/analytes/{analyte_id}/buckets", status_code=201)
def create_bucket(analyte_id: int, body: BucketCreate):
    with get_session() as session:
        bucket = RatingBucket(analyte_id=analyte_id, **body.model_dump())
        session.add(bucket)
        session.commit()
        session.refresh(bucket)
        clear_config_cache()
        return {"id": bucket.id, "label": bucket.label}


@router.patch("/buckets/{bucket_id}")
def update_bucket(bucket_id: int, body: BucketUpdate):
    with get_session() as session:
        bucket = session.query(RatingBucket).filter_by(id=bucket_id).first()
        if not bucket:
            return JSONResponse(status_code=404, content={"error": "Bucket not found"})
        for key, val in body.model_dump(exclude_unset=True).items():
            setattr(bucket, key, val)
        session.commit()
        session.refresh(bucket)
        clear_config_cache()
        return {"id": bucket.id, "label": bucket.label}


@router.delete("/buckets/{bucket_id}")
def delete_bucket(bucket_id: int):
    with get_session() as session:
        bucket = session.query(RatingBucket).filter_by(id=bucket_id).first()
        if not bucket:
            return JSONResponse(status_code=404, content={"error": "Bucket not found"})
        session.delete(bucket)
        session.commit()
        clear_config_cache()
        return {"deleted": True}


@router.put("/analytes/{analyte_id}/buckets")
def bulk_replace_buckets(analyte_id: int, body: list[BucketCreate]):
    with get_session() as session:
        session.query(RatingBucket).filter_by(analyte_id=analyte_id).delete()
        for item in body:
            bucket = RatingBucket(analyte_id=analyte_id, **item.model_dump())
            session.add(bucket)
        session.commit()
        clear_config_cache()
        return {"replaced": len(body)}


# ---------------------------------------------------------------------------
# Spreadsheet Columns
# ---------------------------------------------------------------------------

@router.get("/disciplines/{disc_id}/columns")
def list_columns(disc_id: int):
    with get_session() as session:
        cols = session.query(SpreadsheetColumn).filter_by(discipline_id=disc_id).all()
        result = []
        for c in cols:
            template_refs = []
            if c.field_key_id:
                phs = (
                    session.query(TemplatePlaceholder)
                    .filter_by(field_key_id=c.field_key_id)
                    .all()
                )
                for ph in phs:
                    template_refs.append(ph.placeholder_text)
            result.append({
                "id": c.id,
                "internal_key": c.internal_key,
                "header_name": c.header_name,
                "field_key_id": c.field_key_id,
                "data_type": c.data_type,
                "decimal_places": c.decimal_places,
                "date_format": c.date_format,
                "detected_type": c.detected_type,
                "flags": c.flags,
                "template_refs": template_refs,
            })
        return result


@router.post("/disciplines/{disc_id}/columns", status_code=201)
def create_column(disc_id: int, body: ColumnCreate):
    with get_session() as session:
        col = SpreadsheetColumn(discipline_id=disc_id, **body.model_dump(exclude_none=True))
        session.add(col)
        session.commit()
        col_id = col.id
        col_key = col.internal_key
        clear_config_cache()
        return {"id": col_id, "internal_key": col_key}


@router.patch("/columns/{col_id}")
def update_column(col_id: int, body: ColumnUpdate):
    with get_session() as session:
        col = session.query(SpreadsheetColumn).filter_by(id=col_id).first()
        if not col:
            return JSONResponse(status_code=404, content={"error": "Column not found"})
        updates = body.model_dump(exclude_unset=True)
        for k, val in updates.items():
            setattr(col, k, val)
        if "decimal_places" in updates:
            session.query(SimpleField).filter_by(
                discipline_id=col.discipline_id,
                key=col.internal_key,
            ).update({"decimal_places": updates["decimal_places"]})
        session.commit()
        col_id_out = col.id
        col_key = col.internal_key
        clear_config_cache()
        return {"id": col_id_out, "internal_key": col_key}


@router.delete("/columns/{col_id}")
def delete_column(col_id: int):
    with get_session() as session:
        col = session.query(SpreadsheetColumn).filter_by(id=col_id).first()
        if not col:
            return JSONResponse(status_code=404, content={"error": "Column not found"})
        session.delete(col)
        session.commit()
        clear_config_cache()
        return {"deleted": True}


@router.put("/disciplines/{disc_id}/columns")
def bulk_replace_columns(disc_id: int, body: list[ColumnCreate]):
    with get_session() as session:
        existing_fks = {
            fk.name: fk.id
            for fk in session.query(FieldKey).filter_by(discipline_id=disc_id).all()
        }

        created_keys = 0
        for item in body:
            if item.field_key_id is None and item.header_name not in existing_fks:
                fk = FieldKey(
                    discipline_id=disc_id,
                    name=item.header_name,
                    display_name=item.header_name,
                    data_type=item.data_type or "text",
                )
                session.add(fk)
                session.flush()
                existing_fks[item.header_name] = fk.id
                item.field_key_id = fk.id
                created_keys += 1
            elif item.field_key_id is None and item.header_name in existing_fks:
                item.field_key_id = existing_fks[item.header_name]

        session.query(SpreadsheetColumn).filter_by(discipline_id=disc_id).delete()
        for item in body:
            col = SpreadsheetColumn(discipline_id=disc_id, **item.model_dump())
            session.add(col)
        session.commit()
        clear_config_cache()
        return {"replaced": len(body), "field_keys_created": created_keys}


# ---------------------------------------------------------------------------
# Request Codes
# ---------------------------------------------------------------------------

@router.get("/disciplines/{disc_id}/request-codes")
def list_request_codes(disc_id: int):
    with get_session() as session:
        codes = session.query(RequestCode).filter_by(discipline_id=disc_id).all()
        return [
            {"id": c.id, "code": c.code, "section_key": c.section_key,
             "template_id": c.template_id, "is_modifier": c.is_modifier}
            for c in codes
        ]


@router.post("/disciplines/{disc_id}/request-codes", status_code=201)
def create_request_code(disc_id: int, body: RequestCodeCreate):
    with get_session() as session:
        code = RequestCode(discipline_id=disc_id, **body.model_dump())
        session.add(code)
        session.commit()
        session.refresh(code)
        clear_config_cache()
        return {"id": code.id, "code": code.code}


@router.patch("/request-codes/{code_id}")
def update_request_code(code_id: int, body: RequestCodeUpdate):
    with get_session() as session:
        code = session.query(RequestCode).filter_by(id=code_id).first()
        if not code:
            return JSONResponse(status_code=404, content={"error": "Request code not found"})
        for key, val in body.model_dump(exclude_unset=True).items():
            setattr(code, key, val)
        session.commit()
        session.refresh(code)
        clear_config_cache()
        return {"id": code.id, "code": code.code}


@router.delete("/request-codes/{code_id}")
def delete_request_code(code_id: int):
    with get_session() as session:
        code = session.query(RequestCode).filter_by(id=code_id).first()
        if not code:
            return JSONResponse(status_code=404, content={"error": "Request code not found"})
        session.delete(code)
        session.commit()
        clear_config_cache()
        return {"deleted": True}


# ---------------------------------------------------------------------------
# Simple Fields
# ---------------------------------------------------------------------------

def _serialize_simple_field(f: SimpleField) -> dict:
    return {
        "id": f.id,
        "key": f.key,
        "display_name": f.display_name,
        "unit": f.unit,
        "decimal_places": f.decimal_places,
        "scope": f.scope,
    }


@router.get("/disciplines/{disc_id}/simple-fields")
def list_simple_fields(disc_id: int, include_global: bool = False):
    with get_session() as session:
        fields = (
            session.query(SimpleField)
            .filter_by(discipline_id=disc_id)
            .order_by(SimpleField.key)
            .all()
        )
        result = [_serialize_simple_field(f) for f in fields]
        if include_global:
            global_items = (
                session.query(SimpleField)
                .filter_by(scope="global")
                .order_by(SimpleField.key)
                .all()
            )
            result.extend([{**_serialize_simple_field(f), "scope": "global"} for f in global_items])
        return result


@router.post("/disciplines/{disc_id}/simple-fields", status_code=201)
def create_simple_field(disc_id: int, body: SimpleFieldCreate):
    with get_session() as session:
        field = SimpleField(discipline_id=disc_id, **body.model_dump())
        session.add(field)
        session.commit()
        session.refresh(field)
        clear_config_cache()
        return {"id": field.id, "key": field.key}


@router.patch("/simple-fields/{field_id}")
def update_simple_field(field_id: int, body: SimpleFieldUpdate):
    with get_session() as session:
        field = session.query(SimpleField).filter_by(id=field_id).first()
        if not field:
            return JSONResponse(status_code=404, content={"error": "Simple field not found"})
        updates = body.model_dump(exclude_unset=True)
        for k, val in updates.items():
            setattr(field, k, val)
        if "decimal_places" in updates:
            session.query(SpreadsheetColumn).filter_by(
                discipline_id=field.discipline_id,
                internal_key=field.key,
            ).update({"decimal_places": updates["decimal_places"]})
        session.commit()
        session.refresh(field)
        clear_config_cache()
        return {"id": field.id, "key": field.key}


@router.delete("/simple-fields/{field_id}")
def delete_simple_field(field_id: int):
    with get_session() as session:
        field = session.query(SimpleField).filter_by(id=field_id).first()
        if not field:
            return JSONResponse(status_code=404, content={"error": "Simple field not found"})
        session.delete(field)
        session.commit()
        clear_config_cache()
        return {"deleted": True}


# ---------------------------------------------------------------------------
# Custom Blocks
# ---------------------------------------------------------------------------

def _serialize_custom_block(b: CustomBlock) -> dict:
    return {"id": b.id, "block_key": b.block_key, "fields_json": b.fields_json, "scope": b.scope}


@router.get("/disciplines/{disc_id}/custom-blocks")
def list_custom_blocks(disc_id: int, include_global: bool = False):
    with get_session() as session:
        blocks = session.query(CustomBlock).filter_by(discipline_id=disc_id).all()
        result = [_serialize_custom_block(b) for b in blocks]
        if include_global:
            global_items = session.query(CustomBlock).filter_by(scope="global").all()
            result.extend([{**_serialize_custom_block(b), "scope": "global"} for b in global_items])
        return result


@router.post("/disciplines/{disc_id}/custom-blocks", status_code=201)
def create_custom_block(disc_id: int, body: CustomBlockCreate):
    with get_session() as session:
        block = CustomBlock(discipline_id=disc_id, **body.model_dump())
        session.add(block)
        session.commit()
        session.refresh(block)
        clear_config_cache()
        return {"id": block.id, "block_key": block.block_key}


@router.patch("/custom-blocks/{block_id}")
def update_custom_block(block_id: int, body: CustomBlockUpdate):
    with get_session() as session:
        block = session.query(CustomBlock).filter_by(id=block_id).first()
        if not block:
            return JSONResponse(status_code=404, content={"error": "Custom block not found"})
        for key, val in body.model_dump(exclude_unset=True).items():
            setattr(block, key, val)
        session.commit()
        session.refresh(block)
        clear_config_cache()
        return {"id": block.id, "block_key": block.block_key}


@router.delete("/custom-blocks/{block_id}")
def delete_custom_block(block_id: int):
    with get_session() as session:
        block = session.query(CustomBlock).filter_by(id=block_id).first()
        if not block:
            return JSONResponse(status_code=404, content={"error": "Custom block not found"})
        session.delete(block)
        session.commit()
        clear_config_cache()
        return {"deleted": True}


# ---------------------------------------------------------------------------
# Computed Recommendations
# ---------------------------------------------------------------------------

def _serialize_computed_rec(r: ComputedRecommendation) -> dict:
    return {
        "id": r.id,
        "analyte_key": r.analyte_key,
        "computation_type": r.computation_type,
        "params_json": r.params_json,
        "scope": r.scope,
    }


@router.get("/disciplines/{disc_id}/computed-recs")
def list_computed_recs(disc_id: int, include_global: bool = False):
    with get_session() as session:
        recs = session.query(ComputedRecommendation).filter_by(discipline_id=disc_id).all()
        result = [_serialize_computed_rec(r) for r in recs]
        if include_global:
            global_items = session.query(ComputedRecommendation).filter_by(scope="global").all()
            result.extend([{**_serialize_computed_rec(r), "scope": "global"} for r in global_items])
        return result


@router.post("/disciplines/{disc_id}/computed-recs", status_code=201)
def create_computed_rec(disc_id: int, body: ComputedRecCreate):
    with get_session() as session:
        rec = ComputedRecommendation(discipline_id=disc_id, **body.model_dump())
        session.add(rec)
        session.commit()
        session.refresh(rec)
        clear_config_cache()
        return {"id": rec.id, "analyte_key": rec.analyte_key}


@router.patch("/computed-recs/{rec_id}")
def update_computed_rec(rec_id: int, body: ComputedRecUpdate):
    with get_session() as session:
        rec = session.query(ComputedRecommendation).filter_by(id=rec_id).first()
        if not rec:
            return JSONResponse(status_code=404, content={"error": "Computed recommendation not found"})
        for key, val in body.model_dump(exclude_unset=True).items():
            setattr(rec, key, val)
        session.commit()
        session.refresh(rec)
        clear_config_cache()
        return {"id": rec.id, "analyte_key": rec.analyte_key}


@router.delete("/computed-recs/{rec_id}")
def delete_computed_rec(rec_id: int):
    with get_session() as session:
        rec = session.query(ComputedRecommendation).filter_by(id=rec_id).first()
        if not rec:
            return JSONResponse(status_code=404, content={"error": "Computed recommendation not found"})
        session.delete(rec)
        session.commit()
        clear_config_cache()
        return {"deleted": True}


# ---------------------------------------------------------------------------
# Triggers
# ---------------------------------------------------------------------------

def _serialize_trigger(t: Trigger) -> dict:
    return {
        "id": t.id,
        "field": t.field,
        "operator": t.operator,
        "threshold": t.threshold,
        "action": t.action,
        "scope": t.scope,
    }


@router.get("/disciplines/{disc_id}/triggers")
def list_triggers(disc_id: int, include_global: bool = False):
    with get_session() as session:
        triggers = session.query(Trigger).filter_by(discipline_id=disc_id).all()
        result = [_serialize_trigger(t) for t in triggers]
        if include_global:
            global_items = session.query(Trigger).filter_by(scope="global").all()
            result.extend([{**_serialize_trigger(t), "scope": "global"} for t in global_items])
        return result


@router.post("/disciplines/{disc_id}/triggers", status_code=201)
def create_trigger(disc_id: int, body: TriggerCreate):
    with get_session() as session:
        trigger = Trigger(discipline_id=disc_id, **body.model_dump())
        session.add(trigger)
        session.commit()
        session.refresh(trigger)
        clear_config_cache()
        return {"id": trigger.id, "field": trigger.field}


@router.patch("/triggers/{trigger_id}")
def update_trigger(trigger_id: int, body: TriggerUpdate):
    with get_session() as session:
        trigger = session.query(Trigger).filter_by(id=trigger_id).first()
        if not trigger:
            return JSONResponse(status_code=404, content={"error": "Trigger not found"})
        for key, val in body.model_dump(exclude_unset=True).items():
            setattr(trigger, key, val)
        session.commit()
        session.refresh(trigger)
        clear_config_cache()
        return {"id": trigger.id, "field": trigger.field}


@router.delete("/triggers/{trigger_id}")
def delete_trigger(trigger_id: int):
    with get_session() as session:
        trigger = session.query(Trigger).filter_by(id=trigger_id).first()
        if not trigger:
            return JSONResponse(status_code=404, content={"error": "Trigger not found"})
        session.delete(trigger)
        session.commit()
        clear_config_cache()
        return {"deleted": True}


# ---------------------------------------------------------------------------
# Report Template
# ---------------------------------------------------------------------------

def _serialize_template(tmpl: ReportTemplate) -> dict:
    return {
        "id": tmpl.id,
        "discipline_id": tmpl.discipline_id,
        "name": tmpl.name,
        "sort_order": tmpl.sort_order,
        "file_suffix": tmpl.file_suffix,
        "template_html": tmpl.template_html,
        "updated_at": tmpl.updated_at.isoformat() if tmpl.updated_at else None,
    }


def _sync_placeholders(session, tmpl: ReportTemplate, html: str, disc_id: int):
    raw_placeholders = parse_template_placeholders(html)
    existing_phs = {
        ph.placeholder_text: ph
        for ph in session.query(TemplatePlaceholder).filter_by(template_id=tmpl.id).all()
    }

    new_placeholder_texts: list[str] = []
    seen = set()
    for ph_text in raw_placeholders:
        seen.add(ph_text)
        if ph_text not in existing_phs:
            session.add(TemplatePlaceholder(
                template_id=tmpl.id, placeholder_text=ph_text,
            ))
            new_placeholder_texts.append(ph_text)
    for ph_text, ph_obj in existing_phs.items():
        if ph_text not in seen:
            session.delete(ph_obj)

    if new_placeholder_texts:
        field_keys = session.query(FieldKey).filter_by(
            discipline_id=disc_id
        ).all()
        if field_keys:
            fk_dicts = [
                {"id": fk.id, "name": fk.name, "display_name": fk.display_name}
                for fk in field_keys
            ]
            matches = match_placeholders_to_keys(new_placeholder_texts, fk_dicts)
            session.flush()
            for m in matches:
                if m["suggested_key_id"] is not None:
                    ph = (
                        session.query(TemplatePlaceholder)
                        .filter_by(template_id=tmpl.id, placeholder_text=m["placeholder_text"])
                        .first()
                    )
                    if ph:
                        ph.field_key_id = m["suggested_key_id"]
                        ph.match_confidence = m["match_confidence"]


@router.get("/disciplines/{disc_id}/templates")
def list_templates(disc_id: int):
    with get_session() as session:
        tmpls = (
            session.query(ReportTemplate)
            .filter_by(discipline_id=disc_id)
            .order_by(ReportTemplate.sort_order)
            .all()
        )
        return [
            {
                "id": t.id,
                "name": t.name,
                "sort_order": t.sort_order,
                "file_suffix": t.file_suffix,
                "placeholder_count": len(t.placeholders),
            }
            for t in tmpls
        ]


@router.get("/disciplines/{disc_id}/template")
def get_template(disc_id: int):
    with get_session() as session:
        tmpl = session.query(ReportTemplate).filter_by(discipline_id=disc_id).first()
        if not tmpl:
            return JSONResponse(status_code=404, content={"error": "Template not found"})
        return _serialize_template(tmpl)


@router.put("/disciplines/{disc_id}/template")
def upsert_template(disc_id: int, body: TemplateBody):
    with get_session() as session:
        tmpl = session.query(ReportTemplate).filter_by(discipline_id=disc_id).first()
        if tmpl:
            tmpl.template_html = body.template_html
        else:
            tmpl = ReportTemplate(discipline_id=disc_id, template_html=body.template_html)
            session.add(tmpl)
        session.flush()
        _sync_placeholders(session, tmpl, body.template_html, disc_id)
        session.commit()
        result = {"id": tmpl.id, "discipline_id": tmpl.discipline_id}
        clear_config_cache()
        return result


@router.get("/templates/{template_id}")
def get_template_by_id(template_id: int):
    with get_session() as session:
        tmpl = session.get(ReportTemplate, template_id)
        if not tmpl:
            return JSONResponse(status_code=404, content={"error": "Template not found"})
        return _serialize_template(tmpl)


@router.post("/disciplines/{disc_id}/templates", status_code=201)
def create_template(disc_id: int, body: TemplateBody):
    with get_session() as session:
        max_order = (
            session.query(ReportTemplate.sort_order)
            .filter_by(discipline_id=disc_id)
            .order_by(ReportTemplate.sort_order.desc())
            .first()
        )
        next_order = (max_order[0] + 1) if max_order else 0
        name = getattr(body, "name", None) or "Default"
        tmpl = ReportTemplate(
            discipline_id=disc_id,
            name=name,
            sort_order=next_order,
            file_suffix=body.file_suffix,
            template_html=body.template_html,
        )
        session.add(tmpl)
        session.flush()
        _sync_placeholders(session, tmpl, body.template_html, disc_id)
        session.commit()
        result = {"id": tmpl.id, "discipline_id": disc_id, "name": tmpl.name}
        clear_config_cache()
        return result


@router.put("/templates/{template_id}")
def update_template(template_id: int, body: TemplateBody):
    with get_session() as session:
        tmpl = session.get(ReportTemplate, template_id)
        if not tmpl:
            return JSONResponse(status_code=404, content={"error": "Template not found"})
        tmpl.template_html = body.template_html
        if hasattr(body, "name") and body.name is not None:
            tmpl.name = body.name
        if body.file_suffix is not None:
            tmpl.file_suffix = body.file_suffix
        session.flush()
        _sync_placeholders(session, tmpl, body.template_html, tmpl.discipline_id)
        session.commit()
        result = {"id": tmpl.id, "discipline_id": tmpl.discipline_id}
        clear_config_cache()
        return result


@router.delete("/templates/{template_id}")
def delete_template(template_id: int):
    with get_session() as session:
        tmpl = session.get(ReportTemplate, template_id)
        if not tmpl:
            return JSONResponse(status_code=404, content={"error": "Template not found"})
        session.delete(tmpl)
        session.commit()
        clear_config_cache()
        return {"deleted": True}


@router.post("/template/preview")
def preview_template_pdf(body: TemplateBody):
    from weasyprint import HTML
    from fastapi.responses import Response
    pdf = HTML(string=body.template_html).write_pdf()
    return Response(content=pdf, media_type="application/pdf")


@router.post("/template/convert")
async def convert_template_file(file: UploadFile = File(...)):
    from app.services.template_converter import excel_to_html, csv_to_html, docx_to_html

    name = (file.filename or "").lower()
    content = await file.read()

    if name.endswith((".html", ".htm")):
        return {"html": content.decode("utf-8", errors="replace")}

    if name.endswith(".csv"):
        return {"html": csv_to_html(content)}

    if name.endswith((".xlsx", ".xls")):
        html, extracted_formulas = excel_to_html(content, return_extractions=True)
        return {"html": html, "extracted_formulas": extracted_formulas}

    if name.endswith(".docx"):
        return {"html": docx_to_html(content)}

    return JSONResponse(status_code=400, content={"error": f"Unsupported file type: {name}"})


# ---------------------------------------------------------------------------
# Field Keys
# ---------------------------------------------------------------------------

def _serialize_field_key(k: FieldKey, session) -> dict:
    col_refs = [
        sc.header_name
        for sc in session.query(SpreadsheetColumn)
        .filter_by(field_key_id=k.id).all()
    ]
    ph_refs = [
        ph.placeholder_text
        for ph in session.query(TemplatePlaceholder)
        .filter_by(field_key_id=k.id).all()
    ]
    return {
        "id": k.id,
        "name": k.name,
        "display_name": k.display_name,
        "data_type": k.data_type,
        "formula": k.formula,
        "date_format": k.date_format,
        "decimal_places": k.decimal_places,
        "scope": k.scope,
        "column_refs": col_refs,
        "placeholder_refs": ph_refs,
    }


@router.get("/disciplines/{disc_id}/field-keys")
def list_field_keys(disc_id: int, include_global: bool = False):
    with get_session() as session:
        keys = session.query(FieldKey).filter_by(discipline_id=disc_id).all()
        result = [_serialize_field_key(k, session) for k in keys]
        if include_global:
            global_items = session.query(FieldKey).filter_by(scope="global").all()
            result.extend([{**_serialize_field_key(k, session), "scope": "global"} for k in global_items])
        return result


@router.post("/disciplines/{disc_id}/field-keys", status_code=201)
def create_field_key(disc_id: int, body: FieldKeyCreate):
    with get_session() as session:
        fk = FieldKey(discipline_id=disc_id, **body.model_dump(exclude_none=True))
        session.add(fk)
        session.commit()
        fk_id = fk.id
        fk_name = fk.name
        clear_config_cache()
        return {"id": fk_id, "name": fk_name}


@router.patch("/field-keys/{key_id}")
def update_field_key(key_id: int, body: FieldKeyUpdate):
    with get_session() as session:
        fk = session.query(FieldKey).filter_by(id=key_id).first()
        if not fk:
            return JSONResponse(status_code=404, content={"error": "Field key not found"})
        for k, v in body.model_dump(exclude_unset=True).items():
            setattr(fk, k, v)
        session.commit()
        fk_id = fk.id
        fk_name = fk.name
        clear_config_cache()
        return {"id": fk_id, "name": fk_name}


@router.delete("/field-keys/{key_id}")
def delete_field_key(key_id: int):
    with get_session() as session:
        fk = session.query(FieldKey).filter_by(id=key_id).first()
        if not fk:
            return JSONResponse(status_code=404, content={"error": "Field key not found"})
        session.delete(fk)
        session.commit()
        clear_config_cache()
        return {"deleted": True}


# ---------------------------------------------------------------------------
# Spreadsheet Detection
# ---------------------------------------------------------------------------

@router.post("/disciplines/{disc_id}/columns/detect")
async def detect_columns(disc_id: int, file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    with get_session() as session:
        keys = session.query(FieldKey).filter_by(discipline_id=disc_id).all()
        key_dicts = [
            {"id": k.id, "name": k.name, "display_name": k.display_name}
            for k in keys
        ]

    detected = detect_spreadsheet(tmp_path, key_dicts)

    import os
    os.unlink(tmp_path)

    return [
        {
            "header": d.header,
            "detected_type": d.detected_type,
            "sample_values": d.sample_values,
            "flags": d.flags,
            "suggested_key_id": d.suggested_key_id,
            "suggested_key_name": d.suggested_key_name,
            "match_confidence": d.match_confidence,
            "decimal_places": d.decimal_places,
        }
        for d in detected
    ]


@router.post("/global/columns/detect")
async def detect_columns_global(file: UploadFile = File(...)):
    """Detect columns from an uploaded spreadsheet without a discipline context.

    Uses global-scoped field keys for matching suggestions.  If no global
    field keys exist, detection still runs but no key matches are suggested.
    """
    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    with get_session() as session:
        keys = session.query(FieldKey).filter_by(scope="global").all()
        key_dicts = [
            {"id": k.id, "name": k.name, "display_name": k.display_name}
            for k in keys
        ]

    detected = detect_spreadsheet(tmp_path, key_dicts)

    import os
    os.unlink(tmp_path)

    return [
        {
            "header": d.header,
            "detected_type": d.detected_type,
            "sample_values": d.sample_values,
            "flags": d.flags,
            "suggested_key_id": d.suggested_key_id,
            "suggested_key_name": d.suggested_key_name,
            "match_confidence": d.match_confidence,
            "decimal_places": d.decimal_places,
        }
        for d in detected
    ]


# ---------------------------------------------------------------------------
# Template Placeholders
# ---------------------------------------------------------------------------

def _list_placeholders_for_template(session, tmpl_id: int) -> list[dict]:
    phs = (
        session.query(TemplatePlaceholder)
        .filter_by(template_id=tmpl_id)
        .all()
    )
    result = []
    for ph in phs:
        col_ref = None
        if ph.field_key_id:
            sc = (
                session.query(SpreadsheetColumn)
                .filter_by(field_key_id=ph.field_key_id)
                .first()
            )
            if sc:
                col_ref = sc.header_name
        result.append({
            "id": ph.id,
            "placeholder_text": ph.placeholder_text,
            "field_key_id": ph.field_key_id,
            "field_key_name": ph.field_key.name if ph.field_key else None,
            "column_ref": col_ref,
            "match_confidence": ph.match_confidence,
        })
    return result


def _update_placeholders_for_template(session, tmpl_id: int, body: list[PlaceholderMapping]):
    for mapping in body:
        ph = (
            session.query(TemplatePlaceholder)
            .filter_by(template_id=tmpl_id, placeholder_text=mapping.placeholder_text)
            .first()
        )
        if ph:
            ph.field_key_id = mapping.field_key_id
            ph.match_confidence = None
    session.commit()
    clear_config_cache()


@router.get("/disciplines/{disc_id}/template/placeholders")
def list_template_placeholders(disc_id: int):
    with get_session() as session:
        tmpl = session.query(ReportTemplate).filter_by(discipline_id=disc_id).first()
        if not tmpl:
            return JSONResponse(status_code=404, content={"error": "Template not found"})
        return _list_placeholders_for_template(session, tmpl.id)


@router.put("/disciplines/{disc_id}/template/placeholders")
def update_template_placeholders(disc_id: int, body: list[PlaceholderMapping]):
    with get_session() as session:
        tmpl = session.query(ReportTemplate).filter_by(discipline_id=disc_id).first()
        if not tmpl:
            return JSONResponse(status_code=404, content={"error": "Template not found"})
        _update_placeholders_for_template(session, tmpl.id, body)
        return {"updated": len(body)}


@router.get("/templates/{template_id}/placeholders")
def list_placeholders_by_template(template_id: int):
    with get_session() as session:
        tmpl = session.get(ReportTemplate, template_id)
        if not tmpl:
            return JSONResponse(status_code=404, content={"error": "Template not found"})
        return _list_placeholders_for_template(session, template_id)


@router.put("/templates/{template_id}/placeholders")
def update_placeholders_by_template(template_id: int, body: list[PlaceholderMapping]):
    with get_session() as session:
        tmpl = session.get(ReportTemplate, template_id)
        if not tmpl:
            return JSONResponse(status_code=404, content={"error": "Template not found"})
        _update_placeholders_for_template(session, template_id, body)
        return {"updated": len(body)}


# ---------------------------------------------------------------------------
# Global Config Items
# ---------------------------------------------------------------------------

# --- Global Field Keys ---

@router.get("/global/field-keys")
def list_global_field_keys():
    with get_session() as session:
        keys = session.query(FieldKey).filter_by(scope="global").all()
        return [_serialize_field_key(k, session) for k in keys]


@router.post("/global/field-keys", status_code=201)
def create_global_field_key(body: FieldKeyCreate):
    with get_session() as session:
        fk = FieldKey(
            **body.model_dump(exclude_none=True),
            scope="global",
            discipline_id=None,
            org_id=DEFAULT_ORG_ID,
        )
        session.add(fk)
        session.commit()
        session.refresh(fk)
        clear_config_cache()
        return {"id": fk.id, "name": fk.name, "scope": "global"}


@router.patch("/global/field-keys/{key_id}")
def update_global_field_key(key_id: int, body: FieldKeyUpdate):
    with get_session() as session:
        fk = session.query(FieldKey).filter_by(id=key_id, scope="global").first()
        if not fk:
            return JSONResponse(status_code=404, content={"error": "Global field key not found"})
        for k, v in body.model_dump(exclude_unset=True).items():
            setattr(fk, k, v)
        session.commit()
        session.refresh(fk)
        clear_config_cache()
        return {"id": fk.id, "name": fk.name, "scope": "global"}


@router.delete("/global/field-keys/{key_id}")
def delete_global_field_key(key_id: int):
    with get_session() as session:
        fk = session.query(FieldKey).filter_by(id=key_id, scope="global").first()
        if not fk:
            return JSONResponse(status_code=404, content={"error": "Global field key not found"})
        session.delete(fk)
        session.commit()
        clear_config_cache()
        return {"deleted": True}


# --- Global Analytes ---

@router.get("/global/analytes")
def list_global_analytes():
    with get_session() as session:
        analytes = (
            session.query(Analyte)
            .filter_by(scope="global")
            .order_by(Analyte.sort_order)
            .all()
        )
        return [_serialize_analyte(a) for a in analytes]


@router.post("/global/analytes", status_code=201)
def create_global_analyte(body: AnalyteCreate):
    with get_session() as session:
        analyte = Analyte(
            **body.model_dump(),
            scope="global",
            discipline_id=None,
            org_id=DEFAULT_ORG_ID,
        )
        session.add(analyte)
        session.commit()
        session.refresh(analyte)
        clear_config_cache()
        return {"id": analyte.id, "key": analyte.key, "scope": "global"}


@router.patch("/global/analytes/{analyte_id}")
def update_global_analyte(analyte_id: int, body: AnalyteUpdate):
    with get_session() as session:
        analyte = session.query(Analyte).filter_by(id=analyte_id, scope="global").first()
        if not analyte:
            return JSONResponse(status_code=404, content={"error": "Global analyte not found"})
        for key, val in body.model_dump(exclude_unset=True).items():
            setattr(analyte, key, val)
        session.commit()
        session.refresh(analyte)
        clear_config_cache()
        return {"id": analyte.id, "key": analyte.key, "scope": "global"}


@router.delete("/global/analytes/{analyte_id}")
def delete_global_analyte(analyte_id: int):
    with get_session() as session:
        analyte = session.query(Analyte).filter_by(id=analyte_id, scope="global").first()
        if not analyte:
            return JSONResponse(status_code=404, content={"error": "Global analyte not found"})
        session.delete(analyte)
        session.commit()
        clear_config_cache()
        return {"deleted": True}


# --- Global Custom Blocks ---

@router.get("/global/custom-blocks")
def list_global_custom_blocks():
    with get_session() as session:
        blocks = session.query(CustomBlock).filter_by(scope="global").all()
        return [_serialize_custom_block(b) for b in blocks]


@router.post("/global/custom-blocks", status_code=201)
def create_global_custom_block(body: CustomBlockCreate):
    with get_session() as session:
        block = CustomBlock(
            **body.model_dump(),
            scope="global",
            discipline_id=None,
            org_id=DEFAULT_ORG_ID,
        )
        session.add(block)
        session.commit()
        session.refresh(block)
        clear_config_cache()
        return {"id": block.id, "block_key": block.block_key, "scope": "global"}


@router.patch("/global/custom-blocks/{block_id}")
def update_global_custom_block(block_id: int, body: CustomBlockUpdate):
    with get_session() as session:
        block = session.query(CustomBlock).filter_by(id=block_id, scope="global").first()
        if not block:
            return JSONResponse(status_code=404, content={"error": "Global custom block not found"})
        for key, val in body.model_dump(exclude_unset=True).items():
            setattr(block, key, val)
        session.commit()
        session.refresh(block)
        clear_config_cache()
        return {"id": block.id, "block_key": block.block_key, "scope": "global"}


@router.delete("/global/custom-blocks/{block_id}")
def delete_global_custom_block(block_id: int):
    with get_session() as session:
        block = session.query(CustomBlock).filter_by(id=block_id, scope="global").first()
        if not block:
            return JSONResponse(status_code=404, content={"error": "Global custom block not found"})
        session.delete(block)
        session.commit()
        clear_config_cache()
        return {"deleted": True}


# --- Global Computed Recommendations ---

@router.get("/global/computed-recs")
def list_global_computed_recs():
    with get_session() as session:
        recs = session.query(ComputedRecommendation).filter_by(scope="global").all()
        return [_serialize_computed_rec(r) for r in recs]


@router.post("/global/computed-recs", status_code=201)
def create_global_computed_rec(body: ComputedRecCreate):
    with get_session() as session:
        rec = ComputedRecommendation(
            **body.model_dump(),
            scope="global",
            discipline_id=None,
            org_id=DEFAULT_ORG_ID,
        )
        session.add(rec)
        session.commit()
        session.refresh(rec)
        clear_config_cache()
        return {"id": rec.id, "analyte_key": rec.analyte_key, "scope": "global"}


@router.patch("/global/computed-recs/{rec_id}")
def update_global_computed_rec(rec_id: int, body: ComputedRecUpdate):
    with get_session() as session:
        rec = session.query(ComputedRecommendation).filter_by(id=rec_id, scope="global").first()
        if not rec:
            return JSONResponse(status_code=404, content={"error": "Global computed recommendation not found"})
        for key, val in body.model_dump(exclude_unset=True).items():
            setattr(rec, key, val)
        session.commit()
        session.refresh(rec)
        clear_config_cache()
        return {"id": rec.id, "analyte_key": rec.analyte_key, "scope": "global"}


@router.delete("/global/computed-recs/{rec_id}")
def delete_global_computed_rec(rec_id: int):
    with get_session() as session:
        rec = session.query(ComputedRecommendation).filter_by(id=rec_id, scope="global").first()
        if not rec:
            return JSONResponse(status_code=404, content={"error": "Global computed recommendation not found"})
        session.delete(rec)
        session.commit()
        clear_config_cache()
        return {"deleted": True}


# --- Global Simple Fields ---

@router.get("/global/simple-fields")
def list_global_simple_fields():
    with get_session() as session:
        fields = (
            session.query(SimpleField)
            .filter_by(scope="global")
            .order_by(SimpleField.key)
            .all()
        )
        return [_serialize_simple_field(f) for f in fields]


@router.post("/global/simple-fields", status_code=201)
def create_global_simple_field(body: SimpleFieldCreate):
    with get_session() as session:
        field = SimpleField(
            **body.model_dump(),
            scope="global",
            discipline_id=None,
            org_id=DEFAULT_ORG_ID,
        )
        session.add(field)
        session.commit()
        session.refresh(field)
        clear_config_cache()
        return {"id": field.id, "key": field.key, "scope": "global"}


@router.patch("/global/simple-fields/{field_id}")
def update_global_simple_field(field_id: int, body: SimpleFieldUpdate):
    with get_session() as session:
        field = session.query(SimpleField).filter_by(id=field_id, scope="global").first()
        if not field:
            return JSONResponse(status_code=404, content={"error": "Global simple field not found"})
        updates = body.model_dump(exclude_unset=True)
        for k, val in updates.items():
            setattr(field, k, val)
        session.commit()
        session.refresh(field)
        clear_config_cache()
        return {"id": field.id, "key": field.key, "scope": "global"}


@router.delete("/global/simple-fields/{field_id}")
def delete_global_simple_field(field_id: int):
    with get_session() as session:
        field = session.query(SimpleField).filter_by(id=field_id, scope="global").first()
        if not field:
            return JSONResponse(status_code=404, content={"error": "Global simple field not found"})
        session.delete(field)
        session.commit()
        clear_config_cache()
        return {"deleted": True}


# --- Global Triggers ---

@router.get("/global/triggers")
def list_global_triggers():
    with get_session() as session:
        triggers = session.query(Trigger).filter_by(scope="global").all()
        return [_serialize_trigger(t) for t in triggers]


@router.post("/global/triggers", status_code=201)
def create_global_trigger(body: TriggerCreate):
    with get_session() as session:
        trigger = Trigger(
            **body.model_dump(),
            scope="global",
            discipline_id=None,
            org_id=DEFAULT_ORG_ID,
        )
        session.add(trigger)
        session.commit()
        session.refresh(trigger)
        clear_config_cache()
        return {"id": trigger.id, "field": trigger.field, "scope": "global"}


@router.patch("/global/triggers/{trigger_id}")
def update_global_trigger(trigger_id: int, body: TriggerUpdate):
    with get_session() as session:
        trigger = session.query(Trigger).filter_by(id=trigger_id, scope="global").first()
        if not trigger:
            return JSONResponse(status_code=404, content={"error": "Global trigger not found"})
        for key, val in body.model_dump(exclude_unset=True).items():
            setattr(trigger, key, val)
        session.commit()
        session.refresh(trigger)
        clear_config_cache()
        return {"id": trigger.id, "field": trigger.field, "scope": "global"}


@router.delete("/global/triggers/{trigger_id}")
def delete_global_trigger(trigger_id: int):
    with get_session() as session:
        trigger = session.query(Trigger).filter_by(id=trigger_id, scope="global").first()
        if not trigger:
            return JSONResponse(status_code=404, content={"error": "Global trigger not found"})
        session.delete(trigger)
        session.commit()
        clear_config_cache()
        return {"deleted": True}
