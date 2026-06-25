# ATS Resume Analyzer & Maker Pro

A high-performance, client-side only web application built with Next.js (App Router), TypeScript, and Tailwind CSS (BEM architecture). It helps users optimize their CVs to successfully pass Applicant Tracking System (ATS) screeners.

---

## Features

- 🎯 **ATS Match & Comparative Scoring:** Analyzes structural syntax, hard skills, soft skills, and context keyword overlap against job descriptions.
- ⚙️ **Client-Side Web Worker PDF Parsing:** Text is extracted from PDF resumes in a background Web Worker thread using `pdfjs-dist` to prevent freezing the main UI thread.
- 🧪 **AI Optimization & Enhancement:** Inject missing keywords organically and generate optimized text blocks using the Gemini 1.5 API.
- 📨 **Cover Letter Synthesizer:** Create tailored, formal cover letters mapping experiences to requirements.
- 💬 **LinkedIn Outreach copy:** Generate short HR networking messages under 200 characters with live character counter safety.
- 📜 **Local Activity Ledger:** All user activities, scans, and generations are logged in a browser-bound storage ledger for audits and privacy.
- 🔒 **Security-First Approach:** Zero external databases. All keys, metrics, and texts reside completely in the user's browser `localStorage`.

---

## Getting Started

### 1. Install Dependencies
Run the following command in your terminal to install the necessary packages (Next.js, React, Tailwind, Lucide React, and TypeScript compiler elements):

```bash
npm install
```

### 2. Launch the Development Server
Start the Next.js local server:

```bash
npm run dev
```

### 3. Open the Web App
Open your web browser and navigate to:
**[http://localhost:3000](http://localhost:3000)**

---

## Configuring the Gemini API Key

1. Launch the web application and select the **API Settings** tab in the top navigation menu.
2. Generate a free API key at the **[Google AI Studio Portal](https://aistudio.google.com/)**.
3. Paste the key (`AIzaSy...`) in the key field and select your model (e.g., `Gemini 1.5 Flash`).
4. Click **Save Config Credentials**. The key will be stored securely in your browser's local storage and used directly to make HTTPS requests to Google's API endpoints.

---

## File Architecture Details
To read about the structural design patterns (SOLID, DRY, KISS, YAGNI, and Tailwind BEM CSS definitions), please open the detailed developer guide:
📄 **[skills.md](file:///c:/Users/lenovo/Desktop/Boiler-plate/CV/skills.md)**
