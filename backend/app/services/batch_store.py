import uuid
from datetime import datetime, timezone


_batches: dict[str, dict] = {}


def create_batch(filename: str, samples: list[dict], discipline_id: int = 1) -> str:
    batch_id = str(uuid.uuid4())
    reports = {}

    for sample in samples:
        lab_id = str(sample.get("Lab ID", "unknown"))
        reports[lab_id] = {
            "sample": sample,
            "recommendations": {},
            "comments": "",
            "status": "pending_review",
        }

    _batches[batch_id] = {
        "id": batch_id,
        "filename": filename,
        "discipline_id": discipline_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "report_count": len(reports),
        "reports": reports,
    }

    return batch_id


def get_batch(batch_id: str) -> dict | None:
    return _batches.get(batch_id)


def get_report(batch_id: str, lab_id: str) -> dict | None:
    batch = _batches.get(batch_id)
    if batch is None:
        return None
    return batch["reports"].get(lab_id)


def update_report(batch_id: str, lab_id: str, updates: dict) -> dict | None:
    report = get_report(batch_id, lab_id)
    if report is None:
        return None

    if "recommendations" in updates:
        report["recommendations"].update(updates["recommendations"])
    if "comments" in updates:
        report["comments"] = updates["comments"]
    if "status" in updates:
        report["status"] = updates["status"]

    return report


def list_batches() -> list[dict]:
    return [
        {
            "id": b["id"],
            "filename": b["filename"],
            "discipline_id": b["discipline_id"],
            "created_at": b["created_at"],
            "report_count": b["report_count"],
        }
        for b in _batches.values()
    ]


def delete_batch(batch_id: str) -> bool:
    if batch_id in _batches:
        del _batches[batch_id]
        return True
    return False
