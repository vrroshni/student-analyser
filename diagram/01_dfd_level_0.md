# Data Flow Diagram — Level 0 (Context Diagram)

## Description

The Level 0 DFD (Context Diagram) provides the highest-level overview of the Student Performance Analyzer system. It shows the system as a single process, the external entity (Teacher) that interacts with it, and the data stores it depends on.

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

## Level 0 DFD — Context Diagram

```
                          Student Performance Analyzer — Level 0 DFD


     ┌───────────┐         Signup / Login              ╭─────────────────────────╮
     │           │         Credentials                 │                         │
     │           │ ─────────────────────────────────►  │                         │
     │           │         Student Academic             │     P0                  │
     │  TEACHER  │         Data (Name, Age,            │     Student              │
     │           │         Dept, 8 Semesters)           │     Performance          │
     │ (External │         Model Selection              │     Analyzer             │
     │  Entity)  │         (ML / DL)                    │     System               │
     │           │                                      │                         │
     │           │         JWT Token                    │                         │
     │           │ ◄────────────────────────────────── │                         │
     │           │         Prediction Result            │                         │
     │           │         (Good/Average/               │                         │
     │           │          Needs Attention)             │                         │
     │           │         Confidence Score              │                         │
     │           │         SHAP Feature                  │                         │
     │           │         Contributions                 │                         │
     │           │         Prediction History            │                         │
     └───────────┘                                      ╰────────────┬────────────╯
                                                                     │
                                                                     │
                                         ┌───────────────────────────┼───────────────────────────┐
                                         │                           │                           │
                                         │  Read / Write             │  Load Trained             │
                                         │                           │  Models                   │
                                         ▼                           ▼                           │
                                  ═══════════════════      ═══════════════════                   │
                                    D1: SQLite               D2: Model                          │
                                    Database                 Artifacts                           │
                                    (Teachers +              (rf_model.joblib                    │
                                     Prediction              dl_model.keras                     │
                                     Records)                scaler.joblib                      │
                                  ═══════════════════      ═══════════════════                   │
                                         │                           │                           │
                                         │  Read Teacher             │  Scaler +                 │
                                         │  Records +                │  Label Map +              │
                                         │  Prediction               │  Background               │
                                         │  Records                  │  Samples                  │
                                         └───────────────────────────┴───────────────────────────┘
```

---

## Figure 1: Level 0 DFD (Context Diagram)

---

## Components

### External Entity

| Symbol | Entity | Description |
|--------|--------|-------------|
| Rectangle | **Teacher** | The primary user who registers, logs in, enters student data, and receives performance predictions |

### Process

| Symbol | Process | Description |
|--------|---------|-------------|
| Circle/Oval | **P0: Student Performance Analyzer System** | The entire application — accepts student data, runs ML/DL inference, and returns performance predictions with explanations |

### Data Stores

| Symbol | Store | Description |
|--------|-------|-------------|
| Open Rectangle | **D1: SQLite Database** | Stores teacher accounts (email, password hash, name) and all prediction records (student data, prediction, confidence, model used) |
| Open Rectangle | **D2: Model Artifacts** | Pre-trained Random Forest model, Neural Network model, StandardScaler, label mappings, and SHAP background samples |

### Data Flows

| # | From | To | Data Description |
|---|------|----|------------------|
| 1 | Teacher | P0 | Signup/Login credentials (email, password, name) |
| 2 | Teacher | P0 | Student academic data (name, age, department, 8 semesters with internal marks, university marks, attendance) |
| 3 | Teacher | P0 | Model type selection (ML: Random Forest / DL: Neural Network) |
| 4 | P0 | Teacher | JWT authentication token |
| 5 | P0 | Teacher | Prediction label (Good / Average / Needs Attention) |
| 6 | P0 | Teacher | Confidence score (0–100%) |
| 7 | P0 | Teacher | SHAP feature contributions (per-feature impact values) |
| 8 | P0 | Teacher | Prediction history (list of past predictions) |
| 9 | P0 | D1 | Write: Create teacher records, store prediction records |
| 10 | D1 | P0 | Read: Verify teacher credentials, retrieve prediction history |
| 11 | D2 | P0 | Load: Trained RF/NN models, fitted scaler, label map, background data |
