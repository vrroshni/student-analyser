# Algorithms Used

## Description

The Student Performance Analyzer employs multiple algorithms for prediction, explainability, preprocessing, and decision-making. This document describes each algorithm with its configuration, purpose, and flowchart.

---

## 1. Random Forest Classifier

### Overview

Random Forest is an ensemble machine learning algorithm that builds multiple decision trees during training and outputs the class with the majority vote across all trees.

### Configuration

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `n_estimators` | 300 | Number of decision trees in the ensemble |
| `class_weight` | balanced | Adjusts weights to handle class imbalance |
| `random_state` | 42 | Ensures reproducible results |
| Train/Test Split | 80/20 | Stratified split preserving class distribution |

### Training Flowchart

```mermaid
flowchart TD
    A["Load Dataset\n(student_data.csv\n500 rows)"] --> B["Split into Train/Test\n(80/20 Stratified)"]
    B --> C["Fit StandardScaler\non Training Data"]
    C --> D["Transform Train & Test\nFeatures"]
    D --> E["Train Random Forest\n(300 Decision Trees)"]
    E --> F["Each Tree Trained on\nRandom Subset of Data\n+ Random Features"]
    F --> G["Save Model Artifacts\n(rf_model.joblib\nscaler.joblib\nlabel_map.json)"]
    G --> H["Evaluate on Test Set\n(Accuracy + Classification Report)"]
```

### Inference Flowchart

```mermaid
flowchart TD
    A["Input: 25-Feature Vector"] --> B["Scale with StandardScaler"]
    B --> C["Pass to 300 Decision Trees"]
    C --> D["Each Tree Votes\nfor a Class"]
    D --> E["Aggregate Votes\n(Majority Voting)"]
    E --> F["predict_proba: Get\n3-Class Probabilities"]
    F --> G["Output: Predicted Class\n+ Confidence Score"]
```

### Feature Input (25 Features)
`age`, `sem1_internal`, `sem1_university`, `sem1_attendance`, `sem2_internal`, ..., `sem8_attendance`

---

## 2. Feed-Forward Neural Network

### Overview

A deep learning model using a fully-connected feed-forward architecture with ReLU activation in hidden layers and Softmax output for multi-class classification.

### Architecture

| Layer | Type | Units | Activation | Purpose |
|-------|------|-------|------------|---------|
| Input | Input | 25 | — | Accepts 25 scaled features |
| Hidden 1 | Dense | 32 | ReLU | Learn non-linear patterns |
| Hidden 2 | Dense | 16 | ReLU | Learn higher-level representations |
| Output | Dense | 3 | Softmax | Probability distribution over 3 classes |

### Training Configuration

| Parameter | Value |
|-----------|-------|
| Optimizer | Adam (learning_rate = 0.001) |
| Loss Function | Sparse Categorical Crossentropy |
| Epochs | 30 |
| Batch Size | 32 |
| Validation Split | 20% |

### Architecture Diagram

```mermaid
flowchart LR
    subgraph Input["Input Layer"]
        I["25 Features\n(age, sem1_internal,\nsem1_university, ...)"]
    end

    subgraph Hidden1["Hidden Layer 1"]
        H1["32 Neurons\nReLU Activation"]
    end

    subgraph Hidden2["Hidden Layer 2"]
        H2["16 Neurons\nReLU Activation"]
    end

    subgraph Output["Output Layer"]
        O["3 Neurons\nSoftmax Activation"]
    end

    subgraph Classes["Prediction"]
        C1["Good"]
        C2["Average"]
        C3["Needs Attention"]
    end

    I --> H1 --> H2 --> O
    O --> C1
    O --> C2
    O --> C3
```

### Training Flowchart

```mermaid
flowchart TD
    A["Load Dataset\n(student_data.csv)"] --> B["Split into Train/Test\n(80/20 Stratified)"]
    B --> C["Fit StandardScaler\non Training Data"]
    C --> D["Transform Train & Test"]
    D --> E["Build Sequential Model\n(25 → 32 → 16 → 3)"]
    E --> F["Compile with Adam\n+ Sparse Categorical\nCrossentropy"]
    F --> G["Train for 30 Epochs\n(Batch Size = 32)"]
    G --> H["Validate on 20% Split"]
    H --> I["Save Model Artifacts\n(dl_model.keras\nscaler.joblib\nlabel_map.json)"]
    I --> J["Save Background Samples\n(background.npy for SHAP)"]
```

---

## 3. SHAP (SHapley Additive exPlanations)

### Overview

SHAP provides model-agnostic explanations by computing the contribution of each feature to a specific prediction. It is based on Shapley values from cooperative game theory.

### Two Explainer Types

| Explainer | Used For | Method | Speed |
|-----------|----------|--------|-------|
| **TreeExplainer** | Random Forest | Exact computation using tree structure | Fast |
| **KernelExplainer** | Neural Network | Model-agnostic approximation | Slower (capped at 100 samples, 50 background) |

### SHAP Explanation Flowchart

```mermaid
flowchart TD
    A["Trained Model\n+ Scaled Input"] --> B{"Which Model\nType?"}
    B -->|"Random Forest"| C["TreeExplainer\n(Exact SHAP Values)"]
    B -->|"Neural Network"| D["KernelExplainer\n(nsamples=100\nbackground=50 samples)"]
    C --> E["Compute Per-Feature\nSHAP Values"]
    D --> E
    E --> F["Map Values to\nFeature Names"]
    F --> G["Output: Feature\nContribution Dict\n{feature: contribution}"]

    H["Error / Timeout"] -.->|"Fallback"| I["Return Zero\nContributions\n(Graceful Degradation)"]
```

### Example Output
```
Feature: sem8_university → Contribution: +0.35 (pushes toward "Good")
Feature: sem1_attendance → Contribution: -0.12 (pushes away from "Good")
Feature: age            → Contribution: +0.02 (minor positive effect)
```

---

## 4. StandardScaler (Feature Normalization)

### Overview

StandardScaler standardizes features by removing the mean and scaling to unit variance. This ensures all features contribute equally to the model regardless of their original scale.

### Formula

```
z = (x - μ) / σ
```

Where `μ` is the mean and `σ` is the standard deviation of each feature from the training data.

### Why It Matters

| Feature | Raw Range | After Scaling |
|---------|-----------|---------------|
| age | 15 – 30 | ~ -1.5 to +1.5 |
| sem_internal | 0 – 300 | ~ -3.0 to +3.0 |
| sem_attendance | 0 – 100 | ~ -2.5 to +2.5 |

Without scaling, features with larger ranges (like marks 0-300) would dominate over features with smaller ranges (like age 15-30).

### Scaling Flowchart

```mermaid
flowchart LR
    A["Raw Features\n(25 values)"] --> B["Load Fitted Scaler\n(scaler.joblib)"]
    B --> C["For Each Feature:\nz = (x - mean) / std"]
    C --> D["Scaled Features\n(mean=0, std=1)"]
    D --> E["Pass to ML/DL\nModel"]
```

---

## 5. Hybrid Rule-Based Override

### Overview

After the ML/DL model produces a prediction, a rule-based system computes an independent score using a weighted formula. If the rule-based prediction is **higher** (more favorable) than the model's prediction, it overrides the model output. This prevents the model from being too pessimistic.

### Score Formula

```
score = 0.55 × avg_percentage + 0.25 × last_percentage + 0.20 × avg_attendance + (age - 20) × 0.5
```

### Classification Thresholds

| Score Range | Label |
|-------------|-------|
| score >= 75 | Good |
| score >= 55 | Average |
| score < 55 | Needs Attention |

### Override Logic Flowchart

```mermaid
flowchart TD
    A["ML/DL Model\nPrediction"] --> B["Compute Rule-Based\nScore Using Formula"]
    B --> C["Determine Rule-Based\nLabel from Score"]
    C --> D{"Does Rule Predict\nHigher Category\nthan Model?"}
    D -->|"Yes"| E["Override: Use Rule Label\nSet Confidence = 0.95\nAppend '+ Rules' to Model Name"]
    D -->|"No"| F["Keep Original\nModel Prediction"]
    E --> G["Return Final\nPrediction"]
    F --> G
```

### Override Examples

| Model Prediction | Rule Score | Rule Label | Action | Final Output |
|-----------------|------------|------------|--------|--------------|
| Needs Attention | 62 | Average | Override ↑ | Average (+ Rules) |
| Average | 80 | Good | Override ↑ | Good (+ Rules) |
| Good | 50 | Needs Attention | Keep | Good |
| Average | 60 | Average | Keep | Average |

> **Key Principle:** The rule override can only **upgrade** a prediction (Needs Attention → Average, Average → Good), never downgrade it. This ensures the system errs on the side of giving students a positive assessment when the data supports it.
