export interface OcrResponse {
    text: string;
    language: "English" | "Arabic" | "Unknown";
    correctedText?: string;
    accuracy?: number;
    notes?: string[];
}
