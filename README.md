# LabLedger

A low-code platform for turning raw data into finished reports. Upload a spreadsheet and a report template, map the fields together, and generate output. Simple reports need no code at all. Complex data transformations and custom logic scale with the user's technical ability.

LabLedger replaces workflows that typically require programming (R, Python) or complex spreadsheet engineering (Excel formulas, conditional formatting, VBA). The configuration layer exposes all of that functionality through a visual interface: unit conversions, conditional display logic, rating systems, computed fields, template routing. The core workflow is accessible to anyone regardless of technical background, and the platform rewards deeper technical literacy with more powerful customization.

## Status

Early development. Not yet ready for use.

## Core Features

- Import data spreadsheets (Excel, CSV) with automatic column detection and field mapping
- Import report templates (Excel, Word, CSV) with automatic placeholder extraction
- Map data fields to template placeholders with a visual mapping interface
- Rating systems with configurable boundary criteria and visual indicators
- Computation registry for custom formulas and data transformations
- Conditional display rules (triggers) for dynamic report sections
- Recommendation engine driven by configurable thresholds and operators
- Request code routing for multi-template report generation
- PDF export via HTML/CSS templates rendered with WeasyPrint
- Batch processing with individual report review, annotation, and export
- Full admin configuration UI for all of the above

## Tech Stack

- **Backend:** Python, FastAPI, SQLAlchemy
- **Frontend:** React, Next.js, Tailwind CSS, shadcn/ui
- **Database:** SQLite (development), PostgreSQL (production)
- **Reports:** Jinja2 HTML/CSS templates, WeasyPrint PDF rendering

## License

AGPL-3.0. See [LICENSE](LICENSE) for details.

## Author

[@lilchef1](https://github.com/lilchef1)
