import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = os.environ.get(
    "LABLEDGER_DATABASE_URL",
    "sqlite:///labledger.db",
)

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


def init_db():
    from app.models.config import (  # noqa: F401
        Organization, User, Discipline, SpreadsheetColumn,
        Analyte, RatingBucket, RequestCode, SimpleField,
        CustomBlock, ComputedRecommendation, Trigger,
        ReportTemplate, LabInfo,
    )
    Base.metadata.create_all(bind=engine)


def get_session():
    return SessionLocal()
