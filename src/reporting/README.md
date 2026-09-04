# Reporting module (placeholder - Phase 3)

This folder will hold the report-rendering engine:

- `templates/` - one HTML/CSS template per assessment mode family
  (scored: Lower Primary / Upper Primary / JHS; skill-checklist: KG1 / KG2).
- `ReportTemplate.ts` - the shared TypeScript contract every template
  implements (bio-data block, body, sign-off block).
- `pdf/` - jsPDF + html2canvas rendering pipeline (single report and
  batch/whole-class generation).

Intentionally empty in Phase 0 per the acceptance criteria ("Do not
implement functional modules such as ... report generation in this
phase"). See docs/ROADMAP.md, Phase 3.
