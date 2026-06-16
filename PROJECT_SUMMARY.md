# Handwriting Recognition — Project Summary

A web + Android handwriting-and-document analysis platform that extracts, understands, and verifies handwritten content. Live at **<https://lingo-handwriting-recognition.netlify.app>**.

---

## At a glance

| | |
|---|---|
| **Platforms** | Responsive web app + installable PWA + Android APK (TWA wrapper) |
| **Frontend** | Next.js 15 (App Router, React 19, TypeScript) |
| **Backend** | Next.js API routes (Node runtime on Netlify) + Firebase Python Cloud Function |
| **Data + Auth** | Firebase Auth, Firestore, Firebase Storage |
| **AI services** | Google Cloud Vision (OCR), OpenRouter (LLM gateway), in-house PyTorch Siamese model |
| **Hosting** | Netlify (web) · Firebase Cloud Functions (ML service) |
| **Offline** | Serwist service worker with runtime caching |

---

## Features

### Original (semester 1)
- **Landing site** — hero, intro, stats, feature grid, "how it works", contact, CTA, footer ([src/app/page.tsx](src/app/page.tsx)).
- **Authentication** — email/password + Google sign-in via Firebase Auth, with login, register, forgot-password, and profile management flows ([src/app/auth/](src/app/auth/), [src/components/LoginForm.tsx](src/components/LoginForm.tsx)).
- **User profile** — first/last name, profile picture upload to Firebase Storage, editable in Settings ([src/app/settings/](src/app/settings/)).
- **Quick text recognition (handwriting OCR)** — upload an image, send to Google Cloud Vision, receive extracted text + per-language accuracy, with Llama-3.1 post-processing for cleanup ([src/app/api/ocr/route.ts](src/app/api/ocr/route.ts), [src/components/Dashboard/QuickRecognition.tsx](src/components/Dashboard/QuickRecognition.tsx)).
- **Document upload + analysis** — PDFs, DOCX (via JSZip parsing), and images with extracted text reports and accuracy metrics ([src/app/documents/](src/app/documents/), [src/app/api/ocr/route.ts](src/app/api/ocr/route.ts)).
- **Language detection** — Google Cloud Vision-backed detection across English, Arabic, and mixed-language input ([src/app/language-detection/](src/app/language-detection/), [src/app/api/language-detect/route.ts](src/app/api/language-detect/route.ts)).
- **Document history** — paginated list of every file each user has uploaded, with status (uploaded / analyzed / failed), thumbnail, language, and time-ago metadata ([src/app/history/](src/app/history/)).
- **Export to DOCX** — generate downloadable Word documents from extracted text using the `docx` library ([src/app/api/export-docx/route.ts](src/app/api/export-docx/route.ts)).
- **Per-user stats dashboard** — total documents, languages detected, processed today, average accuracy, recent files grid ([src/app/dashboard/page.tsx](src/app/dashboard/page.tsx)).
- **Contact form, Help & FAQs pages** ([src/app/contact/](src/app/contact/), [src/app/Help/](src/app/Help/)).
- **Admin panel** — administrative view for managing users/content ([src/app/admin/](src/app/admin/)).

### Added this semester
- **AI Chatbot** — multi-turn conversational assistant grounded in the user's uploaded documents, with session history, file attachment support (images + PDFs), OCR-aware context injection, and "smart" task routing (summarize / extract / explain). Powered by OpenRouter (GPT-4.1-mini default) ([src/app/ai-chat/](src/app/ai-chat/), [src/app/api/chat-bot/route.ts](src/app/api/chat-bot/route.ts)).
- **Floating AI support bubble** — fixed bottom-right dark-blue circular button (white sparkle icon) with subtle pulse animation, visible on every authenticated page, hidden on `/ai-chat` and `/auth`. One-tap shortcut to the assistant ([src/components/Dashboard/FloatingChatBubble.tsx](src/components/Dashboard/FloatingChatBubble.tsx)).
- **Signature verification** — upload a known-genuine reference signature and a signature-to-verify; an in-house Siamese deep learning model returns a similarity score and a "Likely genuine / Likely forged" verdict ([src/app/signature-verification/](src/app/signature-verification/), [functions-python/main.py](functions-python/main.py)). Both images are recorded into the user's history.
- **Progressive Web App (PWA)** — installable from any browser, full-screen launch, offline-tolerant via Serwist runtime caching, branded splash + maskable icons ([src/app/manifest.ts](src/app/manifest.ts), [src/app/sw.ts](src/app/sw.ts)).
- **Native Android app** — the same PWA bundled into a signed `.apk` via Bubblewrap (Trusted Web Activity), publishable to the Play Store ([android/BUILD_APK.md](android/BUILD_APK.md)).
- **Mobile-first responsive sweep** — every dashboard surface (stats grid, document grid, history table, KV reports, sidebar) collapses cleanly at 1024 / 768 / 560 / 420 px breakpoints with a fixed bottom mobile nav bar.

---

## Architecture

```
                ┌─────────────────────────────────────────────┐
                │   User device (Web · Installed PWA · APK)   │
                └──────────────────────┬──────────────────────┘
                                       │
                  ┌────────────────────┴────────────────────┐
                  │       Next.js 15 frontend on Netlify    │
                  │  React 19 · App Router · TypeScript     │
                  │  Service Worker (Serwist)               │
                  └─┬──────────┬──────────┬───────────────┬─┘
                    │          │          │               │
            ┌───────▼──┐  ┌────▼─────┐ ┌──▼─────────┐ ┌───▼────────┐
            │ Firebase │  │ Next API │ │ Next API   │ │ Next API   │
            │   Auth   │  │  /ocr    │ │ /chat-bot  │ │ /verify-   │
            │ Firestore│  │ /lang-   │ │            │ │  signature │
            │  Storage │  │  detect  │ │            │ │  (proxy)   │
            └──────────┘  └────┬─────┘ └────┬───────┘ └────┬───────┘
                               │            │              │
                       ┌───────▼──┐   ┌─────▼──────┐ ┌─────▼─────────┐
                       │ Google   │   │ OpenRouter │ │ Firebase      │
                       │ Cloud    │   │ (GPT-4.1)  │ │ Python Func   │
                       │ Vision   │   │            │ │ PyTorch       │
                       │   OCR    │   │            │ │ Siamese model │
                       └──────────┘   └────────────┘ └───────────────┘
```

---

## Technology choices & rationale

| Choice | Why |
|---|---|
| **Next.js 15 App Router + React 19** | One codebase ships the public site, authenticated dashboard, API routes, and PWA shell. Server components and route handlers cut bundle size and let us hide secrets server-side. |
| **TypeScript** | Catches data-shape mistakes between Firestore ↔ React ↔ API early; mandatory for a team this size. |
| **Firebase (Auth + Firestore + Storage)** | Drop-in user system + per-user document storage with security rules. Frees us from building auth and a backend DB from scratch. |
| **Google Cloud Vision** | State-of-the-art OCR across 200+ languages including Arabic. Gives us accuracy + language detection in one API call. |
| **OpenRouter** | Single API key, multiple LLMs (GPT-4.1-mini default, swappable to Llama, Claude, Gemini). Lets us A/B models without rewriting code. |
| **PyTorch Siamese + EfficientNet-B0 + Transformer** | Domain-specific signature similarity needs a learned feature extractor, not a general-purpose API. EfficientNet for image features, a small transformer for spatial pooling, cosine similarity for verdict. Hosted as a Firebase Python Cloud Function so it scales to zero when idle. |
| **Serwist (Next.js PWA)** | Modern, typed service-worker library that integrates cleanly with App Router. Gives offline support + install prompt with ~20 lines of config. |
| **Bubblewrap (Trusted Web Activity)** | Wraps the deployed PWA into a signed APK without writing native Kotlin/Java. Hot-updates from the web deploy, so we ship one codebase to web + mobile. |
| **Netlify** | Zero-config Next.js hosting with preview deploys per PR, edge functions, and free TLS for the `.netlify.app` subdomain. |

---

## Data flow examples

**OCR upload:** Browser → upload image to Firebase Storage → POST to `/api/ocr` → Vision API → optional Llama refinement → write `ocr` field to Firestore → UI re-renders from Firestore listener → History page picks it up.

**Signature verification:** Browser → upload both images to Firebase Storage + Firestore records (category: "Signature Reference" / "Signature Test") → POST to `/api/verify-signature` → Next.js proxies to Firebase Python function → PyTorch model runs cosine similarity → JSON verdict → UI displays + history records updated with similarity score.

**AI chat:** User message + attached files → `/api/chat-bot` → loads conversation history from session store → ingests attached files (Vision OCR for images, pdf-parse for PDFs, JSZip for DOCX) → calls OpenRouter with context-grounded prompt → returns answer with evidence + confidence.

---

## Engineering quality

- **Strict ESLint + TypeScript** — every PR runs the same `npm run build` gate that Netlify uses.
- **Firestore security rules + Storage rules** — users can only read/write their own documents ([firestore.rules](firestore.rules), [storage.rules](storage.rules)).
- **Composite indexes** declared up-front so queries don't fail in production ([firestore.indexes.json](firestore.indexes.json)).
- **Service-worker exclusions** — `sw.js` and worker chunks are git-ignored; built fresh on every deploy.
- **Responsive across 5 breakpoints** — 1280 / 1024 / 768 / 560 / 420 px, with separate mobile bottom nav and safe-area padding for notched devices.
- **Code-split per route** — App Router gives us automatic per-page bundles (~3 KB JS for `/history`, ~104 KB shared base).

---

## What's shipped vs. roadmap

**Live in prod today:** all features above, on web + installable PWA. APK is one bubblewrap command away (the live manifest + icons + service worker are already deployed).

**Future polish:** swap `<img>` tags for `next/image` for better LCP, retrain signature model with broader augmentation to handle out-of-distribution inputs, wire `GEMINI_API_KEY` into the chat-bot as an alternative provider.

---

## Team

Built by a 9-person team — see [Team Members.md](Team%20Members.md).
