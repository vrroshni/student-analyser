# Class & Component Diagram

## Description

This document shows the backend class structure (Python classes with methods and attributes) and the frontend React component hierarchy.

---

## Backend Class Diagram

```mermaid
classDiagram
    class FastAPIApp {
        +read_root() dict
        +health_check() dict
        +teacher_signup(payload, db) TokenResponse
        +teacher_login(payload, db) TokenResponse
        +predict(student, model_type, db) PredictionOutput
        +predict_with_photo(...) PredictionOutput
        +history(limit, db) List~dict~
        +get_record_photo(record_id, db) Response
        -_payload_from_student(student) dict
        -_rule_score(student) float
        -_rule_label(score) str
        -_apply_rule_override(student, pred, conf, model) tuple
    }

    class PredictorService {
        -models_dir : Path
        -_ml_model : RandomForestClassifier
        -_dl_model : KerasModel
        -_ml_scaler : StandardScaler
        -_dl_scaler : StandardScaler
        -_ml_label_map : Dict
        -_dl_label_map : Dict
        -_ml_background : ndarray
        -_dl_background : ndarray
        +predict(payload, model_type) PredictionResult
        -_ensure_ml_loaded() void
        -_ensure_dl_loaded() void
        -_vectorize(payload) ndarray
        -_predict_ml(payload) PredictionResult
        -_predict_dl(payload) PredictionResult
        -_explain_ml(x_scaled) Dict
        -_explain_dl(x_scaled) Dict
    }

    class PredictionResult {
        +prediction : str
        +confidence : float
        +model_used : str
        +contributions : Dict
    }

    class AuthModule {
        +hash_password(password) str
        +verify_password(password, hash) bool
        +create_access_token(teacher_id) str
        +get_current_teacher(token, db) Teacher
    }

    class Teacher {
        +id : int
        +email : str
        +password_hash : str
        +name : str
        +created_at : datetime
    }

    class PredictionRecord {
        +id : int
        +name : str
        +department : str
        +semesters_json : str
        +age : int
        +avg_percentage : float
        +last_percentage : float
        +avg_attendance : float
        +prediction : str
        +confidence : float
        +model_used : str
        +photo : bytes
        +photo_content_type : str
        +photo_filename : str
        +created_at : datetime
    }

    class StudentInput {
        +name : str
        +age : int
        +department : str
        +semesters : List~SemesterInput~
    }

    class SemesterInput {
        +semester : int
        +internal_marks : int
        +university_marks : int
        +attendance : float
    }

    class TeacherSignup {
        +email : str
        +password : str
        +name : str
    }

    class TeacherLogin {
        +email : str
        +password : str
    }

    class TokenResponse {
        +access_token : str
        +token_type : str
    }

    class PredictionOutput {
        +record_id : int
        +prediction : str
        +confidence : float
        +model_used : str
        +feature_contributions : List~dict~
        +timestamp : str
    }

    %% Relationships
    FastAPIApp --> PredictorService : uses
    FastAPIApp --> AuthModule : depends on
    FastAPIApp --> Teacher : queries
    FastAPIApp --> PredictionRecord : creates and reads
    FastAPIApp --> StudentInput : validates input
    FastAPIApp --> PredictionOutput : returns

    PredictorService --> PredictionResult : returns

    StudentInput --> SemesterInput : contains 1..8

    FastAPIApp --> TeacherSignup : validates signup
    FastAPIApp --> TeacherLogin : validates login
    FastAPIApp --> TokenResponse : returns auth token
```

---

## Frontend Component Hierarchy

```mermaid
flowchart TD
    subgraph Browser["Browser (localhost:3000)"]
        Layout["<b>RootLayout</b>\n(layout.tsx)\nHTML + Body wrapper"]
        Page["<b>Page</b>\n(page.tsx)\nMain App Component\nManages auth state + tabs"]

        Auth["<b>TeacherAuthCard</b>\nLogin / Signup Forms\nZod validation"]
        Form["<b>StudentForm</b>\nStudent Data Input\nDynamic semester list\nModel type selection\nPhoto upload"]
        Result["<b>PredictionResult</b>\nPrediction badge (color-coded)\nConfidence percentage\nSHAP feature chart\nExplanation text"]
        History["<b>HistoryList</b>\nPast predictions table\nSorted by date\nColor-coded badges"]

        API["<b>api.ts</b>\nAxios Instance\nJWT Bearer interceptor\n401 → auto logout"]

        subgraph UIComponents["Shadcn UI Components"]
            Card["Card"]
            Button["Button"]
            Input["Input"]
            Badge["Badge"]
            Tabs["Tabs"]
            Table["Table"]
        end
    end

    Layout --> Page
    Page -->|"Not authenticated"| Auth
    Page -->|"Predict tab"| Form
    Page -->|"Predict tab"| Result
    Page -->|"History tab"| History

    Auth --> API
    Form --> API
    History --> API

    Auth --> Card
    Auth --> Input
    Auth --> Button

    Form --> Card
    Form --> Input
    Form --> Button

    Result --> Card
    Result --> Badge
    Result --> Charts["Recharts\n(BarChart)"]

    History --> Table
    History --> Badge

    API -->|"HTTP + JWT"| Backend["FastAPI Backend\n(Port 8000)"]
```

---

## Component Details

### Frontend Components

| Component | File | Props / State | Responsibility |
|-----------|------|--------------|----------------|
| **Page** | `page.tsx` | State: `token`, `activeTab` | Root component. Checks localStorage for JWT. Renders auth card or main interface with tabs |
| **TeacherAuthCard** | `TeacherAuthCard.tsx` | Props: `onLogin(token)`. State: `mode` (login/signup), form fields, `error`, `loading` | Handles teacher authentication. Validates with Zod. Calls POST `/auth/signup` or `/auth/login` |
| **StudentForm** | `StudentForm.tsx` | Props: `token`, `onResult(data)`. State: `semesters[]`, `modelType`, `loading` | Multi-field form with dynamic semester management. Validates constraints. Calls POST `/predict` |
| **PredictionResult** | `PredictionResult.tsx` | Props: `result` (prediction data) | Renders prediction badge (green/yellow/red), confidence %, model name, and SHAP contribution bar chart |
| **HistoryList** | `HistoryList.tsx` | Props: `token`. State: `records[]`, `loading` | Fetches and displays prediction history table from GET `/history` |
| **api.ts** | `lib/api.ts` | Axios instance | Configured with base URL (localhost:8000). Interceptor adds JWT Bearer header. On 401, clears token and dispatches logout event |

### Backend Classes

| Class | File | Key Methods | Responsibility |
|-------|------|-------------|----------------|
| **FastAPIApp** | `main.py` | `predict()`, `teacher_signup()`, `teacher_login()`, `history()` | Route handler with all endpoint logic, feature engineering, and rule override |
| **PredictorService** | `services/predictor.py` | `predict()`, `_predict_ml()`, `_predict_dl()`, `_explain_ml()`, `_explain_dl()` | Lazy-loads models, runs inference, generates SHAP explanations |
| **AuthModule** | `auth.py` | `hash_password()`, `verify_password()`, `create_access_token()`, `get_current_teacher()` | JWT token management and password hashing |
| **Teacher** | `database/models.py` | — (ORM model) | SQLAlchemy model for the `teachers` table |
| **PredictionRecord** | `database/models.py` | — (ORM model) | SQLAlchemy model for the `prediction_records` table |
| **StudentInput** | `schemas/student.py` | — (Pydantic model) | Request validation for prediction endpoints |
| **PredictionOutput** | `schemas/student.py` | — (Pydantic model) | Response schema for prediction results |
