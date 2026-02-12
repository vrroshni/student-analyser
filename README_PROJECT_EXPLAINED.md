# Student Performance Analyzer — Full Project Documentation (Viva/College)

This document explains the **entire project** end-to-end for someone who has never seen it before.

It is meant for:
- Students presenting this as a **college mini/major project**
- Viva / project review / demo sessions
- Anyone who needs to understand **what happens inside** the system (not just how to run it)

---

## 1) Project overview

### What problem does this solve?
Educational institutions often want to identify students who may need academic support early.

This project predicts a student’s performance category based on:
- Age
- Marks for up to 8 semesters:
  - Internal marks
  - University marks
  - Attendance

The output is a **performance band**:
- `Needs Attention`
- `Average`
- `Good`

### What does the system provide?
- A **web UI** for teachers to:
  - Sign up / log in
  - Enter a student’s academic history
  - Run predictions using either:
    - A classical ML model (Random Forest)
    - A DL model (Neural Network)
  - View prediction **confidence**
  - View a feature-wise explanation (SHAP-based contribution values)
  - View **history** of previous predictions

---

## 2) Technologies used (tech stack)

### Frontend
- **Next.js** (React)
- **TypeScript**
- **Tailwind CSS**
- **Axios** for calling backend APIs

### Backend
- **FastAPI** (Python)
- **Pydantic** for request/response schemas
- **SQLite** as the database
- **SQLAlchemy** ORM
- Authentication:
  - **JWT** tokens (`python-jose`)
  - Password hashing (`passlib` + `bcrypt`)

### Machine Learning / Deep Learning
- **Scikit-learn**
  - `RandomForestClassifier`
  - `StandardScaler`
- **TensorFlow / Keras**
  - Feed-forward neural network classifier
- **SHAP**
  - Explains model decisions using feature contribution values

---

## 3) Repository structure (what is where)

From the repo root:

- `backend/`
  - `app/`
    - `main.py` — FastAPI entrypoint (routes + app wiring)
    - `services/predictor.py` — loads model artifacts and runs predictions + SHAP explanations
    - `database/` — DB engine, models, and CRUD
    - `auth.py` — JWT + password hashing
    - `schemas.py` — Pydantic models (request/response)
  - `data/`
    - `generate_data.py` — creates synthetic dataset `student_data.csv`
    - `student_data.csv` — generated dataset used for training
  - `ml/`
    - `train_ml.py` — trains Random Forest model + saves artifacts
    - `train_dl.py` — trains Neural Network model + saves artifacts
    - `preprocessing.py` — feature list + label mapping
    - `models/` — saved artifacts used by the backend at runtime
- `frontend/`
  - `src/app/page.tsx` — main UI page
  - `src/lib/api.ts` — axios client; sets Authorization token from localStorage
  - `src/components/` — UI components for forms, auth, results, history

---

## 4) Key concepts explained

### 4.1 Features used by the model
The ML/DL models use a fixed feature vector.

Features (in order):
- `age`
- For semesters `1..8`:
  - `sem{n}_internal`
  - `sem{n}_university`
  - `sem{n}_attendance`

Total features:
- `1 + (8 * 3) = 25` features

### 4.2 Labels (target classes)
The training label is one of:
- `Needs Attention`
- `Average`
- `Good`

Internally, it is encoded as integers:
- `0 -> Needs Attention`
- `1 -> Average`
- `2 -> Good`

### 4.3 Why a scaler is used
Marks and attendance are in different numeric ranges.

A `StandardScaler` converts each feature to a standardized range based on the training data.
This helps:
- Random Forest work more consistently (not strictly required, but still okay)
- Neural Network training converge better

The saved scaler is reused during inference so prediction input is transformed the same way.

---

## 5) Data flow diagram (DFD)

### Level 0 (Context Diagram)

```text
+------------------+        HTTP (JSON)         +---------------------+
|     Teacher      |  <---------------------->  |  Web Application UI  |
| (Browser, UI)    |                            |   (Next.js Frontend) |
+------------------+                            +----------+----------+
                                                           |
                                                           | HTTP (JSON, JWT)
                                                           v
                                                +----------+----------+
                                                |     FastAPI API      |
                                                | (Python Backend)     |
                                                +----------+----------+
                                                           |
                             +-----------------------------+-----------------------------+
                             |                                                           |
                             v                                                           v
                    +--------+---------+                                         +--------+---------+
                    |    SQLite DB     |                                         |   ML/DL Models    |
                    | (History, Users) |                                         | (Saved Artifacts) |
                    +------------------+                                         +------------------+
```

### Level 1 (Detailed Flow)

```text
1) Teacher Signup/Login
Teacher -> Frontend -> POST /auth/signup or /auth/login -> Backend
Backend -> DB (store teacher / verify password)
Backend -> Frontend (JWT token)
Frontend -> localStorage (teacher_access_token)

2) Prediction
Teacher -> Frontend form -> POST /predict?model_type=ml|dl (with JWT)
Backend:
  - Validates JWT
  - Prepares 25-feature vector (fills sem1..sem8)
  - Loads model artifacts (if not already loaded)
  - Scales input
  - Runs model predict_proba
  - Computes SHAP contributions (best-effort)
  - Applies rule-based override (hybrid logic)
  - Stores prediction record in SQLite
Backend -> Frontend (prediction + confidence + contributions)

3) History
Frontend -> GET history endpoint(s)
Backend -> DB -> returns stored prediction records
Frontend -> renders history list
```

---

## 6) Runtime architecture (how inference works)

### 6.1 Backend entrypoint
- `backend/app/main.py` creates the FastAPI app.
- It also initializes the SQLite DB on startup.

### 6.2 Predictor service
`backend/app/services/predictor.py`:
- Loads artifacts from `backend/ml/models/`:
  - `rf_model.joblib`
  - `dl_model.keras`
  - `scaler.joblib`
  - `label_map.json`
  - `background.npy` (for SHAP)

It exposes `predict(payload, model_type)` where `model_type` is `ml` or `dl`.

### 6.3 Hybrid rule override
After ML/DL prediction, the backend computes a “rule score” from the same logic used when generating synthetic labels.

If the rule says the student is clearly in a higher band than the model predicted, the backend upgrades the label and bumps confidence.

Why?
- Because the dataset is synthetic and rule-driven, rules can serve as a stabilizing heuristic.

---

## 7) Model training (how artifacts are produced)

### 7.1 Dataset generation
`backend/data/generate_data.py` creates `backend/data/student_data.csv`.

It uses:
- Random sampling for marks/attendance
- A deterministic scoring rule to create labels (`Good` / `Average` / `Needs Attention`)

### 7.2 ML training
`backend/ml/train_ml.py`:
- Reads `backend/data/student_data.csv`
- Splits train/test
- Fits `StandardScaler`
- Trains `RandomForestClassifier`
- Saves:
  - `rf_model.joblib`
  - `scaler.joblib`
  - `label_map.json`
  - `background.npy`

### 7.3 DL training
`backend/ml/train_dl.py`:
- Reads `backend/data/student_data.csv`
- Splits train/test
- Fits `StandardScaler`
- Builds and trains a small feed-forward neural network
- Saves:
  - `dl_model.keras`
  - `scaler.joblib`
  - `label_map.json`
  - `background.npy`

---

## 8) Authentication (what to explain in viva)

### How login works
- Teacher signs up with email + password.
- Password is stored as a secure hash (bcrypt).
- On login, backend verifies password and returns a **JWT token**.
- Frontend stores token in browser localStorage as `teacher_access_token`.

### How protected endpoints work
- Frontend sends `Authorization: Bearer <token>` on every request.
- Backend validates token and extracts teacher identity.
- If token is invalid/expired, backend returns `401`.
- Frontend clears localStorage token and forces logout.

---

## 9) Common viva / interview questions (with answers)

### Q1) Why did you choose FastAPI?
**Answer:** FastAPI is fast to develop, has automatic request validation using Pydantic, generates interactive API documentation (`/docs`), and is well-suited for ML inference APIs.

### Q2) Why SQLite?
**Answer:** SQLite is lightweight, file-based, and perfect for a college project/demo. It requires no separate DB server installation.

### Q3) What is the difference between your ML and DL models?
**Answer:**
- ML model: Random Forest (ensemble of decision trees). Good baseline, interpretable, works well on structured tabular data.
- DL model: Neural Network (dense layers). Can learn nonlinear patterns; needs more tuning and data but demonstrates deep learning usage.

### Q4) What is SHAP and why did you use it?
**Answer:** SHAP (SHapley Additive exPlanations) explains model predictions by estimating each feature’s contribution to the output. It increases transparency: teachers can see *why* a student was predicted as Good/Average/Needs Attention.

### Q5) What happens if SHAP is not available?
**Answer:** The predictor code is defensive. If SHAP cannot run (missing library or runtime error), it returns `0.0` contributions instead of failing the entire prediction.

### Q6) Why do you use scaling?
**Answer:** Scaling ensures features are normalized and consistent between training and inference. It is especially important for neural networks.

### Q7) How does the system handle missing semesters?
**Answer:** The backend constructs a full 1..8 semester vector. If the user provides fewer semesters, it forward-fills/back-fills from the nearest available semester so predictions remain meaningful.

### Q8) How do you ensure reproducibility?
**Answer:** Training scripts use fixed random seeds (e.g., `random_state=42`) so data split and model training are consistent.

### Q9) What are limitations of this project?
**Answer:**
- The dataset is synthetic, not collected from a real institution.
- Model accuracy may not generalize to real-world student populations.
- SHAP for deep learning can be slow (KernelExplainer), so it is bounded.

### Q10) How can this be improved in the future?
**Answer:**
- Use real datasets (with privacy/security approvals)
- Add more features (assignments, attendance trends, subject-wise breakdown)
- Add model monitoring, drift detection, and periodic retraining
- Deploy using Docker/cloud and add role-based access controls

---

## 10) Demo script (what to show during presentation)

1. Start backend (`uvicorn ...`)
2. Start frontend (`npm run dev`)
3. Open UI
4. Signup teacher account
5. Login
6. Enter student details for multiple semesters
7. Predict with `ml`
8. Predict with `dl`
9. Show confidence + contributions chart
10. Go to History tab and show saved records

---

## 11) API overview (what endpoints exist conceptually)

- `POST /auth/signup`
- `POST /auth/login`
- `POST /predict?model_type=ml|dl`
- `POST /predict-with-photo?model_type=ml|dl`
- History endpoints (used by frontend)

Use the interactive API docs:
- http://localhost:8000/docs

---

## 12) Project files that matter most for explanation

- `backend/app/main.py`
  - Routes, auth protection, DB writes, rule override
- `backend/app/services/predictor.py`
  - Artifact loading, scaling, predict, SHAP
- `backend/ml/train_ml.py` and `backend/ml/train_dl.py`
  - How models are trained and saved
- `backend/data/generate_data.py`
  - How dataset is created
- `frontend/src/lib/api.ts`
  - How the frontend talks to the backend with JWT
- `frontend/src/app/page.tsx`
  - Main UI flow (login -> predict -> history)
