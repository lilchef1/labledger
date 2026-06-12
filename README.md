# LabLedger

A data management and report building platform. Import spreadsheets and report templates in common file formats, map data fields to template placeholders, define custom rules and computations, and generate finished reports.

The platform is built for users at every level of digital literacy. The core workflow (upload data, map fields, export reports) is straightforward and obvious. Users with more technical comfort can build custom computation logic, conditional display rules, and complex rating systems through the configuration layer.

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
- **Deployment:** Docker

## License

AGPL-3.0. See [LICENSE](LICENSE) for details.

## Author

[@lilchef1](https://github.com/lilchef1)
