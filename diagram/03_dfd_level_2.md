# Data Flow Diagram — Level 2

## Description

The Level 2 DFD further decomposes each Level 1 process into detailed sub-processes. This level reveals the internal step-by-step workings of each module.

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
  ─ ─ ─ ─ ─►        ←  Dashed Arrow   =  Optional / Conditional Flow
```

---

## Level 2.1 — P1: Authentication Module (Detailed)

```
                          Level 2.1 — Authentication Module


                    Email + Password
                    (+ Name for Signup)
  ┌───────────┐  ──────────────────────────►  ╭──────────────────╮
  │           │                                │  P1.1            │
  │  TEACHER  │                                │  Receive Auth    │
  │           │                                │  Request         │
  └───────────┘                                ╰────────┬─────────╯
        ▲                                               │
        │                                          Raw Payload
        │                                               │
        │                                               ▼
        │                                      ╭──────────────────╮
        │                                      │  P1.2            │
        │                                      │  Validate        │
        │                                      │  Payload         │
        │                                      │  (Pydantic)      │
        │                                      ╰────────┬─────────╯
        │                                               │
        │                                       Validated Data
        │                                               │
        │                                               ▼
        │                                      ╭──────────────────╮
        │                                      │  P1.3            │     Check if
        │                                      │  Query Teacher   │ ──────────────►  ═══════════════
        │                                      │  Record in DB    │                    D1: SQLite
        │                                      │                  │ ◄──────────────    Database
        │                                      ╰────────┬─────────╯   Teacher Record  ═══════════════
        │                                               │                                  ▲
        │                                      Teacher Record                              │
        │                                      or New Entry                                │
        │                                               │                                  │
        │                                               ▼                                  │
        │                                      ╭──────────────────╮      Store Hashed      │
        │                                      │  P1.4            │      Password           │
        │                                      │  Hash / Verify   │ ──────────────────────►│
        │                                      │  Password        │      (Signup)           │
        │                                      │  (bcrypt)        │                        │
        │                                      ╰────────┬─────────╯                        │
        │                                               │
        │                                      Authenticated
        │                                      Teacher ID
        │                                               │
        │                                               ▼
        │                                      ╭──────────────────╮
        │                                      │  P1.5            │
        │                                      │  Generate JWT    │
        │                                      │  Token           │
        │                                      │  (HS256, 24hr)   │
        │                                      ╰────────┬─────────╯
        │                                               │
        │                                      JWT Token
        │                                               │
        │                                               ▼
        │        TokenResponse                 ╭──────────────────╮
        │        {access_token,                │  P1.6            │
        └─────── token_type: "bearer"} ◄────── │  Return Token    │
                                               │  Response        │
                                               ╰──────────────────╯
```

### Figure 3: Level 2.1 — Authentication Module

### Sub-Process Details

| Sub-Process | Description |
|-------------|-------------|
| **P1.1** Receive Auth Request | Receives HTTP POST request at `/auth/signup` or `/auth/login` |
| **P1.2** Validate Payload | Validates request body against `TeacherSignup` or `TeacherLogin` Pydantic schema |
| **P1.3** Query Teacher Record | Queries SQLite database for existing teacher record by email |
| **P1.4** Hash / Verify Password | **Signup:** Hashes password using bcrypt and stores new teacher. **Login:** Verifies submitted password against stored hash |
| **P1.5** Generate JWT Token | Creates JWT token using python-jose (HS256 algorithm, 24-hour expiry, teacher ID as subject) |
| **P1.6** Return Token Response | Returns `TokenResponse` with access token and token type |

---

## Level 2.2 — P2: Prediction Engine (Detailed)

```
                          Level 2.2 — Prediction Engine


                    Student Data + Model Type
                    + JWT Token
  ┌───────────┐  ──────────────────────────────►  ╭──────────────────╮
  │           │                                    │  P2.1            │
  │  TEACHER  │                                    │  Receive         │
  │           │                                    │  Prediction      │
  └───────────┘                                    │  Request         │
        ▲                                          ╰────────┬─────────╯
        │                                                   │
        │                                                   ▼
        │                                          ╭──────────────────╮      Verify
        │                                          │  P2.2            │  ──────────►  ═══════════════
        │                                          │  Validate JWT    │                 D1: SQLite
        │                                          │  Token           │  ◄──────────    Database
        │                                          ╰────────┬─────────╯   Teacher OK  ═══════════════
        │                                                   │                               ▲
        │                                                   ▼                               │
        │                                          ╭──────────────────╮                     │
        │                                          │  P2.3            │                     │
        │                                          │  Parse &         │                     │
        │                                          │  Validate        │                     │
        │                                          │  Student Input   │                     │
        │                                          ╰────────┬─────────╯                     │
        │                                                   │                               │
        │                                          Validated StudentInput                   │
        │                                                   │                               │
        │                                                   ▼                               │
        │                                          ╭──────────────────╮                     │
        │                                          │  P2.4            │                     │
        │                                          │  Build           │                     │
        │                                          │  25-Feature      │                     │
        │                                          │  Vector          │                     │
        │                                          ╰────────┬─────────╯                     │
        │                                                   │                               │
        │                                          25-Feature Dict                          │
        │                                          (age + 8 sem × 3)                        │
        │                                                   │                               │
        │                                                   ▼                               │
        │        ═══════════════                   ╭──────────────────╮                     │
        │          D2: Model       Load Model      │  P2.5            │                     │
        │          Artifacts    ───────────────►   │  Load Model      │                     │
        │        ═══════════════   + Scaler        │  Artifacts       │                     │
        │                          + Labels        │  (Lazy/Cached)   │                     │
        │                          + Background    ╰────────┬─────────╯                     │
        │                                                   │                               │
        │                                                   ▼                               │
        │                                          ╭──────────────────╮                     │
        │                                          │  P2.6            │                     │
        │                                          │  Scale Features  │                     │
        │                                          │  (StandardScaler)│                     │
        │                                          ╰────────┬─────────╯                     │
        │                                                   │                               │
        │                                          Scaled Feature Vector                    │
        │                                                   │                               │
        │                                                   ▼                               │
        │                                          ╭──────────────────╮                     │
        │                                          │  P2.7            │                     │
        │                                          │  Run Model       │                     │
        │                                          │  Inference       │                     │
        │                                          │  *Random Forest  │                     │
        │                                          │  *Neural Network │                     │
        │                                          ╰────────┬─────────╯                     │
        │                                                   │                               │
        │                                          3-Class Probabilities                    │
        │                                                   │                               │
        │                                                   ▼                               │
        │                                          ╭──────────────────╮                     │
        │                                          │  P2.8            │                     │
        │                                          │  Compute SHAP    │                     │
        │                                          │  Explanations    │                     │
        │                                          │  *TreeExplainer  │                     │
        │                                          │  *KernelExplainer│                     │
        │                                          ╰────────┬─────────╯                     │
        │                                                   │                               │
        │                                          Prediction + Confidence                  │
        │                                          + SHAP Values                            │
        │                                                   │                               │
        │                                                   ▼                               │
        │                                          ╭──────────────────╮                     │
        │                                          │  P2.9            │                     │
        │                                          │  Apply Rule-     │                     │
        │                                          │  Based Override  │                     │
        │                                          │  (Upgrade Only)  │                     │
        │                                          ╰────────┬─────────╯                     │
        │                                                   │                               │
        │                                          Final Prediction                         │
        │                                          (possibly overridden)                    │
        │                                                   │                               │
        │                                                   ▼                               │
        │                                          ╭──────────────────╮      Store          │
        │                                          │  P2.10           │      Prediction ────►│
        │                                          │  Store           │      Record          │
        │                                          │  Prediction      │                     │
        │                                          │  Record          │                     │
        │                                          ╰────────┬─────────╯                     │
        │                                                   │
        │                                                   ▼
        │        PredictionOutput              ╭──────────────────╮
        │        {prediction, confidence,      │  P2.11           │
        └─────── model_used, SHAP,     ◄───── │  Return          │
                 contributions, timestamp}     │  Prediction      │
                                               │  Output          │
                                               ╰──────────────────╯
```

### Figure 4: Level 2.2 — Prediction Engine

### Sub-Process Details

| Sub-Process | Description |
|-------------|-------------|
| **P2.1** Receive Prediction Request | Receives HTTP POST at `/predict?model_type=ml` or `dl` with student data in body |
| **P2.2** Validate JWT Token | Validates JWT token using `get_current_teacher` dependency. Extracts teacher ID from token |
| **P2.3** Parse & Validate Student Input | Validates body against `StudentInput` schema (name, age 15–30, department, semesters list) |
| **P2.4** Build 25-Feature Vector | Converts student input to 25 features: `age` + 8 semesters × 3 values (internal, university, attendance). Forward-fills missing semesters |
| **P2.5** Load Model Artifacts | Lazy-loads from disk (cached): `rf_model.joblib` or `dl_model.keras`, plus `scaler.joblib`, `label_map.json`, `background.npy` |
| **P2.6** Scale Features | Applies `StandardScaler.transform()` — normalizes all 25 features to mean=0, std=1 |
| **P2.7** Run Model Inference | **ML:** `predict_proba()` → 3-class probabilities. **DL:** `model.predict()` → softmax probabilities. Picks class with max probability |
| **P2.8** Compute SHAP Explanations | **ML:** SHAP TreeExplainer (exact). **DL:** SHAP KernelExplainer (100 samples, 50 background). Falls back to zeros on failure |
| **P2.9** Apply Rule-Based Override | Score = `0.55×avg% + 0.25×last% + 0.20×avg_att + (age−20)×0.5`. Only upgrades label if rule predicts higher category |
| **P2.10** Store Prediction Record | Stores complete record in SQLite: student info, computed averages, prediction, confidence, model used |
| **P2.11** Return Prediction Output | Returns `PredictionOutput` with record_id, prediction, confidence, model_used, feature_contributions, timestamp |

---

## Level 2.3 — P3: History Service (Detailed)

```
                          Level 2.3 — History Service


                    GET /history
                    + limit parameter
                    + JWT Token
  ┌───────────┐  ──────────────────────────────►  ╭──────────────────╮
  │           │                                    │  P3.1            │
  │  TEACHER  │                                    │  Receive         │
  │           │                                    │  History         │
  └───────────┘                                    │  Request         │
        ▲                                          ╰────────┬─────────╯
        │                                                   │
        │                                                   ▼
        │                                          ╭──────────────────╮      Verify
        │                                          │  P3.2            │  ──────────►  ═══════════════
        │                                          │  Validate JWT    │                 D1: SQLite
        │                                          │  Token           │  ◄──────────    Database
        │                                          ╰────────┬─────────╯   Teacher OK  ═══════════════
        │                                                   │                               ▲
        │                                                   ▼                               │
        │                                          ╭──────────────────╮      SELECT *       │
        │                                          │  P3.3            │      FROM records   │
        │                                          │  Query           │  ──────────────────►│
        │                                          │  Prediction      │      ORDER BY       │
        │                                          │  Records         │      created_at     │
        │                                          │                  │  ◄──────────────────│
        │                                          ╰────────┬─────────╯   Result Rows       │
        │                                                   │
        │                                          Raw DB Records
        │                                                   │
        │                                                   ▼
        │                                          ╭──────────────────╮
        │                                          │  P3.4            │
        │                                          │  Serialize &     │
        │                                          │  Format          │
        │                                          │  Records         │
        │                                          │  (Parse JSON,    │
        │                                          │   Format Dates)  │
        │                                          ╰────────┬─────────╯
        │                                                   │
        │                                          Formatted Records
        │                                                   │
        │                                                   ▼
        │        Array of Prediction               ╭──────────────────╮
        │        Records (JSON)                    │  P3.5            │
        │        [name, dept, age,                 │  Return          │
        └─────── prediction, confidence,   ◄───── │  History         │
                 model, avg%, att%, date]          │  Response        │
                                                   ╰──────────────────╯
```

### Figure 5: Level 2.3 — History Service

### Sub-Process Details

| Sub-Process | Description |
|-------------|-------------|
| **P3.1** Receive History Request | Receives HTTP GET at `/history` with optional `limit` query parameter (default 50) |
| **P3.2** Validate JWT Token | Validates JWT to ensure the requester is an authenticated teacher |
| **P3.3** Query Prediction Records | Queries `prediction_records` table: `ORDER BY created_at DESC LIMIT n` |
| **P3.4** Serialize & Format Records | Serializes DB records to JSON, parses `semesters_json` field, formats datetime fields |
| **P3.5** Return History Response | Returns array of records with all fields: name, department, age, prediction, confidence, model used, avg %, attendance, timestamp |

---

## Summary of All DFD Levels

```
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                                                                         │
  │  Level 0    ┌─────────┐              ╭──────────╮                      │
  │  (Context)  │ TEACHER │ ──────────► ( P0: System ) ──────► Data Stores │
  │             └─────────┘              ╰──────────╯                      │
  │                                            │                            │
  │                                    Decompose into                       │
  │                                            │                            │
  │  Level 1              ╭─────╮    ╭─────╮    ╭─────╮                    │
  │  (3 Processes)       ( P1   )  ( P2   )  ( P3   )                    │
  │                       ╰─────╯    ╰─────╯    ╰─────╯                    │
  │                          │          │          │                        │
  │                   Decompose   Decompose   Decompose                    │
  │                          │          │          │                        │
  │  Level 2           P1.1-P1.6  P2.1-P2.11  P3.1-P3.5                  │
  │  (Sub-processes)    (6 steps)  (11 steps)  (5 steps)                  │
  │                                                                         │
  └─────────────────────────────────────────────────────────────────────────┘
```
