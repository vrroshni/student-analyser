# Student Performance Analyzer — Diagrams & Documentation

This folder contains all diagrams and documentation for the Student Performance Analyzer project, created for college project submission and PPT preparation.

## Diagrams Index

| # | File | Title | Description |
|---|------|-------|-------------|
| 1 | [01_dfd_level_0.md](01_dfd_level_0.md) | **DFD Level 0 (Context Diagram)** | Highest-level view showing Teacher, System, and Data Stores |
| 2 | [02_dfd_level_1.md](02_dfd_level_1.md) | **DFD Level 1** | Decomposes system into Authentication, Prediction Engine, and History Service |
| 3 | [03_dfd_level_2.md](03_dfd_level_2.md) | **DFD Level 2** | Detailed sub-processes for each Level 1 process |
| 4 | [04_use_case_diagram.md](04_use_case_diagram.md) | **Use Case Diagram** | All 11 teacher interactions with the system |
| 5 | [05_algorithms_used.md](05_algorithms_used.md) | **Algorithms Used** | Random Forest, Neural Network, SHAP, StandardScaler, Rule Override — with flowcharts |
| 6 | [06_module_design.md](06_module_design.md) | **Module Design** | System module architecture and inter-module dependencies |
| 7 | [07_system_architecture.md](07_system_architecture.md) | **System Architecture** | 4-tier architecture: Presentation, Application, ML Engine, Data Layer |
| 8 | [08_sequence_diagrams.md](08_sequence_diagrams.md) | **Sequence Diagrams** | Step-by-step flows for Login, Signup, Prediction, and History |
| 9 | [09_er_diagram.md](09_er_diagram.md) | **ER Diagram** | Database schema: Teacher and PredictionRecord tables |
| 10 | [10_class_component_diagram.md](10_class_component_diagram.md) | **Class & Component Diagram** | Backend Python classes and Frontend React component hierarchy |

## How to View the Diagrams

### Option 1: GitHub
Push this folder to GitHub — Mermaid diagrams render automatically in `.md` files.

### Option 2: VS Code
Install the **Markdown Preview Mermaid Support** extension (`bierner.markdown-mermaid`) and use `Cmd+Shift+V` to preview.

### Option 3: Mermaid Live Editor
Copy any Mermaid code block and paste it into [mermaid.live](https://mermaid.live/) to view, edit, and export as PNG/SVG for your PPT.

### Option 4: Export to Images
Use the Mermaid CLI to batch-export all diagrams:
```bash
npm install -g @mermaid-js/mermaid-cli
mmdc -i diagram/01_dfd_level_0.md -o output/dfd_level_0.png
```

## PPT Tips

- Each `.md` file is designed as a **self-contained slide** — title, diagram, and explanation
- Use **Mermaid Live Editor** to export diagrams as PNG/SVG at high resolution
- The tables below each diagram can be used as speaker notes or supporting slides
- Suggested slide order follows the file numbering (01 through 10)
