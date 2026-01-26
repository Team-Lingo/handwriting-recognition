export const detectLanguage = (text: string): "English" | "Arabic" | "Arabic and English" | "Unknown" => {
    const arabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    const latin = /[A-Za-z]/;
    const hasArabic = arabic.test(text);
    const hasLatin = latin.test(text);
    if (hasArabic && hasLatin) return "Arabic and English";
    if (hasArabic && !hasLatin) return "Arabic";
    if (hasLatin && !hasArabic) return "English";
    return "Unknown";
};
