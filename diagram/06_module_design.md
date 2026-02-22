# Module Design

## Description

The Student Performance Analyzer is organized into distinct modules, each with a specific responsibility. This document shows the module architecture, dependencies between modules, and the internal structure of the backend.

---

## System Module Architecture

```mermaid
graph TD
    subgraph Frontend["Frontend (Next.js / React)"]
        FE_Page["Page Component\n(page.tsx)"]
        FE_Auth["TeacherAuthCard\n(Login / Signup)"]
        FE_Form["StudentForm\n(Data Input + Validation)"]
        FE_Result["PredictionResult\n(Badge + Charts)"]
        FE_History["HistoryList\n(Past Predictions Table)"]
        FE_API["API Client\n(Axios + JWT Interceptor)"]
    end

    subgraph Backend["Backend (FastAPI)"]
        BE_API["API Server\n(main.py)\nRoute Definitions + CORS"]
        BE_Auth["Auth Module\n(auth.py)\nJWT + bcrypt"]
        BE_Schema["Schemas\n(Pydantic Validation)\nStudentInput, AuthPayloads"]
        BE_Predict["Predictor Service\n(predictor.py)\nML/DL Inference + SHAP"]
        BE_DB["Database Module\n(db.py + models.py + crud.py)\nSQLAlchemy ORM"]
    end

    subgraph Training["ML Training Pipeline"]
        ML_Train["train_ml.py\nRandom Forest Training"]
        DL_Train["train_dl.py\nNeural Network Training"]
        Preprocess["preprocessing.py\nFeature List + Label Maps"]
        DataGen["generate_data.py\nSynthetic Data Generation"]
    end

    subgraph DataStores["Data Stores"]
        SQLite[("SQLite Database\nstudent_performance.db")]
        Artifacts[("Model Artifacts\nrf_model.joblib\ndl_model.keras\nscaler.joblib")]
        Dataset[("Dataset\nstudent_data.csv")]
    end

    %% Frontend internal connections
    FE_Page --> FE_Auth
    FE_Page --> FE_Form
    FE_Page --> FE_Result
    FE_Page --> FE_History
    FE_Auth --> FE_API
    FE_Form --> FE_API
    FE_History --> FE_API

    %% Frontend to Backend
    FE_API -->|"HTTP REST\n+ JWT Bearer Token"| BE_API

    %% Backend internal connections
    BE_API --> BE_Auth
    BE_API --> BE_Schema
    BE_API --> BE_Predict
    BE_API --> BE_DB

    %% Backend to Data Stores
    BE_DB <--> SQLite
    BE_Predict --> Artifacts

    %% Training pipeline
    DataGen --> Dataset
    Dataset --> ML_Train
    Dataset --> DL_Train
    ML_Train --> Artifacts
    DL_Train --> Artifacts
    Preprocess --> ML_Train
    Preprocess --> DL_Train
```

---

## Module Descriptions

### Frontend Modules

| Module | File(s) | Responsibility |
|--------|---------|----------------|
| **Page Component** | `frontend/src/app/page.tsx` | Root application component. Manages authentication state, tab navigation (Predict/History), and logout |
| **TeacherAuthCard** | `frontend/src/components/TeacherAuthCard.tsx` | Login and signup forms with Zod validation. Calls auth API endpoints |
| **StudentForm** | `frontend/src/components/StudentForm.tsx` | Multi-step form for student data entry. Manages dynamic semester list (add/remove). Validates all constraints (age 15-30, marks 0-300, attendance 0-100). Triggers prediction API call |
| **PredictionResult** | `frontend/src/components/PredictionResult.tsx` | Displays prediction outcome: color-coded badge, confidence percentage, SHAP feature contribution charts (Recharts) |
| **HistoryList** | `frontend/src/components/HistoryList.tsx` | Fetches and displays past predictions in a table with sorting by date |
| **API Client** | `frontend/src/lib/api.ts` | Axios instance with JWT Bearer token interceptor. Handles 401 responses by clearing token and triggering logout |

### Backend Modules

| Module | File(s) | Responsibility |
|--------|---------|----------------|
| **API Server** | `backend/app/main.py` | FastAPI application entry point. Defines all REST endpoints, CORS configuration, startup initialization, rule-based override logic, and feature vector construction |
| **Auth Module** | `backend/app/auth.py` | Password hashing (bcrypt via passlib), password verification, JWT token creation (python-jose, HS256, 24h expiry), and token validation dependency |
| **Schemas** | `backend/app/schemas/student.py`, `backend/app/schemas/auth.py` | Pydantic request/response models: `StudentInput`, `SemesterInput`, `PredictionOutput`, `TeacherSignup`, `TeacherLogin`, `TokenResponse` |
| **Predictor Service** | `backend/app/services/predictor.py` | Core ML/DL engine. Lazy-loads model artifacts. Handles feature scaling, model inference (RF predict_proba / Keras predict), and SHAP explanation generation |
| **Database Module** | `backend/app/database/db.py`, `models.py`, `crud.py` | SQLAlchemy engine and session factory, ORM models (Teacher, PredictionRecord), CRUD operations (create/list prediction records, photo management) |

### Training Pipeline Modules

| Module | File(s) | Responsibility |
|--------|---------|----------------|
| **RF Training** | `backend/ml/train_ml.py` | Loads dataset, splits, fits scaler, trains RandomForestClassifier, saves all artifacts |
| **NN Training** | `backend/ml/train_dl.py` | Loads dataset, splits, fits scaler, builds Keras Sequential model, trains for 30 epochs, saves all artifacts + background samples |
| **Preprocessing** | `backend/ml/preprocessing.py` | Defines the 25-feature list and integer-to-label mappings used by both training scripts |
| **Data Generation** | `backend/data/generate_data.py` | Generates synthetic student data (500 rows) with normal distributions and rule-based labeling |

---

## Backend Internal Component Flow

```mermaid
flowchart LR
    Request["HTTP Request"] --> Router["FastAPI Router\n(main.py)"]
    Router --> Auth["Auth Dependency\n(get_current_teacher)"]
    Auth --> JWT["JWT Validation\n(python-jose)"]
    JWT --> DB_Check["DB: Verify\nTeacher Exists"]

    Router --> Validation["Pydantic\nSchema Validation"]
    Validation --> FeatureEng["Feature Engineering\n(_payload_from_student)"]
    FeatureEng --> Predictor["PredictorService\n.predict()"]
    Predictor --> Scaler["StandardScaler\n.transform()"]
    Scaler --> Model{"Model Type?"}
    Model -->|ML| RF["RandomForest\n.predict_proba()"]
    Model -->|DL| NN["Keras Model\n.predict()"]
    RF --> SHAP_RF["SHAP TreeExplainer"]
    NN --> SHAP_NN["SHAP KernelExplainer"]
    SHAP_RF --> RuleOverride["Rule-Based\nOverride"]
    SHAP_NN --> RuleOverride
    RuleOverride --> CRUD["CRUD: Store\nPrediction Record"]
    CRUD --> Response["HTTP Response\n(PredictionOutput)"]
```

---

## Module Communication Protocols

| From | To | Protocol | Data Format |
|------|----|----------|-------------|
| Frontend | Backend | HTTP REST | JSON (with JWT Bearer header) |
| Backend | SQLite | SQLAlchemy ORM | SQL queries via session |
| Backend | Model Artifacts | File I/O | joblib (RF, Scaler), Keras HDF5 (NN), JSON (labels), NumPy (background) |
| Training Scripts | Model Artifacts | File I/O | Same as above (write during training) |
| Training Scripts | Dataset | File I/O | CSV (pandas read/write) |
