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
    fallback_behavior_json = Column(JSON, nullable=True)

    organization = relationship("Organization", back_populates="disciplines")
    analytes = relationship("Analyte", back_populates="discipline", order_by="Analyte.sort_order")
    spreadsheet_columns = relationship("SpreadsheetColumn", back_populates="discipline")
    request_codes = relationship("RequestCode", back_populates="discipline")
    simple_fields = relationship("SimpleField", back_populates="discipline", order_by="SimpleField.sort_order")
    custom_blocks = relationship("CustomBlock", back_populates="discipline")
    computed_recommendations = relationship("ComputedRecommendation", back_populates="discipline")
    triggers = relationship("Trigger", back_populates="discipline")
    report_templates = relationship("ReportTemplate", back_populates="discipline")
    profiles = relationship("ReportProfile", back_populates="discipline", order_by="ReportProfile.sort_order")


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
    profile_id = Column(Integer, ForeignKey("report_profiles.id"), nullable=True)

    discipline = relationship("Discipline", back_populates="request_codes")
    profile = relationship("ReportProfile")


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


class ReportProfile(Base):
    __tablename__ = "report_profiles"
    id = Column(Integer, primary_key=True)
    discipline_id = Column(Integer, ForeignKey("disciplines.id"), nullable=False)
    profile_key = Column(String, nullable=False)
    title = Column(String, nullable=False)
    analyte_keys_json = Column(JSON, nullable=False, default=list)
    section_toggles_json = Column(JSON, nullable=False, default=dict)
    sort_order = Column(Integer, default=0)
    is_default = Column(Boolean, default=False)

    discipline = relationship("Discipline", back_populates="profiles")
    guideline_sets = relationship("GuidelineSet", back_populates="profile", cascade="all, delete-orphan")
    dynamic_columns = relationship("DynamicColumn", back_populates="profile", order_by="DynamicColumn.sort_order", cascade="all, delete-orphan")
    templates = relationship("ReportTemplate", back_populates="profile")


class GuidelineSet(Base):
    __tablename__ = "guideline_sets"
    id = Column(Integer, primary_key=True)
    profile_id = Column(Integer, ForeignKey("report_profiles.id"), nullable=False)
    name = Column(String, nullable=False)

    profile = relationship("ReportProfile", back_populates="guideline_sets")
    values = relationship("GuidelineValue", back_populates="guideline_set", order_by="GuidelineValue.sort_order", cascade="all, delete-orphan")


class GuidelineValue(Base):
    __tablename__ = "guideline_values"
    id = Column(Integer, primary_key=True)
    guideline_set_id = Column(Integer, ForeignKey("guideline_sets.id"), nullable=False)
    analyte_key = Column(String, nullable=False)
    display_value = Column(String, nullable=False)
    sort_order = Column(Integer, default=0)

    guideline_set = relationship("GuidelineSet", back_populates="values")


class DynamicColumn(Base):
    __tablename__ = "dynamic_columns"
    id = Column(Integer, primary_key=True)
    profile_id = Column(Integer, ForeignKey("report_profiles.id"), nullable=False)
    column_key = Column(String, nullable=False)
    header_label = Column(String, nullable=False)
    data_source = Column(String, nullable=False)
    sort_order = Column(Integer, default=0)

    profile = relationship("ReportProfile", back_populates="dynamic_columns")


class ReportTemplate(Base):
    __tablename__ = "report_templates"
    id = Column(Integer, primary_key=True)
    discipline_id = Column(Integer, ForeignKey("disciplines.id"), nullable=False)
    profile_id = Column(Integer, ForeignKey("report_profiles.id"), nullable=True)
    template_html = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    discipline = relationship("Discipline", back_populates="report_templates")
    profile = relationship("ReportProfile", back_populates="templates")


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
