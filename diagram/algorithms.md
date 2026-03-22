# Algorithm: Student Performance Prediction & Analysis System

## 1. Registration Phase (Data Collection)

**Input:** Student's academic records and personal details.

**Action:**

- Collect student information: Name, Department
- Gather semester-wise data (up to 8 semesters):
  - Internal marks (out of 300)
  - University marks (out of 300)
  - Attendance percentage (0-100%)
- Optional: Student photo for record-keeping
- Store raw data in the database

---

## 2. Feature Engineering Phase (Data Transformation)

**Input:** Raw student data from registration.

**Action:**

- Extract 24 numerical features:
  - For each semester (1-8):
    - `sem{N}_internal` (internal marks)
    - `sem{N}_university` (university marks)
    - `sem{N}_attendance` (attendance %)
- Handle missing semesters using forward-fill strategy:
  - If student has only completed 4 semesters, replicate semester 4 data for semesters 5-8
  - Prevents zero-filling which would be interpreted as poor performance
- Calculate derived metrics:
  - Average percentage across all semesters
  - Last semester percentage
  - Average attendance

---

## 3. Normalization Phase (Feature Scaling)

**Input:** 24-feature vector with raw values.

**Action:**

- Load pre-trained StandardScaler (fitted during model training)
- Apply standardization formula to each feature:
  ```
  scaled_value = (raw_value - mean) / standard_deviation
  ```
- Transform all features to have:
  - Mean = 0
  - Standard Deviation = 1
- Ensures all features contribute equally regardless of original scale
- Output: Normalized 24-feature vector ready for model input

---

## 4. Model Prediction Phase (Classification)

**Input:** Normalized 24-feature vector + Model type selection (ML or DL).

**Action:**

### If Model Type = ML (Random Forest):
- Pass scaled features to 300 decision trees
- Each tree votes for a performance category
- Aggregate votes using majority voting
- Generate probability distribution across 3 classes:
  - Good
  - Average
  - Needs Attention
- Select class with highest probability

### If Model Type = DL (Neural Network):
- Pass scaled features through neural network:
  - Input Layer: 24 neurons
  - Hidden Layer 1: 32 neurons (ReLU activation)
  - Hidden Layer 2: 16 neurons (ReLU activation)
  - Output Layer: 3 neurons (Softmax activation)
- Output probability distribution across 3 classes
- Select class with highest probability

**Output:** 
- Predicted performance category
- Confidence score (0.0 to 1.0)

---

## 5. Explainability Phase (Feature Contribution Analysis)

**Input:** Scaled features + Trained model + Prediction result.

**Action:**

### For Random Forest (TreeExplainer):
- Use SHAP TreeExplainer for exact computation
- Calculate Shapley values for each of 24 features
- Determine how much each feature contributed to the prediction

### For Neural Network (KernelExplainer):
- Use SHAP KernelExplainer with background samples
- Limit computation: 100 samples, 50 background points
- Calculate approximate Shapley values for each feature

**Output:**
- Feature contribution dictionary: `{feature_name: contribution_value}`
- Positive values push toward predicted class
- Negative values push away from predicted class

**Fallback:** If SHAP computation fails or times out, return zero contributions for all features (graceful degradation).

---

## 6. Quality Assessment Phase (Data Validation)

**Input:** Student data + Prediction result.

**Action:**

- Assess data quality and detect suspicious patterns:

### Check 1: Very Low Performance
- Calculate average percentage across semesters
- **Condition:** If average < 15%
  - Mark as suspicious
  - Quality score × 0.5
- **Condition:** If average < 25%
  - Quality score × 0.7

### Check 2: Very Low Attendance
- Calculate average attendance
- **Condition:** If average attendance < 10%
  - Mark as suspicious
  - Quality score × 0.6
- **Condition:** If average attendance < 30%
  - Quality score × 0.8

### Check 3: Identical Patterns
- Compare all semester records
- **Condition:** If all semesters have identical marks and attendance
  - Mark as suspicious
  - Quality score × 0.7

### Check 4: Insufficient Data with Poor Performance
- **Condition:** If only 1-2 semesters provided AND average < 20%
  - Mark as suspicious
  - Quality score × 0.8

**Output:**
- `is_suspicious` flag (True/False)
- `quality_score` (0.0 to 1.0, where 1.0 = high quality)

---

## 7. Rule-Based Override Phase (Hybrid Validation)

**Input:** Model prediction + Confidence + Student data + Quality assessment.

**Action:**

### Step 7.1: Apply Quality-Based Adjustments
- **Condition:** If quality_score < 0.6 (very poor quality)
  - Force prediction to "Needs Attention"
  - Reduce confidence: `confidence × quality_score`
  - Set model_used: `"{model_name} + Quality Check"`
  
- **Condition:** If 0.6 ≤ quality_score < 0.8 (moderately poor quality)
  - Cap maximum prediction at "Average"
  - If model predicted "Good", downgrade to "Average"
  - Reduce confidence: `confidence × quality_score`
  - Set model_used: `"{model_name} + Quality Check"`

### Step 7.2: Compute Rule-Based Score
- Calculate independent score using weighted formula:
  ```
  score = 0.55 × avg_percentage
        + 0.25 × last_percentage
        + 0.20 × avg_attendance
  ```

### Step 7.3: Determine Rule-Based Label
- **Condition:** If score ≥ 75 → Label = "Good"
- **Condition:** If score ≥ 55 → Label = "Average"
- **Condition:** If score < 55 → Label = "Needs Attention"

### Step 7.4: Apply Override Logic (Upward Only)
- Compare rule-based label with model prediction
- **Condition:** If rule label is HIGHER than model prediction
  - Override: Use rule-based label
  - Set confidence = max(current_confidence, 0.95)
  - Append "+ Rules" to model_used
- **Condition:** If rule label is SAME or LOWER
  - Keep original model prediction

**Output:**
- Final prediction (potentially overridden)
- Final confidence (adjusted)
- Final model_used (with quality/rule annotations)

**Key Principle:** The system can only upgrade predictions (Needs Attention → Average → Good), never downgrade, except for quality issues.

---

## 8. Storage & Alert Phase (Record Keeping)

**Input:** Final prediction + Student data + Feature contributions.

**Action:**

- Create prediction record in database with:
  - Student information (name, department)
  - Semester-wise data (JSON format)
  - Final prediction and confidence
  - Model used (with annotations)
  - Calculated metrics (avg %, last %, avg attendance)
  - Timestamp
  - Associated student_id (if logged in as student)
  - Photo (if uploaded)

- Generate unique record_id for tracking

**Output:**
- Prediction record stored in database
- Record_id returned to frontend

---

## 9. Notification Phase (Result Display)

**Input:** Prediction record + User role (Teacher/Student).

**Action:**

### For Teachers:
- Display complete prediction result:
  - Student details
  - Performance category with confidence
  - Feature contributions (SHAP values)
  - Model used
  - Photo (if available)
- Grant access to full prediction history (all students)
- Enable filtering and analysis across all records

### For Students:
- Display their own prediction result:
  - Performance category with confidence
  - Feature contributions showing which areas need improvement
  - Model used
- Grant access only to their own prediction history
- Restrict access to other students' records

**Alert Triggers:**
- **"Needs Attention"** prediction → Highlight in red, suggest intervention
- **"Average"** prediction → Highlight in yellow, suggest improvement areas
- **"Good"** prediction → Highlight in green, show positive reinforcement

**Output:**
- Visual dashboard with prediction results
- Historical trend analysis (for repeat predictions)
- Actionable insights based on feature contributions

---

## Summary Flow

```
Student Data Input
    ↓
Feature Engineering (24 features)
    ↓
Normalization (StandardScaler)
    ↓
Model Selection (ML or DL)
    ↓
Prediction Generation (3 classes + confidence)
    ↓
SHAP Explainability (feature contributions)
    ↓
Quality Assessment (suspicious pattern detection)
    ↓
Rule-Based Override (hybrid validation)
    ↓
Database Storage (prediction record)
    ↓
Role-Based Notification (Teacher/Student dashboard)
```

---

## Decision Points

| Phase | Decision | Options | Criteria |
|-------|----------|---------|----------|
| Model Selection | Which model to use? | ML (Random Forest) / DL (Neural Network) | User choice via API parameter |
| Quality Check | Is data suspicious? | Yes / No | Multiple quality metrics < thresholds |
| Quality Action | How to adjust? | Force downgrade / Cap prediction / Reduce confidence | quality_score ranges |
| Rule Override | Should override? | Yes (upgrade) / No (keep) | Rule label > Model prediction |
| Access Control | What history to show? | All records / Own records only | User role: Teacher / Student |

---

## Key Algorithms Summary

1. **Random Forest**: Ensemble of 300 decision trees with majority voting
2. **Neural Network**: 3-layer feed-forward network with ReLU + Softmax
3. **SHAP**: Shapley value computation for feature importance
4. **StandardScaler**: Z-score normalization (mean=0, std=1)
5. **Rule-Based Scoring**: Weighted formula combining marks and attendance
6. **Quality Assessment**: Multi-criteria pattern detection algorithm
7. **Hybrid Override**: Upward-only prediction adjustment logic
