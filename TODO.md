# TODO: Re-implement AI Logic for Handwriting Recognition

- [x] Update `src/types/ocr.ts` to include optional fields: `correctedText?: string; accuracy?: number; notes?: string[];`
- [x] Install `fast-levenshtein` package via npm
- [x] Modify `src/app/api/ocr/route.ts`:
  - [x] Add logic to call LanguageTool API for English text after extraction
  - [x] Construct `correctedText` by applying LanguageTool suggestions
  - [x] Calculate `accuracy` using Levenshtein distance formula
  - [x] Extract `notes` from LanguageTool response matches
  - [x] Update payload to include new fields only for English text
- [x] Test the OCR endpoint to verify functionality (build successful)
