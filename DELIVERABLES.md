# Production Deliverables

End goal: **(1) signed APK** + **(2) fully working Netlify prod**.

## Status snapshot

| # | Item | Status |
|---|---|---|
| 1 | Netlify build green | 🟢 Fixed locally — push and watch deploy |
| 2 | PWA manifest served on prod | 🟡 Pending Netlify deploy |
| 3 | Env vars set in Netlify (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `GEMINI_API_KEY`) | 🟢 Done per latest build log |
| 4 | Signature model returns accurate results in prod | 🟡 Deployed with weights — needs human verification |
| 5 | AI chat bot works in prod | 🔴 Env var name mismatch: code reads `AI_MODEL`, you set `OPENROUTER_MODEL` |
| 6 | Floating chat bubble visible in prod | 🟡 Pending Netlify deploy |
| 7 | APK built via Bubblewrap | 🔴 Blocked until (2) is live |
| 8 | Digital Asset Links (no URL bar in app) | 🔴 Needs APK fingerprint |

---

## Action items in order

### 1. Push the build fix
The three Netlify build errors are fixed in [src/app/api/chat-bot/route.ts](src/app/api/chat-bot/route.ts) (removed unused import, replaced two `any` types). Also fixed a TypeScript blocker in [src/app/api/export-docx/route.ts](src/app/api/export-docx/route.ts) that would have been the next failure. Push to `main`, watch Netlify go green.

### 2. Verify signature model accuracy (after Netlify deploys)
- Open `/signature-verification` on the live site.
- Upload two **clearly different** signatures. Expect: similarity well below 99%, verdict `Likely forged`.
- Upload a matched pair. Expect: high similarity, `Likely genuine`.
- If still 99% on everything, the weights file didn't actually deploy — re-check `functions-python\final_signature_model.pth` exists and re-run `firebase deploy --only functions:python-api`.

### 3. Fix AI chat bot env var mismatch (one of these)
The code at [src/app/api/chat-bot/route.ts:272](src/app/api/chat-bot/route.ts#L272) reads `process.env.AI_MODEL`, but `.env.local` and Netlify set `OPENROUTER_MODEL`. Currently the chat bot silently falls back to hardcoded `openai/gpt-4.1-mini`.

Pick one:
- **Option A (recommended)**: change line 272 to `process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini"` so it matches the OCR route's convention. Then no var rename needed.
- **Option B**: add an `AI_MODEL` env var in Netlify (and `.env.local`) alongside `OPENROUTER_MODEL`.

### 4. Smoke-test the full app in prod
After (1)-(3) deploy:
- Login flow
- Quick text recognition (`/dashboard`)
- Language detection (`/language-detection`)
- Documents upload + OCR (`/documents`)
- Signature verification (`/signature-verification`)
- AI chat (`/ai-chat`) — confirm a non-default model response
- Floating chat bubble appears bottom-right on all dashboard pages, hidden on `/ai-chat`
- History page shows all uploads including signature pairs
- Open on phone browser → confirm responsive layout

### 5. Build the APK
Now that the PWA manifest is served, follow [android/BUILD_APK.md](android/BUILD_APK.md). Three commands after deploy:
```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
cd android
bubblewrap init --manifest https://lingo-handwriting-recognition.netlify.app/manifest.webmanifest
bubblewrap build
```
Paste the pre-decided answers from the runbook (app ID `com.lingo.handwriting`, default passwords `android`). Output: `android/app-release-signed.apk`.

### 6. Remove URL bar in app (optional, after APK works)
```powershell
bubblewrap fingerprint
```
Paste SHA-256 into `public/.well-known/assetlinks.json` (template in BUILD_APK.md), deploy to Netlify. URL bar disappears on next app launch.

### 7. Final sanity test
- Sideload APK on a phone: `adb install android/app-release-signed.apk`
- Open the app, complete the smoke-test from step (4) again from inside the wrapper.

---

## Reference: Env vars per environment

| Var | Used in | Set where |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | Web client bundle | Netlify |
| `GOOGLE_CLOUD_*` | Vision OCR (Next.js routes) | Netlify |
| `OPENROUTER_API_KEY` | chat-bot, ocr routes | Netlify |
| `OPENROUTER_MODEL` | ocr route (and chat-bot once you fix #3) | Netlify |
| `GEMINI_API_KEY` | *(not yet wired in code)* | Netlify (already set, harmless) |
| `SIGNATURE_VERIFY_URL` | verify-signature proxy fallback | Netlify (optional — only needed if cloudfunctions.net alias breaks) |
| *Firebase Python function* | runs `verify_signature` model | No env vars — deployed via `firebase deploy` |
