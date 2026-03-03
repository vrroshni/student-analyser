#!/usr/bin/env python3
"""Test script to verify student data validation works correctly."""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.schemas.student import StudentInput, SemesterInput
from pydantic import ValidationError


def test_case(name: str, data: dict, should_pass: bool = True):
    """Test a validation case."""
    print(f"\n{'='*60}")
    print(f"Test: {name}")
    print(f"Expected: {'PASS' if should_pass else 'FAIL'}")
    print(f"{'='*60}")
    
    try:
        student = StudentInput(**data)
        if should_pass:
            print("✅ PASSED - Data accepted as expected")
            return True
        else:
            print("❌ FAILED - Data should have been rejected but was accepted")
            return False
    except ValidationError as e:
        if not should_pass:
            print("✅ PASSED - Data rejected as expected")
            print(f"Validation error: {e.errors()[0]['msg']}")
            return True
        else:
            print("❌ FAILED - Data should have been accepted but was rejected")
            print(f"Validation error: {e.errors()[0]['msg']}")
            return False
    except Exception as e:
        print(f"❌ FAILED - Unexpected error: {e}")
        return False


def main():
    """Run all validation tests."""
    print("Testing Student Data Validation")
    print("="*60)
    
    results = []
    
    # Test 1: Valid data - should pass
    results.append(test_case(
        "Valid student data",
        {
            "name": "John Doe",
            "age": 20,
            "department": "CSE",
            "semesters": [
                {"semester": 1, "internal_marks": 200, "university_marks": 210, "attendance": 85.0}
            ]
        },
        should_pass=True
    ))
    
    # Test 2: All marks zero - should fail
    results.append(test_case(
        "All marks are zero",
        {
            "name": "Bad Student",
            "age": 20,
            "department": "CSE",
            "semesters": [
                {"semester": 1, "internal_marks": 0, "university_marks": 0, "attendance": 50.0}
            ]
        },
        should_pass=False
    ))
    
    # Test 3: Extremely low marks (< 5%) - should fail
    results.append(test_case(
        "Extremely low marks (< 5%)",
        {
            "name": "Low Marks",
            "age": 20,
            "department": "CSE",
            "semesters": [
                {"semester": 1, "internal_marks": 5, "university_marks": 10, "attendance": 50.0}
            ]
        },
        should_pass=False
    ))
    
    # Test 4: All attendance zero - should fail
    results.append(test_case(
        "All attendance is zero",
        {
            "name": "No Attendance",
            "age": 20,
            "department": "CSE",
            "semesters": [
                {"semester": 1, "internal_marks": 200, "university_marks": 210, "attendance": 0.0}
            ]
        },
        should_pass=False
    ))
    
    # Test 5: High marks with zero attendance - should fail
    results.append(test_case(
        "High marks (>70%) with 0% attendance",
        {
            "name": "Suspicious",
            "age": 20,
            "department": "CSE",
            "semesters": [
                {"semester": 1, "internal_marks": 250, "university_marks": 250, "attendance": 0.0}
            ]
        },
        should_pass=False
    ))
    
    # Test 6: Low but acceptable marks (10%) - should pass
    results.append(test_case(
        "Low but acceptable marks (10%)",
        {
            "name": "Struggling Student",
            "age": 20,
            "department": "CSE",
            "semesters": [
                {"semester": 1, "internal_marks": 30, "university_marks": 30, "attendance": 40.0}
            ]
        },
        should_pass=True
    ))
    
    # Test 7: Marks exceed total - should fail
    results.append(test_case(
        "Marks exceed total (internal + university > 600)",
        {
            "name": "Over Limit",
            "age": 20,
            "department": "CSE",
            "semesters": [
                {"semester": 1, "internal_marks": 300, "university_marks": 301, "attendance": 85.0}
            ]
        },
        should_pass=False
    ))
    
    # Test 8: Duplicate semesters - should fail
    results.append(test_case(
        "Duplicate semesters",
        {
            "name": "Duplicate",
            "age": 20,
            "department": "CSE",
            "semesters": [
                {"semester": 1, "internal_marks": 200, "university_marks": 210, "attendance": 85.0},
                {"semester": 1, "internal_marks": 180, "university_marks": 190, "attendance": 80.0}
            ]
        },
        should_pass=False
    ))
    
    # Test 9: Multiple semesters with good data - should pass
    results.append(test_case(
        "Multiple semesters with good data",
        {
            "name": "Good Student",
            "age": 20,
            "department": "CSE",
            "semesters": [
                {"semester": 1, "internal_marks": 200, "university_marks": 210, "attendance": 85.0},
                {"semester": 2, "internal_marks": 210, "university_marks": 220, "attendance": 87.0},
                {"semester": 3, "internal_marks": 220, "university_marks": 230, "attendance": 90.0}
            ]
        },
        should_pass=True
    ))
    
    # Test 10: Multiple semesters all with zero marks - should fail
    results.append(test_case(
        "Multiple semesters all with zero marks",
        {
            "name": "All Zero",
            "age": 20,
            "department": "CSE",
            "semesters": [
                {"semester": 1, "internal_marks": 0, "university_marks": 0, "attendance": 50.0},
                {"semester": 2, "internal_marks": 0, "university_marks": 0, "attendance": 60.0}
            ]
        },
        should_pass=False
    ))
    
    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    passed = sum(results)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    print(f"Failed: {total - passed}/{total}")
    
    if passed == total:
        print("\n✅ All tests passed!")
        return 0
    else:
        print(f"\n❌ {total - passed} test(s) failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
