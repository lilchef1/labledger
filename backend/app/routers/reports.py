from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.post("/upload")
async def upload_spreadsheet(file: UploadFile = File(...)):
    if not file.filename.endswith((".xlsx", ".xls")):
        return JSONResponse(
            status_code=400,
            content={"error": "File must be an Excel spreadsheet (.xlsx or .xls)"},
        )

    contents = await file.read()
    return {
        "filename": file.filename,
        "size_bytes": len(contents),
        "status": "received",
    }


@router.post("/generate")
async def generate_reports():
    return {"status": "not implemented"}
