# Student Performance Analyzer

End-to-end local project:
- **Backend**: FastAPI + SQLite + SQLAlchemy + Scikit-learn + TensorFlow + SHAP
- **Frontend**: Next.js (React) + Tailwind

This README is written so you can run the project **from scratch** on:
- **Windows** (no programming tools installed)
- **macOS** (no programming tools installed)

The project supports two model types:
- **ML model**: Random Forest (`model_type=ml`)
- **DL model**: Neural Network (`model_type=dl`)

Models are stored at:
- `backend/ml/models/`

If the models are missing, the backend will show an error telling you to run the training scripts.

---

## Repository structure

- `backend/` (FastAPI server + SQLite DB + ML/DL training)
- `frontend/` (Next.js UI)

---

## 1) Clone the repository

### Windows (PowerShell)

```powershell
git clone <YOUR_GIT_REPO_URL>
cd student-performance-analyzer
```

### macOS (Terminal)

```bash
git clone <YOUR_GIT_REPO_URL>
cd student-performance-analyzer
```

---

## 2) Install prerequisites

### Required versions

- **Python**: 3.10+ (recommended: **Python 3.10.x** for best TensorFlow compatibility)
- **Node.js**: 18+ (18 or 20)
- **Git**: any recent version

---

## Windows setup (from a fresh machine)

## A) Install Git

1. Download and install Git for Windows:
   - https://git-scm.com/download/win
2. Open **PowerShell** and verify:

```powershell
git --version
```

---

## B) Install Python

1. Download and install Python from:
   - https://www.python.org/downloads/
2. During installation, **check**:
   - "Add python.exe to PATH"
3. Verify:

```powershell
python --version
pip --version
```

If `python` is not found, restart PowerShell after installation.

---

## C) Install Node.js (for the frontend)

1. Download and install Node.js LTS:
   - https://nodejs.org/
2. Verify:

```powershell
node --version
npm --version
```

---

## D) Backend (Windows)

From the repository root:

### 1. Create a virtual environment

```powershell
python -m venv .venv
```

### 2. Activate the virtual environment

```powershell
.\.venv\Scripts\Activate.ps1
```

If activation is blocked, run PowerShell as Administrator and execute:

```powershell
Set-ExecutionPolicy RemoteSigned
```

Then re-run the activate command.

### 3. Install backend dependencies

```powershell
pip install --upgrade pip
pip install -r backend\requirements.txt
```

### 4. Generate the dataset (CSV)

```powershell
python backend\data\generate_data.py
```

Expected output file:
- `backend/data/student_data.csv`

### 5. Train the ML and DL models (recommended)

```powershell
python backend\ml\train_ml.py
python backend\ml\train_dl.py
```

This creates/overwrites artifacts in:
- `backend/ml/models/`

### 6. Run the backend API

```powershell
$env:PYTHONPATH = "backend"
uvicorn app.main:app --reload
```

Backend URLs:
- http://localhost:8000
- http://localhost:8000/health
- http://localhost:8000/docs

---

## E) Frontend (Windows)

Open a **new** PowerShell window (keep backend running), then:

```powershell
cd frontend
npm install
npm run dev
```

Frontend URL:
- http://localhost:3000

---

## macOS setup (from a fresh machine)

## A) Install Homebrew (recommended)

Open Terminal and run:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

---

## B) Install Git, Python, Node

```bash
brew install git python@3.10 node
```

Verify:

```bash
git --version
python3 --version
node --version
npm --version
```

---

## C) Backend (macOS)

From the repository root:

### 1. Create and activate a virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 2. Install backend dependencies

```bash
pip install --upgrade pip
pip install -r backend/requirements.txt
```

### 3. Generate the dataset (CSV)

```bash
python backend/data/generate_data.py
```

### 4. Train the ML and DL models

```bash
python backend/ml/train_ml.py
python backend/ml/train_dl.py
```

### 5. Run the backend API

```bash
PYTHONPATH=backend uvicorn app.main:app --reload
```

Backend URLs:
- http://localhost:8000
- http://localhost:8000/docs

---

## D) Frontend (macOS)

Open a **new** Terminal window (keep backend running), then:

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:
- http://localhost:3000

---

## Using the application

1. Open the frontend: http://localhost:3000
2. Create a teacher account (Signup)
3. Login
4. Enter student details and run prediction
5. Choose model type:
   - `ml` (Random Forest)
   - `dl` (Neural Network)

---

## Database

- SQLite DB file: `backend/student_performance.db`
- Tables are created automatically when the backend starts.
- Prediction history is stored and shown in the UI.

---

## Run backend tests

### Windows

```powershell
$env:PYTHONPATH = "backend"
pytest -q backend\tests -v
```

### macOS

```bash
PYTHONPATH=backend pytest -q backend/tests -v
```

---

## Troubleshooting

### 1) Frontend TypeScript errors like "Cannot find module 'react'" / "Cannot find module 'next'"

Run:

```bash
cd frontend
npm install
```

### 2) Backend says ML/DL artifacts not found

Run (from repo root, with venv activated):

```bash
python backend/data/generate_data.py
python backend/ml/train_ml.py
python backend/ml/train_dl.py
```

### 3) TensorFlow install issues

- Ensure you are using **Python 3.10**.
- Re-create your venv if you upgraded Python after creating the venv.

### 4) CORS / API not reachable from the frontend

- Backend should be on `http://localhost:8000`
- Frontend should be on `http://localhost:3000`
- The frontend uses `baseURL: http://localhost:8000` in `frontend/src/lib/api.ts`.

