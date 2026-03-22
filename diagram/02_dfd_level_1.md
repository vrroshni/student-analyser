# Data Flow Diagram — Level 1

## Description

The Level 1 DFD decomposes the Student Performance Analyzer system (P0) into three major sub-processes: Authentication (P1), Prediction Engine (P2), and History Service (P3). It shows how data flows between the teacher and student actors, each process, and the data stores.

---

## DFD Symbols Used

```
  ┌──────────┐
  │          │       ←  Rectangle      =  External Entity
  └──────────┘

     ╭──────╮
    (        )       ←  Circle/Oval    =  Process
     ╰──────╯

  ═══════════════
    Data Store       ←  Open Rectangle =  Data Store
  ═══════════════

  ──────────►        ←  Arrow          =  Data Flow
```

---

## Level 1 DFD

```
                            Student Performance Analyzer — Level 1 DFD


                                                  Email + Password
                                                  (+ Name for Signup)
  ┌───────────┐  ─────────────────────────────────────────────────────►  ╭──────────────────╮
  │           │                                                          │                  │
  │           │                          JWT Token / Error               │   P1              │
  │           │  ◄─────────────────────────────────────────────────────  │   Authentication  │
  │           │                                                          │   Module          │
  │           │                                                          ╰────────┬─────────╯
  │           │                                                                   │
  │           │                                                          Create / Verify
  │           │                                                          User Record
  │           │                                                                   │
  │           │                                                                   ▼
  │           │                                                          ═══════════════════
  │           │                                                            D1: SQLite
  │           │                                                            Database
  │ TEACHER/  │                                                          ═══════════════════
  │ STUDENT   │                                                          
  │           │                                                                   ▲
  │ (External │           Student Data                                            │
  │  Entity)  │           + Model Type (ML/DL)                            Store / Query
  │           │           + JWT Token                                     Prediction
  │           │  ─────────────────────────────────────────────────────►   Records
  │           │                                                          ╭──────────────────╮
  │           │           Prediction Label                               │                  │
  │           │           (Good / Average / Needs Attention)             │   P2              │
  │           │           + Confidence Score                             │   Prediction      │
  │           │           + SHAP Feature Contributions                   │   Engine          │
  │           │  ◄─────────────────────────────────────────────────────  │                  │
  │           │                                                          ╰────────┬─────────╯
  │           │                                                                   │
  │           │                                                          Load RF/NN Model
  │           │                                                          + Scaler + Labels
  │           │                                                          + Background
  │           │                                                                   │
  │           │                                                                   ▼
  │           │                                                          ═══════════════════
  │           │                                                            D2: Model
  │           │                                                            Artifacts
  │           │                                                          ═══════════════════
  │           │
  │           │           History Request
  │           │           + JWT Token
  │           │  ─────────────────────────────────────────────────────►  ╭──────────────────╮
  │           │                                                          │                  │
  │           │           List of Past                                   │   P3              │
  │           │           Prediction Records                             │   History         │
  │           │  ◄─────────────────────────────────────────────────────  │   Service         │
  └───────────┘                                                          ╰────────┬─────────╯
                                                                                  │
                                                                         Query Prediction
                                                                         Records
                                                                         (ORDER BY date)
                                                                                  │
                                                                                  ▼
                                                                         ═══════════════════
                                                                           D1: SQLite
                                                                           Database
                                                                         ═══════════════════
```


---

## Process Descriptions

| Process | API Routes | Responsibility |
|---------|------------|----------------|
| **P1: Authentication Module** | `POST /auth/signup`, `POST /auth/login`, `POST /auth/student/signup`, `POST /auth/student/login` | Handles teacher and student registration and login. Validates credentials, hashes passwords with bcrypt, issues JWT tokens (HS256, 24-hour expiry) containing subject id and role |
| **P2: Prediction Engine** | `POST /predict`, `POST /predict-with-photo` | Core prediction pipeline. Validates JWT, constructs 25-feature vector, runs ML or DL inference, generates SHAP explanations, applies rule-based override, stores result. If the requester is a student, the record is stored with `student_id` ownership |
| **P3: History Service** | `GET /history`, `GET /records/{id}/photo` | Retrieves past prediction records ordered by date. Teachers can view all records. Students can view only their own records (scoped by `student_id`) |

---

## Data Flow Details

| # | From | To | Data Flow Label | Description |
|---|------|----|-----------------|-------------|
| 1 | Teacher/Student | P1 | Email + Password (+ Name) | User submits credentials for signup or login |
| 2 | P1 | Teacher/Student | JWT Token / Error | Returns JWT access token on success, or error message on failure |
| 3 | P1 | D1 | Create / Verify User Record | Creates new teacher/student record (signup) or queries existing user for password verification (login) |
| 4 | Teacher/Student | P2 | Student Data + Model Type + JWT | Submits student data (name, dept, semesters) with model type (ML/DL) and authentication token |
| 5 | P2 | Teacher/Student | Prediction + Confidence + SHAP | Returns prediction label, confidence score, model used, and per-feature SHAP contributions |
| 6 | P2 | D1 | Store Prediction Record | Stores the complete prediction record including computed averages, prediction, and confidence |
| 7 | D2 | P2 | Load Models + Scaler | Loads pre-trained model artifacts (Random Forest or Neural Network, StandardScaler, label map, background) |
| 8 | Teacher/Student | P3 | History Request + JWT | Requests prediction history with JWT authentication and optional limit parameter |
| 9 | P3 | Teacher/Student | List of Prediction Records | Returns ordered list of past prediction records (newest first). Students receive only their own records |
| 10 | P3 | D1 | Query Prediction Records | Queries prediction_records table ordered by creation date with limit (and `student_id` filter for students) |
