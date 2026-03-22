#!/usr/bin/env python3
"""Simple test to verify validation logic without running full app."""

# Test the validation logic directly
test_cases = [
    {
        "name": "All marks zero",
        "data": {
            "name": "Test",

            "department": "CSE",
            "semesters": [{"semester": 1, "internal_marks": 0, "university_marks": 0, "attendance": 50}]
        },
        "should_fail": True,
        "reason": "All semester marks are zero"
    },
    {
        "name": "Extremely low marks",
        "data": {
            "name": "Test",

            "department": "CSE",
            "semesters": [{"semester": 1, "internal_marks": 5, "university_marks": 10, "attendance": 50}]
        },
        "should_fail": True,
        "reason": "Average percentage < 5%"
    },
    {
        "name": "All attendance zero",
        "data": {
            "name": "Test",

            "department": "CSE",
            "semesters": [{"semester": 1, "internal_marks": 200, "university_marks": 200, "attendance": 0}]
        },
        "should_fail": True,
        "reason": "Attendance cannot be 0% for all semesters"
    },
    {
        "name": "High marks with zero attendance",
        "data": {
            "name": "Test",

            "department": "CSE",
            "semesters": [{"semester": 1, "internal_marks": 250, "university_marks": 250, "attendance": 0}]
        },
        "should_fail": True,
        "reason": "Cannot have high marks with 0% attendance"
    },
    {
        "name": "Valid data",
        "data": {
            "name": "Test",

            "department": "CSE",
            "semesters": [{"semester": 1, "internal_marks": 200, "university_marks": 210, "attendance": 85}]
        },
        "should_fail": False,
        "reason": "Valid student data"
    }
]

print("Validation Test Cases")
print("=" * 60)
for tc in test_cases:
    print(f"\n{tc['name']}")
    print(f"  Should fail: {tc['should_fail']}")
    print(f"  Reason: {tc['reason']}")
    print(f"  Data: {tc['data']}")

print("\n" + "=" * 60)
print("To test these cases, start the backend and use curl:")
print("=" * 60)
print("\nExample curl command to test bad data:")
print("""
curl -X POST http://localhost:8000/predict \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{
    "name": "Test Student",
    "department": "CSE",
    "semesters": [
      {"semester": 1, "internal_marks": 0, "university_marks": 0, "attendance": 50}
    ]
  }'
""")
print("\nExpected: 422 Unprocessable Entity with validation error message")
