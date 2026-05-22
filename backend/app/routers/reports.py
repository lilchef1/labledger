import io
import tempfile
import zipfile
from pathlib import Path

from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from pydantic import BaseModel

from app.services.batch_store import (
    create_batch,
    delete_batch,
    get_batch,
    get_report,
    list_batches,
    update_report,
)
from app.services.config_loader import get_discipline_config, list_disciplines
from app.services.recommendations import compute_all_recommendations
from app.services.report_generator import generate_report_pdf, prepare_report_context
from app.services.spreadsheet_parser import parse_spreadsheet

router = APIRouter(prefix="/api/reports", tags=["reports"])

DEFAULT_ORG_ID = 1


class ReportUpdate(BaseModel):
    recommendations: dict[str, dict] | None = None
    comments: str | None = None
    status: str | None = None


@router.get("/disciplines")
async def get_disciplines_endpoint():
    return list_disciplines(DEFAULT_ORG_ID)


@router.post("/{discipline_id}/upload")
async def upload_spreadsheet(discipline_id: int, file: UploadFile = File(...)):
    config = get_discipline_config(discipline_id)
    if config is None:
        return JSONResponse(
            status_code=404,
            content={"error": f"Unknown discipline: {discipline_id}"},
        )

    if not file.filename.endswith((".xlsx", ".xls")):
        return JSONResponse(
            status_code=400,
            content={"error": "File must be an Excel spreadsheet (.xlsx or .xls)"},
        )

    contents = await file.read()

    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        samples = parse_spreadsheet(tmp_path)
    except Exception as e:
        return JSONResponse(
            status_code=422,
            content={"error": f"Failed to parse spreadsheet: {e}"},
        )
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    if not samples:
        return JSONResponse(
            status_code=422,
            content={"error": "No samples found in spreadsheet"},
        )

    batch_id = create_batch(file.filename, samples, discipline_id=discipline_id)
    batch = get_batch(batch_id)

    for lab_id, report in batch["reports"].items():
        recs = compute_all_recommendations(report["sample"], config)
        report["recommendations"] = recs

    return {
        "batch_id": batch_id,
        "filename": file.filename,
        "report_count": batch["report_count"],
        "lab_ids": list(batch["reports"].keys()),
    }


@router.post("/upload")
async def upload_spreadsheet_default(file: UploadFile = File(...)):
    """Backward-compatible upload using discipline_id=1."""
    return await upload_spreadsheet(1, file)


@router.get("/batches")
async def get_batches():
    return list_batches()


@router.get("/batch/{batch_id}")
async def get_batch_detail(batch_id: str):
    batch = get_batch(batch_id)
    if batch is None:
        return JSONResponse(status_code=404, content={"error": "Batch not found"})

    reports_summary = []
    for lab_id, report in batch["reports"].items():
        sample = report["sample"]
        reports_summary.append({
            "lab_id": lab_id,
            "sample_id": sample.get("Sample ID") or "",
            "customer_name": sample.get("Customer Name") or "",
            "status": report["status"],
        })

    return {
        "id": batch["id"],
        "filename": batch["filename"],
        "discipline_id": batch["discipline_id"],
        "created_at": batch["created_at"],
        "report_count": batch["report_count"],
        "reports": reports_summary,
    }


@router.get("/batch/{batch_id}/export")
async def export_batch_zip(batch_id: str):
    batch = get_batch(batch_id)
    if batch is None:
        return JSONResponse(status_code=404, content={"error": "Batch not found"})

    config = get_discipline_config(batch["discipline_id"])
    if config is None:
        return JSONResponse(status_code=500, content={"error": "Discipline config not found"})

    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for lab_id, report in batch["reports"].items():
            sample = dict(report["sample"])
            sample["_user_comments"] = report["comments"]
            sample["_user_recommendations"] = report["recommendations"]

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp_path = tmp.name

            try:
                generate_report_pdf(sample, config, tmp_path)
                zf.write(tmp_path, f"Report - {lab_id}.pdf")
            except Exception:
                pass
            finally:
                Path(tmp_path).unlink(missing_ok=True)

    zip_buffer.seek(0)
    filename = Path(batch["filename"]).stem
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}_reports.zip"'},
    )


@router.get("/batch/{batch_id}/{lab_id}")
async def get_report_detail(batch_id: str, lab_id: str):
    batch = get_batch(batch_id)
    if batch is None:
        return JSONResponse(status_code=404, content={"error": "Batch not found"})

    report = batch["reports"].get(lab_id)
    if report is None:
        return JSONResponse(status_code=404, content={"error": "Report not found"})

    config = get_discipline_config(batch["discipline_id"])
    if config is None:
        return JSONResponse(status_code=500, content={"error": "Discipline config not found"})

    context = prepare_report_context(report["sample"], config)

    return {
        "lab_id": lab_id,
        "status": report["status"],
        "comments": report["comments"],
        "recommendations": report["recommendations"],
        "context": {
            "sample": context["sample"],
            "analytes": {
                key: {
                    "display": a.display,
                    "labels": a.labels,
                    "active_index": a.active_index,
                    "recommendation": a.recommendation,
                    "unit_label": a.unit_label,
                    "rec_unit": a.rec_unit,
                }
                for key, a in context["analytes"].items()
            },
            "sections": context["sections"],
        },
    }


@router.patch("/batch/{batch_id}/{lab_id}")
async def update_report_endpoint(batch_id: str, lab_id: str, body: ReportUpdate):
    updates = body.model_dump(exclude_none=True)
    if not updates:
        return JSONResponse(
            status_code=400, content={"error": "No updates provided"}
        )

    result = update_report(batch_id, lab_id, updates)
    if result is None:
        return JSONResponse(status_code=404, content={"error": "Report not found"})

    return {
        "lab_id": lab_id,
        "status": result["status"],
        "comments": result["comments"],
        "recommendations": result["recommendations"],
    }


@router.get("/batch/{batch_id}/{lab_id}/pdf")
async def export_single_pdf(batch_id: str, lab_id: str):
    batch = get_batch(batch_id)
    if batch is None:
        return JSONResponse(status_code=404, content={"error": "Batch not found"})

    report = batch["reports"].get(lab_id)
    if report is None:
        return JSONResponse(status_code=404, content={"error": "Report not found"})

    config = get_discipline_config(batch["discipline_id"])
    if config is None:
        return JSONResponse(status_code=500, content={"error": "Discipline config not found"})

    sample = dict(report["sample"])
    sample["_user_comments"] = report["comments"]
    sample["_user_recommendations"] = report["recommendations"]

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        generate_report_pdf(sample, config, tmp_path)
        return FileResponse(
            tmp_path,
            media_type="application/pdf",
            filename=f"Report - {lab_id}.pdf",
        )
    except Exception as e:
        Path(tmp_path).unlink(missing_ok=True)
        return JSONResponse(
            status_code=500,
            content={"error": f"PDF generation failed: {e}"},
        )


@router.delete("/batch/{batch_id}")
async def delete_batch_endpoint(batch_id: str):
    if not delete_batch(batch_id):
        return JSONResponse(status_code=404, content={"error": "Batch not found"})
    return {"status": "deleted"}
