# DAIMON

AI-augmented research dashboard for longitudinal sensing studies.

DAIMON helps research teams monitor participants' passive sensing data (smartwatch and phone), track data-quality issues and ask questions about the data in natural language. Its natural-language features are powered by [GLOSS](https://github.com/UbiWell/GLOSS) (Group of LLMs for Open-Ended Sensemaking) 📚 [paper](https://dl.acm.org/doi/10.1145/3749474).

## Repository structure

| Folder | What it is |
| --- | --- |
| [`backend/`](backend) | GLOSS plus the dashboard's Flask API (`backend/dashboards_backend/`), with sample data and sample study documents |
| [`frontend/`](frontend) | The dashboard web app (Vite + React + TypeScript) |

## Getting started

1. **Set up the backend first.** Follow [`backend/README.md`](backend/README.md) to install GLOSS, add your API keys and start the API on `http://localhost:5050`.
2. **Then run the frontend.** Follow [`frontend/README.md`](frontend/README.md) and point `VITE_API_URL` at your backend.
3. **Log in** with the example account `TestUser` / `daimon123`.

The backend ships with one day of sample data (`backend/sample_data/`, user `test004`) so you can try the dashboard without connecting your own database.

## Citation

DAIMON builds on GLOSS. If you use this code, please cite:

***Akshat Choube, Ha Le, Jiachen Li, Kaixin Ji, Vedant Das Swain, and Varun Mishra. 2025. GLOSS: Group of LLMs for Open-ended Sensemaking of Passive Sensing Data for Health and Wellbeing. Proc. ACM Interact. Mob. Wearable Ubiquitous Technol. 9, 3, Article 76 (September 2025), 32 pages. https://doi.org/10.1145/3749474***
