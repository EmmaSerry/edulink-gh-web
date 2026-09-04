"""
Static verification that the KG report template never references any
scored-level concept (total, average, grade, position/ranking,
percentage) anywhere in its source - the brief's "Critical Instruction"
requires KG reports to show Gold/Silver/Bronze/X/O ratings and comments
ONLY. Run: python3 scripts/verify_kg_no_calculations.py
"""
import re
import sys

FORBIDDEN_PATTERNS = [
    r"\btotal\b", r"\baverage\b", r"\bgrade\b", r"\bposition\b",
    r"\brank", r"\bpercentage\b", r"\bscore\b", r"\bsba\b", r"\bexam\b",
]

FILES_TO_CHECK = [
    "src/reporting/templates/KGReportTemplate.tsx",
]

failures = []
for path in FILES_TO_CHECK:
    with open(path, encoding="utf-8") as f:
        content = f.read()
    # Strip comments (block and line) before checking - the file's own
    # documentation comments legitimately mention these words while
    # explaining that they must NOT appear; only executable code matters.
    code_only = re.sub(r"/\*[\s\S]*?\*/", "", content)
    code_only = re.sub(r"//.*", "", code_only)

    for pattern in FORBIDDEN_PATTERNS:
        matches = re.findall(pattern, code_only, re.IGNORECASE)
        if matches:
            failures.append(f"{path}: found forbidden token matching /{pattern}/ ({len(matches)} occurrence(s))")

if failures:
    print(f"{len(failures)} PROBLEM(S) FOUND:")
    for f_ in failures:
        print(" -", f_)
    sys.exit(1)
else:
    print(f"Checked {len(FILES_TO_CHECK)} file(s). No scored-level concepts (total/average/grade/position/rank/percentage/score/sba/exam) found in KG template code.")
