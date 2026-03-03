# Student Data Validation Testing Guide

## What Was Fixed

### 1. Added Semantic Validation (Backend Schema)
**File**: `backend/app/schemas/student.py`

Added `_validate_data_quality()` validator that rejects:
- ❌ All semester marks being zero
- ❌ Average percentage below 5% (extremely low)
- ❌ All attendance values at 0%
- ❌ High marks (>70%) with 0% attendance (unrealistic)

### 2. Improved Rule Override Logic (Backend Main)
**File**: `backend/app/main.py`

Added `_assess_data_quality()` function that:
- Detects suspicious data patterns (very low marks, low attendance, identical values)
- Calculates quality score (0.0 to 1.0)
- Adjusts prediction confidence based on quality
- Forces "Needs Attention" for very poor quality data (score < 0.6)
- Caps at "Average" for moderately poor quality (score < 0.8)

### 3. Enhanced Prediction Logic
The `_apply_rule_override()` function now:
- Assesses data quality before making predictions
- Reduces confidence for suspicious data
- Downgrades predictions for bad data (not just upgrades)
- Adds "Quality Check" to model_used field for transparency

## Test Cases

### Case 1: All Marks Zero ❌ SHOULD REJECT
```json
{
  "name": "Test Student",
  "age": 20,
  "department": "CSE",
  "semesters": [
    {"semester": 1, "internal_marks": 0, "university_marks": 0, "attendance": 50}
  ]
}
```
**Expected**: 422 Error - "Invalid data: All semester marks are zero. Please enter actual marks."

### Case 2: Extremely Low Marks (< 5%) ❌ SHOULD REJECT
```json
{
  "name": "Test Student",
  "age": 20,
  "department": "CSE",
  "semesters": [
    {"semester": 1, "internal_marks": 5, "university_marks": 10, "attendance": 50}
  ]
}
```
**Expected**: 422 Error - "Invalid data: Average percentage is 2.5%, which is extremely low..."

### Case 3: All Attendance Zero ❌ SHOULD REJECT
```json
{
  "name": "Test Student",
  "age": 20,
  "department": "CSE",
  "semesters": [
    {"semester": 1, "internal_marks": 200, "university_marks": 200, "attendance": 0}
  ]
}
```
**Expected**: 422 Error - "Invalid data: Attendance cannot be 0% for all semesters..."

### Case 4: High Marks with Zero Attendance ❌ SHOULD REJECT
```json
{
  "name": "Test Student",
  "age": 20,
  "department": "CSE",
  "semesters": [
    {"semester": 1, "internal_marks": 250, "university_marks": 250, "attendance": 0}
  ]
}
```
**Expected**: 422 Error - "Invalid data: Cannot have high marks (>70%) with 0% attendance..."

### Case 5: Low But Valid Marks (10%) ⚠️ SHOULD PASS WITH LOW CONFIDENCE
```json
{
  "name": "Struggling Student",
  "age": 20,
  "department": "CSE",
  "semesters": [
    {"semester": 1, "internal_marks": 30, "university_marks": 30, "attendance": 40}
  ]
}
```
**Expected**: 200 Success - Prediction "Needs Attention" with reduced confidence and "+ Quality Check" in model_used

### Case 6: Valid Good Data ✅ SHOULD PASS
```json
{
  "name": "Good Student",
  "age": 20,
  "department": "CSE",
  "semesters": [
    {"semester": 1, "internal_marks": 200, "university_marks": 210, "attendance": 85}
  ]
}
```
**Expected**: 200 Success - Normal prediction with good confidence

## How to Test

### Option 1: Using the Frontend
1. Start the backend: `cd backend && uvicorn app.main:app --reload`
2. Start the frontend: `cd frontend && npm run dev`
3. Login as teacher or student
4. Try entering bad data in the form (all zeros, very low marks, etc.)
5. Click "Predict Performance"
6. **Expected**: Error message displayed showing validation failure

### Option 2: Using curl (Direct API Testing)
First, get an auth token:
```bash
# Signup/Login as teacher
curl -X POST http://localhost:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123","name":"Test Teacher"}'
```

Then test with bad data:
```bash
# Test Case: All marks zero (should fail)
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "name": "Bad Data",
    "age": 20,
    "department": "CSE",
    "semesters": [
      {"semester": 1, "internal_marks": 0, "university_marks": 0, "attendance": 50}
    ]
  }'
```

### Option 3: Using Python Requests
```python
import requests

# Get token
response = requests.post('http://localhost:8000/auth/signup', json={
    'email': 'test@test.com',
    'password': 'test123',
    'name': 'Test'
})
token = response.json()['access_token']

# Test bad data
response = requests.post(
    'http://localhost:8000/predict',
    headers={'Authorization': f'Bearer {token}'},
    json={
        'name': 'Bad Data',
        'age': 20,
        'department': 'CSE',
        'semesters': [
            {'semester': 1, 'internal_marks': 0, 'university_marks': 0, 'attendance': 50}
        ]
    }
)

print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")
```

## Summary of Changes

### Files Modified:
1. **`backend/app/schemas/student.py`**
   - Added `_validate_data_quality()` model validator
   - Rejects clearly bad/incomplete data with descriptive error messages

2. **`backend/app/main.py`**
   - Added `_assess_data_quality()` function
   - Updated `_apply_rule_override()` to use quality assessment
   - Now downgrades predictions for suspicious data
   - Reduces confidence based on data quality score

### Behavior Changes:
- **Before**: Bad data (all zeros, very low marks) was accepted and could get "Good" or "Average" predictions
- **After**: 
  - Extremely bad data is rejected with 422 validation error
  - Moderately bad data is accepted but gets lower predictions and reduced confidence
  - Model adds "+ Quality Check" to indicate data quality adjustment

## Verification Checklist

- [x] Schema validation added for bad data patterns
- [x] Data quality assessment function implemented
- [x] Rule override logic updated to handle bad data
- [x] Error messages are descriptive and helpful
- [ ] **Manual testing needed**: Start backend and test with frontend/curl
- [ ] **Verify**: All zeros rejected with proper error message
- [ ] **Verify**: Very low marks rejected with proper error message
- [ ] **Verify**: Zero attendance rejected with proper error message
- [ ] **Verify**: Low but valid data gets "Needs Attention" with low confidence
