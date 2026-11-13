# Sightline Studio — AI-Powered Multi-Screenshot UI/UX Verifier

![React](https://img.shields.io/badge/React-18+-18181B?style=flat-square&logo=react&logoColor=61DAFB)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-18181B?style=flat-square&logo=tailwindcss&logoColor=38BDF8)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-18181B?style=flat-square&logo=fastapi&logoColor=009688)
![Qwen2-VL-2B](https://img.shields.io/badge/Qwen2--VL--2B-4--bit_NF4-18181B?style=flat-square&logo=huggingface&logoColor=FFD21E)
![Deployed on Render](https://img.shields.io/badge/Render-Static_Site-18181B?style=flat-square&logo=render&logoColor=46E3B7)

**Sightline Studio** is a full-stack computer-vision UI/UX auditing workbench that evaluates single or multi-page website screenshots for visual hierarchy, WCAG contrast legibility, grid alignment, spacing rhythm, and cross-screen token consistency. Powered by a 4-bit quantized **Qwen2-VL-2B-Instruct** vision-language model served over **FastAPI**, it transforms raw viewport captures into structured pass/fail diagnostic reports and actionable CSS remediation checklists.

---

## System Architecture

```text
┌──────────────────────────────┐       HTTPS (REST / FormData)       ┌───────────────────────────────────────┐
│      Sightline Frontend      │ ──────────────────────────────────► │        Static Ngrok Gateway           │
│   React + Vite + Tailwind    │ ◄────────────────────────────────── │    (*.ngrok-free.app / TLS Tunnel)    │
│    (Hosted on Render CDN)    │         Sanitized Audit JSON        └───────────────────┬───────────────────┘
└──────────────────────────────┘                                                         │ Local Port 8000
                                                                                         ▼
                                                                     ┌───────────────────────────────────────┐
                                                                     │      FastAPI Inference Server         │
                                                                     │        (Google Colab T4 GPU)          │
                                                                     │                                       │
                                                                     │  1. Lanczos Resize (1120px max edge)  │
                                                                     │  2. Qwen2-VL-2B (4-bit NF4 + PEFT)    │
                                                                     │  3. Deterministic Schema Sanitizer    │
                                                                     └───────────────────────────────────────┘
```

### Engineering Highlights
* **Memory-Safe Vision Preprocessing:** Dynamically downscales tall full-page screenshots proportionally (`1120px` max edge) via Lanczos resampling, preserving small typography while preventing quadratic attention VRAM spikes on 16 GB NVIDIA T4 GPUs.
* **4-Bit Quantized VLM Inference:** Loads `Qwen/Qwen2-VL-2B-Instruct` in `NF4` 4-bit precision via `bitsandbytes` with `PEFT` LoRA adapter support for low-latency multi-image reasoning.
* **Deterministic Schema Sanitization:** Validates and repairs raw vision-language token outputs on the backend, guaranteeing strict numeric scoring, filename attribution, and populated remediation items before reaching the client.
* **Zero-Secret Frontend Deployment:** Injects the inference gateway endpoint at build time via `VITE_API_URL`, keeping private tunnel hostnames out of source control and public UI controls.

---

## Key Features

* **Multi-Screen Batch Auditing:** Drag-and-drop or browse multiple `PNG`, `JPG`, or `WEBP` captures simultaneously to inspect cross-page consistency.
* **Viewport Mode Switching:** Toggle between **Desktop** and **Mobile** audit contexts prior to running GPU verification.
* **4-Pillar Heuristic Telemetry:** Evaluates **Contrast**, **Alignment**, **Spacing**, and **Consistency** individually on a `0.0–10.0` scale alongside an overall circular score gauge (`PASS` threshold `≥ 7.0`).
* **Impact-Ordered Flaw Diagnostics:** Categorizes detected defects by severity (`Critical`, `Major`, `Minor`), design pillar, and exact source filename.
* **Interactive Remediation Checklist & Markdown Export:** Track resolved CSS/layout fixes in real time and export the complete audit report to Markdown (`Export MD`) with one click.
* **Full-Resolution Lightbox Inspector:** Inspect queued captures at native resolution with pixel dimensions and file size metadata.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React, Vite, Tailwind CSS, Lucide React |
| **Frontend Hosting** | Render (Static Site CDN) |
| **Backend API** | Python, FastAPI, Uvicorn, Pillow |
| **Vision-Language Model** | Hugging Face `transformers`, `Qwen2-VL-2B-Instruct`, `peft`, `bitsandbytes`, PyTorch |
| **GPU Runtime & Tunneling** | Google Colab (NVIDIA T4 GPU), `pyngrok` Static Domain |

---

## Project Structure

```text
sightline-studio/
├── public/                 # Static assets
├── src/
│   ├── App.jsx             # Main workbench UI, upload queue, lightbox & audit renderer
│   ├── main.jsx            # React DOM entry point
│   └── index.css           # Tailwind CSS directives
├── .env.example            # Environment variable template
├── .gitignore              # Excludes .env, node_modules, and dist
├── index.html              # Application HTML shell
├── package.json            # Frontend dependencies and build scripts
└── vite.config.js          # Vite bundler configuration
```

---

## Local Development Setup

### 1. Clone the Repository
```bash
git clone [https://github.com/your-username/sightline-studio.git](https://github.com/your-username/sightline-studio.git)
cd sightline-studio
```

### 2. Install Frontend Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` and set your active FastAPI inference endpoint:
```bash
cp .env.example .env
```

```env
VITE_API_URL=[https://your-static-domain.ngrok-free.app](https://your-static-domain.ngrok-free.app)
```

### 4. Start the Development Server
```bash
npm run dev
```
Open the local URL printed by Vite (typically `http://localhost:5173`). Confirm the top-right status badge displays **Inference Online**.

---

## Production Deployment (Render)

1. Push your repository to GitHub (ensure `.env` is excluded by `.gitignore`).
2. Create a new **Static Site** in the [Render Dashboard](https://dashboard.render.com) connected to your repository:
   * **Build Command:** `npm run build`
   * **Publish Directory:** `dist`
3. Under **Environment**, add the production endpoint variable:
   * **Key:** `VITE_API_URL`
   * **Value:** `https://your-static-domain.ngrok-free.app`
4. Trigger a deploy. Whenever your Colab GPU inference cell is active, the deployed Render application connects automatically.

---

## Backend API Reference

### `GET /health`
Verifies that the FastAPI server and quantized Qwen2-VL model are loaded in GPU memory.

**Response (`200 OK`):**
```json
{
  "status": "online",
  "version": "v4",
  "model": "Qwen2-VL-2B"
}
```

### `POST /api/audit`
Accepts one or more image files via `multipart/form-data` and returns a structured UI audit report.

**Form Fields:**
* `files`: One or more image files (`image/png`, `image/jpeg`, `image/webp`)
* `viewport`: `"desktop"` or `"mobile"`

**Response (`200 OK`):**
```json
{
  "score": 8.0,
  "status": "PASS",
  "verdict": "Evaluated page.png and home.png, achieving 8.0/10 overall with strongest execution in Contrast (9.0/10).",
  "metrics": [
    { "label": "Contrast", "score": 9.0 },
    { "label": "Alignment", "score": 7.5 },
    { "label": "Spacing", "score": 6.5 },
    { "label": "Consistency", "score": 8.0 }
  ],
  "flaws": [
    {
      "severity": "Minor",
      "category": "Spacing",
      "screen": "page.png",
      "detail": "Card grid gaps vary across sections, disrupting vertical rhythm."
    }
  ],
  "suggestions": [
    {
      "title": "Standardize card grid spacing tokens",
      "fix": "Apply a consistent gap-6 (24px) utility across all multi-column card containers."
    }
  ]
}
```

---

## License

This project is open-source and available under the [MIT License](LICENSE).