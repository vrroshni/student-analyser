# Student Performance Analyzer

End-to-end local project:
- **Backend**: FastAPI + SQLite + Scikit-learn + TensorFlow (optional) + SHAP
- **Frontend**: Next.js

## Prerequisites
- Python 3.10+
- Node.js 18+ (or 20)

## Backend setup
```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
```

### Generate data
```bash
.venv/bin/python backend/data/generate_data.py
```

### Train models
```bash
.venv/bin/python backend/ml/train_ml.py
.venv/bin/python backend/ml/train_dl.py
```

### Run backend
```bash
PYTHONPATH=backend .venv/bin/uvicorn app.main:app --reload
```

Backend URLs:
- http://localhost:8000
- http://localhost:8000/health
- http://localhost:8000/docs

## Frontend setup
```bash
cd frontend
npm install
npm run dev
```

If your editor shows TypeScript errors like "Cannot find module 'react'" or "Cannot find module 'next'", run `npm install` in `frontend/` to install dependencies.

Open:
- http://localhost:3000

## Run tests
```bash
PYTHONPATH=backend pytest -q backend/tests -v
```
