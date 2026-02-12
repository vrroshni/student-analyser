# Module-wise Split Explanation — Student Performance Analyzer

This document explains the project **module by module**, including what each module does, how it interacts with other modules, and what to say during demo/viva.

---

## 1) High-level modules

- **Frontend (Next.js)**
  - UI for teacher authentication, entering student details, triggering predictions, and viewing history.
- **Backend (FastAPI)**
  - REST API providing authentication, prediction endpoints, and history endpoints.
- **Database (SQLite + SQLAlchemy)**
  - Stores teacher accounts and prediction history.
- **ML/DL Training**
  - Scripts that generate data and train models.
- **Inference + Explainability**
  - Loads saved models and produces predictions + feature contributions (SHAP).

---

## 2) Frontend module (Next.js)

**Folder:** `frontend/`

### 2.1 Entry points

- **Page / UI root**: `frontend/src/app/page.tsx`
  - Controls the main UI flow:
    - if no JWT token → show authentication card
    - else → show prediction and history tabs

### 2.2 API client layer

- **Axios client**: `frontend/src/lib/api.ts`
  - `baseURL` is `http://localhost:8000`
  - Attaches `Authorization: Bearer <token>` automatically if token exists in `localStorage`.
  - If API returns `401`, it:
    - clears token from localStorage
    - triggers a `teacher:logout` event

**What to say in viva:**
- “Frontend doesn’t store passwords. It only stores the JWT token securely in localStorage for session-like behavior.”
- “Axios interceptors automatically attach the token and handle logout on unauthorized responses.”

### 2.3 UI components (core)

**Folder:** `frontend/src/components/`

- `TeacherAuthCard.tsx`
  - Signup + login UI.
  - Calls backend auth endpoints and stores token on success.

- `StudentForm.tsx`
  - Collects student details:
    - age, department, semesters
    - model selection (ML/DL)
  - Calls prediction endpoint.

- `PredictionResult.tsx`
  - Displays:
    - predicted label
    - confidence
    - model used
    - contributions chart/table (feature explainability)

- `HistoryList.tsx`
  - Shows previously stored prediction records from the backend.

**What to say in viva:**
- “The UI is separated into components for authentication, prediction input, prediction output, and history so it’s maintainable.”

---

## 3) Backend module (FastAPI)

**Folder:** `backend/`

### 3.1 Main API application

- **FastAPI entrypoint**: `backend/app/main.py`
  - Creates the FastAPI app.
  - Enables CORS for `http://localhost:3000`.
  - Initializes database on startup.
  - Provides endpoints for:
    - auth
    - predictions
    - history

**Key responsibilities inside `main.py`:**
- Validates input using Pydantic schemas.
- Enforces authentication using dependency injection.
- Calls the predictor service.
- Stores prediction records in the DB.
- Returns a structured response to frontend.

### 3.2 Schemas (Request/Response models)

- **Folder:** `backend/app/schemas/`
  - Contains Pydantic models used to validate inputs and format outputs.

**What to say in viva:**
- “Pydantic schemas ensure only valid data enters the ML pipeline. This avoids runtime errors and makes API responses consistent.”

---

## 4) Authentication module

- **File:** `backend/app/auth.py`

### What it does
- Password hashing (bcrypt)
- Password verification
- JWT token creation
- “Current user” dependency for protected routes

### Data flow
- Signup/Login endpoints call auth utilities.
- Frontend stores JWT token and sends it back for protected routes.

**What to say in viva:**
- “We use JWT so the backend remains stateless — every request carries authentication proof.”

---

## 5) Database module (SQLite + SQLAlchemy)

**Folder:** `backend/app/database/`

### 5.1 DB connection + migrations

- **File:** `db.py`
  - SQLite connection string: `sqlite:///./student_performance.db`
  - Creates tables automatically.
  - Performs lightweight migrations via `PRAGMA table_info` checks.

### 5.2 ORM models

- **File:** `models.py`
  - Defines:
    - `Teacher`
    - `PredictionRecord` (stores prediction metadata and semester summary values)

### 5.3 CRUD functions

- **File:** `crud.py`
  - Create prediction record
  - Fetch prediction history
  - Attach photo (optional)

**What to say in viva:**
- “SQLite is used because it’s lightweight and works offline; SQLAlchemy keeps the DB layer clean and modular.”

---

## 6) ML/DL module (training + artifacts)

**Folder:** `backend/ml/`

### 6.1 Dataset generation

- **Script:** `backend/data/generate_data.py`
  - Generates `backend/data/student_data.csv`
  - Uses random sampling + a deterministic rule to assign labels.

### 6.2 ML training (Random Forest)

- **Script:** `backend/ml/train_ml.py`
  - Reads CSV
  - Splits train/test
  - Fits `StandardScaler`
  - Trains `RandomForestClassifier`
  - Saves artifacts to `backend/ml/models/`:
    - `rf_model.joblib`
    - `scaler.joblib`
    - `label_map.json`
    - `background.npy`

### 6.3 DL training (Neural Network)

- **Script:** `backend/ml/train_dl.py`
  - Reads CSV
  - Splits train/test
  - Fits `StandardScaler`
  - Trains a feed-forward neural network (Keras)
  - Saves artifacts to `backend/ml/models/`:
    - `dl_model.keras`
    - `scaler.joblib`
    - `label_map.json`
    - `background.npy`

**What to say in viva:**
- “Both ML and DL use the same feature vector. We save the scaler so inference uses the exact same transformation as training.”

---

## 7) Inference + Explainability module

**Folder:** `backend/app/services/`

### Predictor service

- **File:** `backend/app/services/predictor.py`

**Responsibilities:**
- Loads model artifacts lazily (only once) from `backend/ml/models/`.
- Converts request payload into the correct 25-feature vector order.
- Scales the input using the saved scaler.
- Produces prediction probabilities.
- Maps predicted class index → label string.
- Computes feature contributions using SHAP:
  - TreeExplainer for Random Forest
  - KernelExplainer for neural network (bounded for speed)

**Failure behavior:**
- If artifacts are missing → returns a clear message like:
  - “Run: `python backend/ml/train_ml.py`”
  - “Run: `python backend/ml/train_dl.py`”
- If SHAP fails → prediction still works; contributions fall back to `0.0`.

---

## 8) Cross-module data flow (quick summary)

- UI collects student inputs → calls backend `/predict` with JWT
- Backend validates JWT + input → builds full feature vector
- Predictor loads model → predicts → explains
- Backend stores record in SQLite
- Backend returns prediction + contributions
- UI renders output + history

---

## 9) Viva-ready “one-minute explanation”

“This project is a full-stack student performance prediction system. Teachers authenticate using JWT. The frontend sends student semester marks and attendance to a FastAPI backend. The backend converts inputs into a fixed feature vector and runs either a Random Forest ML model or a Neural Network DL model, both trained on a generated dataset. The system stores each prediction in SQLite and shows prediction history. To make results explainable, we compute SHAP contributions so the teacher can see which semester marks/attendance influenced the prediction.”
