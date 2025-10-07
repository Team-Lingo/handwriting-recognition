# Handwriting Recognition Prototype

This project is a minimal proof of concept for recognizing handwritten English
and Arabic text using [Next.js](https://nextjs.org) and
[Tesseract.js](https://github.com/naptha/tesseract.js).

## Features

- Upload an image of handwriting.
- The server performs OCR using Tesseract.js with the bundled English and Arabic
  language models.
- Displays the extracted text and detects whether it is written in English,
  Arabic, or if the language is unclear.

## Getting Started

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open <http://localhost:3000> to view the app.

## Project Structure

- `public/models` – Contains the pre‑trained Tesseract `.traineddata` files for
  English (`eng`) and Arabic (`ara`). These are used directly by the OCR worker
  so no download is needed at runtime.
- `src/app/api/ocr/route.ts` – API route that handles image upload and runs
  Tesseract.js to extract text.
- `src/components/ImageUploader.tsx` – Client component for selecting an image
  and displaying the OCR result.

## Building

To create an optimized production build:

```bash
npm run build
```

The trained models are included in this repository so the build works offline.
