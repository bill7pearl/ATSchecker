# System Architecture & Clean Code Design Guidelines (skills.md)

This document describes the architectural boundaries, design patterns, clean code principles, and styling strategies implemented in the client-side ATS CV Analyzer and Maker application.

---

## 1. Conformance to SOLID Principles

### Single Responsibility Principle (SRP)
Each module and utility in the application has a singular, well-defined reason to change. We isolate the functional responsibilities into dedicated files:
1. **PDF Text Extraction ([pdfWorker.ts](file:///c:/Users/lenovo/Desktop/Boiler-plate/CV/src/utils/pdfWorker.ts)):** Natively extracts text content in a background worker thread. It is completely unaware of ATS rules, job descriptions, or AI APIs.
2. **ATS Scoring Engine ([atsAnalyzer.ts](file:///c:/Users/lenovo/Desktop/Boiler-plate/CV/src/utils/atsAnalyzer.ts)):** Analyzes parsed text strings to compute matching keywords (Hard/Soft/Context) and identify structural warnings. It is entirely deterministic and functions synchronously without network calls.
3. **AI Generation Adapters ([ai.ts](file:///c:/Users/lenovo/Desktop/Boiler-plate/CV/src/utils/ai.ts)):** Formulates prompt models and talks to external Gemini model endpoints via HTTPS. It has no knowledge of document upload events or local storage state updates.
4. **Local Registry Loggers ([localStorageLog.ts](file:///c:/Users/lenovo/Desktop/Boiler-plate/CV/src/utils/localStorageLog.ts)):** Exposes a clean transaction ledger to read and write event logs to local storage.

### Open/Closed Principle (OCP)
The AI communication layer in `ai.ts` uses structured prompt pipelines that are closed to modification but open to extension. 
- The adapter works against standard string parameters (`cvText`, `jdText`) rather than hardcoding layouts or UI dependencies.
- You can extend the API settings schema (e.g. to support SiliconFlow, OpenAI, or Ollama endpoints) by simply modifying the config payload object without altering the core scanning algorithms or text extraction pipelines.

### Interface Segregation & Dependency Inversion (DIP)
- The analytical inputs (`SkillItem[]`, `StructuralFlag[]`) and logging layers are designed around explicit TypeScript interfaces.
- The state management uses native React hooks. The storage utility acts as a local data store, which can easily be replaced with server-side network requests (e.g., standard API routes) without needing to alter how the dashboard UI displays logs or statistics.

---

## 2. DRY, KISS, and YAGNI Guidelines

### DRY (Don't Repeat Yourself)
- Text cleaning, tokenization, and stop-word filtering are consolidated into the `tokenize()` function within `atsAnalyzer.ts`. This ensures uniform text comparisons.
- Common file export operations (copying to clipboard and text file downloads) are mapped to reusable callback utilities in the core page shell.

### KISS (Keep It Simple, Stupid)
- Instead of setting up complex React Context systems, Redux, or Zustand, state is managed through local component state at the page level. Since the application is tab-based, this maintains clean top-down state flows.
- PDF parsing is performed in a clean, self-contained worker instantiated from an inline string Blob. This avoids setting up complicated bundler rules or Webpack worker loaders.

### YAGNI (You Aren't Gonna Need It)
- We avoided building an external backend database, login systems, or hosting pipelines. All activity tracking and user keys are saved in `localStorage` in the user's browser, satisfying the client-side constraint.

---

## 3. Tailwind BEM Organization

To keep our TSX code readable and maintainable, utility classes are grouped under semantic BEM component names in [globals.css](file:///c:/Users/lenovo/Desktop/Boiler-plate/CV/src/app/globals.css) using the `@layer components` directive.

The architecture of our styling class tree is outlined below:

### Card Component Block (`.cv-card`)
- **Block:** `.cv-card` — Defines a premium, translucent slate container with borders and drop-shadows.
- **Elements:**
  - `.cv-card__header` — Flex row separation for title and actions.
  - `.cv-card__title` — Standard font formatting with custom leading icon layout.
  - `.cv-card__subtitle` — Auxiliary light slate details text.
  - `.cv-card__body` — Consistent layout container for inner elements.
  - `.cv-card__footer` — Standardized footer for actions and disclaimers.
- **Modifiers:**
  - `.cv-card--interactive` — Hover scaling transforms and subtle blue shadows.
  - `.cv-card--highlighted` — Emphasized border styling with dark blue gradients.

### Buttons Component Block (`.cv-button`)
- **Block:** `.cv-button` — Base dimensions, flex alignments, and transition definitions.
- **Modifiers:**
  - `.cv-button--primary` — Premium royal-blue to light-blue background gradients.
  - `.cv-button--secondary` — Slate background for auxiliary/cancel actions.
  - `.cv-button--danger` — Crimson gradient alert button.
  - `.cv-button--success` — Green gradient confirmation button.

### Status Indicators Component Block (`.cv-status-pill`)
- **Block:** `.cv-status-pill` — Rounded pills for categories.
- **Modifiers:**
  - `.cv-status-pill--success` — Green transparent badge for matched keywords.
  - `.cv-status-pill--danger` — Red transparent badge for missing keywords.
  - `.cv-status-pill--warning` — Amber badge for moderate/warning audits.
  - `.cv-status-pill--neutral` — Default grey badge.

---

## 4. Performance & Thread Optimization Details

1. **Unblocked Main Thread:**
   PDF text parsing is computationally heavy. By passing the PDF `ArrayBuffer` directly to the background Web Worker (`worker.postMessage({ arrayBuffer }, [arrayBuffer])`), we offload all document extraction logic from the UI thread. The main thread only processes simple progress reports, keeping animations and interactions smooth.
2. **Deterministic Synchronous Matcher:**
   The initial keyword analyzer operates locally in linear time `O(N + M)` relative to text lengths. This provides instant results for matching calculations without loading or API key requirements.
