export interface OcrResponse {
    text: string;
    language: "English" | "Arabic" | "Arabic and English" | "Unknown";
    correctedText?: string;
    accuracy?: number;
    notes?: string[];
}
