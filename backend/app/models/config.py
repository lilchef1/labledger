from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Text, JSON,
    ForeignKey, DateTime,
)
from sqlalchemy.orm import relationship
from app.services.database import Base


class Organization(Base):
    __tablename__ = "organizations"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    users = relationship("User", back_populates="organization")
    disciplines = relationship("Discipline", back_populates="organization")
    lab_info = relationship("LabInfo", back_populates="organization", uselist=False)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    username = Column(String, nullable=False, unique=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="user")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    organization = relationship("Organization", back_populates="users")


class Discipline(Base):
    __tablename__ = "disciplines"
    id = Column(Integer, primary_key=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    green_bar_title = Column(String, nullable=False)
    spreadsheet_id_prefix = Column(String, default="")
    report_filename_pattern = Column(String, default="Report - {lab_id}.pdf")

    organization = relationship("Organization", back_populates="disciplines")
    analytes = relationship("Analyte", back_populates="discipline", order_by="Analyte.sort_order")
    spreadsheet_columns = relationship("SpreadsheetColumn", back_populates="discipline")
    request_codes = relationship("RequestCode", back_populates="discipline")
    simple_fields = relationship("SimpleField", back_populates="discipline", order_by="SimpleField.sort_order")
    custom_blocks = relationship("CustomBlock", back_populates="discipline")
    computed_recommendations = relationship("ComputedRecommendation", back_populates="discipline")
    triggers = relationship("Trigger", back_populates="discipline")
    report_template = relationship("ReportTemplate", back_populates="discipline", uselist=False)


class SpreadsheetColumn(Base):
    __tablename__ = "spreadsheet_columns"
    id = Column(Integer, primary_key=True)
    discipline_id = Column(Integer, ForeignKey("disciplines.id"), nullable=False)
    internal_key = Column(String, nullable=False)
    header_name = Column(String, nullable=False)

    discipline = relationship("Discipline", back_populates="spreadsheet_columns")


class Analyte(Base):
    __tablename__ = "analytes"
    id = Column(Integer, primary_key=True)
    discipline_id = Column(Integer, ForeignKey("disciplines.id"), nullable=False)
    key = Column(String, nullable=False)
    display_name = Column(String, nullable=False)
    unit = Column(String, default="")
    color = Column(String, default="#FFC000")
    sort_order = Column(Integer, default=0)
    has_recommendation = Column(Boolean, default=False)
    recommendation_threshold = Column(Float, nullable=True)
    recommendation_operator = Column(String, default="le")
    section_name = Column(String, nullable=True)

    discipline = relationship("Discipline", back_populates="analytes")
    rating_buckets = relationship("RatingBucket", back_populates="analyte", order_by="RatingBucket.sort_order")


class RatingBucket(Base):
    __tablename__ = "rating_buckets"
    id = Column(Integer, primary_key=True)
    analyte_id = Column(Integer, ForeignKey("analytes.id"), nullable=False)
    sort_order = Column(Integer, nullable=False)
    label = Column(String, nullable=False)
    range_text = Column(String, nullable=False)
    upper_breakpoint = Column(Float, nullable=True)

    analyte = relationship("Analyte", back_populates="rating_buckets")


class RequestCode(Base):
    __tablename__ = "request_codes"
    id = Column(Integer, primary_key=True)
    discipline_id = Column(Integer, ForeignKey("disciplines.id"), nullable=False)
    code = Column(String, nullable=False)
    section_key = Column(String, nullable=False)

    discipline = relationship("Discipline", back_populates="request_codes")


class SimpleField(Base):
    __tablename__ = "simple_fields"
    id = Column(Integer, primary_key=True)
    discipline_id = Column(Integer, ForeignKey("disciplines.id"), nullable=False)
    key = Column(String, nullable=False)
    display_name = Column(String, nullable=False)
    unit = Column(String, default="")
    sort_order = Column(Integer, default=0)

    discipline = relationship("Discipline", back_populates="simple_fields")


class CustomBlock(Base):
    __tablename__ = "custom_blocks"
    id = Column(Integer, primary_key=True)
    discipline_id = Column(Integer, ForeignKey("disciplines.id"), nullable=False)
    block_key = Column(String, nullable=False)
    fields_json = Column(JSON, nullable=False)

    discipline = relationship("Discipline", back_populates="custom_blocks")


class ComputedRecommendation(Base):
    __tablename__ = "computed_recommendations"
    id = Column(Integer, primary_key=True)
    discipline_id = Column(Integer, ForeignKey("disciplines.id"), nullable=False)
    analyte_key = Column(String, nullable=False)
    computation_type = Column(String, nullable=False)
    params_json = Column(JSON, nullable=False, default=dict)

    discipline = relationship("Discipline", back_populates="computed_recommendations")


class Trigger(Base):
    __tablename__ = "triggers"
    id = Column(Integer, primary_key=True)
    discipline_id = Column(Integer, ForeignKey("disciplines.id"), nullable=False)
    field = Column(String, nullable=False)
    operator = Column(String, nullable=False)
    threshold = Column(Float, nullable=False)
    action = Column(String, nullable=False)

    discipline = relationship("Discipline", back_populates="triggers")


class ReportTemplate(Base):
    __tablename__ = "report_templates"
    id = Column(Integer, primary_key=True)
    discipline_id = Column(Integer, ForeignKey("disciplines.id"), nullable=False, unique=True)
    template_html = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    discipline = relationship("Discipline", back_populates="report_template")


class LabInfo(Base):
    __tablename__ = "lab_info"
    id = Column(Integer, primary_key=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, unique=True)
    name = Column(String, nullable=False)
    address = Column(String, default="")
    city = Column(String, default="")
    state = Column(String, default="")
    zip = Column(String, default="")
    phone = Column(String, default="")
    email = Column(String, default="")
    logo_paths_json = Column(JSON, default=dict)

    organization = relationship("Organization", back_populates="lab_info")
