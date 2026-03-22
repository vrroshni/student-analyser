from __future__ import annotations

import csv
import io
import json
from typing import Any

VALID_DEPARTMENTS = {"CSE", "IT", "ECE", "EEE", "ME", "CE"}

EXPECTED_COLUMNS = ["name", "department"]
for _sem in range(1, 9):
    EXPECTED_COLUMNS.extend([
        f"sem{_sem}_internal",
        f"sem{_sem}_university",
        f"sem{_sem}_attendance",
    ])


def validate_and_parse_csv(
    file_content: bytes,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Parse and validate a CSV file.

    Returns (parsed_rows, errors).  If *errors* is non-empty the caller
    should reject the entire file.
    """
    errors: list[dict[str, Any]] = []
    parsed_rows: list[dict[str, Any]] = []

    # Decode, strip BOM
    try:
        text = file_content.decode("utf-8-sig")
    except UnicodeDecodeError:
        return [], [{"row": 0, "field": "file", "message": "File is not valid UTF-8"}]

    reader = csv.DictReader(io.StringIO(text))

    if reader.fieldnames is None:
        return [], [{"row": 0, "field": "file", "message": "CSV file is empty or has no header row"}]

    # Normalize headers
    normalized = [h.strip().lower() for h in reader.fieldnames]
    expected_set = {c.lower() for c in EXPECTED_COLUMNS}
    actual_set = set(normalized)

    missing = expected_set - actual_set
    if missing:
        return [], [{
            "row": 0,
            "field": "header",
            "message": f"Missing columns: {', '.join(sorted(missing))}",
        }]

    for row_num, raw_row in enumerate(reader, start=2):  # row 1 is header
        # Normalize keys
        row = {k.strip().lower(): (v.strip() if v else "") for k, v in raw_row.items() if k is not None}

        # --- name ---
        name = row.get("name", "")
        if not name:
            errors.append({"row": row_num, "field": "name", "message": "Name is required"})
        elif len(name) > 120:
            errors.append({"row": row_num, "field": "name", "message": "Name must be 120 characters or less"})

        # --- department ---
        dept = row.get("department", "").upper()
        if not dept:
            errors.append({"row": row_num, "field": "department", "message": "Department is required"})
        elif dept not in VALID_DEPARTMENTS:
            errors.append({
                "row": row_num,
                "field": "department",
                "message": f"Invalid department '{dept}'. Must be one of: {', '.join(sorted(VALID_DEPARTMENTS))}",
            })

        # --- semesters ---
        semesters: list[dict[str, Any]] = []
        for sem in range(1, 9):
            raw_int = row.get(f"sem{sem}_internal", "")
            raw_uni = row.get(f"sem{sem}_university", "")
            raw_att = row.get(f"sem{sem}_attendance", "")

            # If all three are empty, semester is not taken
            if raw_int == "" and raw_uni == "" and raw_att == "":
                continue

            # If partially filled
            if raw_int == "" or raw_uni == "" or raw_att == "":
                errors.append({
                    "row": row_num,
                    "field": f"sem{sem}",
                    "message": f"Semester {sem} is partially filled. Provide all three: internal, university, attendance — or leave all empty.",
                })
                continue

            # Parse values
            try:
                internal = int(raw_int)
            except ValueError:
                errors.append({"row": row_num, "field": f"sem{sem}_internal", "message": f"'{raw_int}' is not a valid integer"})
                continue
            try:
                university = int(raw_uni)
            except ValueError:
                errors.append({"row": row_num, "field": f"sem{sem}_university", "message": f"'{raw_uni}' is not a valid integer"})
                continue
            try:
                attendance = float(raw_att)
            except ValueError:
                errors.append({"row": row_num, "field": f"sem{sem}_attendance", "message": f"'{raw_att}' is not a valid number"})
                continue

            # Range checks
            if internal < 0 or internal > 300:
                errors.append({"row": row_num, "field": f"sem{sem}_internal", "message": f"Value {internal} out of range (0-300)"})
            if university < 0 or university > 300:
                errors.append({"row": row_num, "field": f"sem{sem}_university", "message": f"Value {university} out of range (0-300)"})
            if internal + university > 600:
                errors.append({"row": row_num, "field": f"sem{sem}", "message": f"Internal + University ({internal + university}) exceeds 600"})
            if attendance < 0 or attendance > 100:
                errors.append({"row": row_num, "field": f"sem{sem}_attendance", "message": f"Value {attendance} out of range (0-100)"})

            semesters.append({
                "semester": sem,
                "internal_marks": internal,
                "university_marks": university,
                "attendance": attendance,
            })

        if not semesters and not any(e["row"] == row_num and "sem" in e["field"] for e in errors):
            errors.append({"row": row_num, "field": "semesters", "message": "At least one complete semester is required"})

        parsed_rows.append({
            "name": name,
            "department": dept,
            "semesters_json": json.dumps(semesters),
        })

    if not parsed_rows and not errors:
        errors.append({"row": 0, "field": "file", "message": "CSV file has no data rows"})

    return parsed_rows, errors


def generate_template_csv() -> str:
    """Return a sample CSV string with headers and example students."""
    header = ",".join(EXPECTED_COLUMNS)
    rows = [
        "Alice Johnson,CSE,200,210,85,190,220,88,210,230,90,200,200,82,215,225,91,,,,,,,,,",
        "Bob Smith,IT,150,160,75,170,180,80,160,175,78,155,165,72,180,190,85,175,185,82,165,170,79,",
        "Charlie Lee,ECE,220,240,92,230,245,95,,,,,,,,,,,,,,,,,,",
    ]
    return header + "\n" + "\n".join(rows) + "\n"
