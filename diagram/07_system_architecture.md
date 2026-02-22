# System Architecture Diagram

## Description

The Student Performance Analyzer follows a 4-tier architecture: Presentation Layer (browser), Application Layer (API server), ML/DL Engine, and Data Layer. This document shows how these tiers interact and the technologies used at each level.

## Architecture Diagram

```mermaid
flowchart TB
    subgraph Presentation["Presentation Layer (Browser - Port 3000)"]
        direction TB
        NextJS["<b>Next.js 14</b>\nReact 18 + TypeScript"]
        UI["<b>UI Components</b>\nShadcn UI + Radix UI\nTailwind CSS"]
        Charts["<b>Charts</b>\nRecharts Library"]
        FormVal["<b>Form Validation</b>\nZod Schema"]
        HTTP["<b>HTTP Client</b>\nAxios + JWT Interceptor"]

        NextJS --> UI
        NextJS --> Charts
        NextJS --> FormVal
        NextJS --> HTTP
    end

    subgraph Application["Application Layer (FastAPI Server - Port 8000)"]
        direction TB
        FastAPI["<b>FastAPI 0.109</b>\nUvicorn ASGI Server"]
        CORS["<b>CORS Middleware</b>\nAllows localhost:3000"]
        Routes["<b>REST Endpoints</b>\nPOST /auth/signup\nPOST /auth/login\nPOST /predict\nGET /history"]
        Pydantic["<b>Pydantic 2.5</b>\nRequest/Response Validation"]
        JWTAuth["<b>JWT Authentication</b>\npython-jose (HS256)\npasslib + bcrypt"]

        FastAPI --> CORS
        FastAPI --> Routes
        Routes --> Pydantic
        Routes --> JWTAuth
    end

    subgraph MLEngine["ML/DL Engine"]
        direction TB
        Predictor["<b>PredictorService</b>\nLazy Model Loading\n+ Caching"]
        RF["<b>Random Forest</b>\nscikit-learn 1.4\n300 Trees"]
        NN["<b>Neural Network</b>\nTensorFlow 2.15 / Keras\n25→32→16→3"]
        Scaler["<b>StandardScaler</b>\nz-score Normalization"]
        SHAP["<b>SHAP 0.44</b>\nTreeExplainer (RF)\nKernelExplainer (NN)"]
        Rules["<b>Rule Override</b>\nWeighted Score Formula\nUpgrade-Only Logic"]

        Predictor --> RF
        Predictor --> NN
        Predictor --> Scaler
        Predictor --> SHAP
        Predictor --> Rules
    end

    subgraph DataLayer["Data Layer"]
        direction LR
        SQLite[("SQLite\nstudent_performance.db\n• teachers table\n• prediction_records table")]
        Artifacts[("Model Artifacts\n• rf_model.joblib\n• dl_model.keras\n• scaler.joblib\n• label_map.json\n• background.npy")]
        CSV[("Training Data\nstudent_data.csv\n500 synthetic rows")]
    end

    %% Inter-layer connections
    Presentation -->|"HTTP REST (JSON)\n+ Bearer JWT Token"| Application
    Application -->|"PredictorService\n.predict(payload, model_type)"| MLEngine
    Application -->|"SQLAlchemy ORM\n(Create / Read)"| SQLite
    MLEngine -->|"joblib.load()\nkeras.load_model()"| Artifacts

    %% Training flow (offline)
    CSV -.->|"Training\n(Offline)"| MLEngine
    MLEngine -.->|"Save Artifacts\n(Offline)"| Artifacts
```

## Technology Stack Summary

| Layer | Technologies | Purpose |
|-------|-------------|---------|
| **Presentation** | Next.js 14, React 18, TypeScript, Tailwind CSS, Shadcn UI, Recharts, Axios, Zod | User interface, form handling, chart rendering, API communication |
| **Application** | FastAPI, Uvicorn, Pydantic, python-jose, passlib/bcrypt | REST API server, request validation, JWT authentication |
| **ML/DL Engine** | scikit-learn, TensorFlow/Keras, SHAP, NumPy, Pandas | Model inference, feature scaling, explainability, rule override |
| **Data** | SQLite, SQLAlchemy, joblib, Keras HDF5 | Persistent storage, ORM, model serialization |

## Communication Flow

```
┌─────────────┐       HTTPS/JSON        ┌──────────────┐
│   Browser    │ ◄───────────────────► │  FastAPI      │
│  (Port 3000) │   + JWT Bearer Token   │  (Port 8000)  │
│   Next.js    │                         │  Uvicorn      │
└─────────────┘                         └──────┬───────┘
                                                │
                            ┌───────────────────┼───────────────────┐
                            │                   │                   │
                    ┌───────▼──────┐    ┌──────▼───────┐   ┌──────▼──────┐
                    │  Auth Module │    │  Predictor   │   │  Database   │
                    │  JWT+bcrypt  │    │  Service     │   │  Module     │
                    └──────────────┘    │  RF/NN/SHAP  │   │  SQLAlchemy │
                                        └──────┬───────┘   └──────┬──────┘
                                               │                   │
                                        ┌──────▼───────┐   ┌──────▼──────┐
                                        │ Model Files  │   │   SQLite    │
                                        │ .joblib      │   │    .db      │
                                        │ .keras       │   └─────────────┘
                                        └──────────────┘
```

## Deployment Configuration

| Component | Host | Port | Command |
|-----------|------|------|---------|
| Frontend | localhost | 3000 | `npm run dev` |
| Backend | localhost | 8000 | `uvicorn app.main:app --reload` |
| Database | localhost | — | Embedded SQLite (file-based) |
