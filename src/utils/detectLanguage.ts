export const detectLanguage = (text: string): "English" | "Arabic" | "Unknown" => {
    const arabic = /[\u0600-\u06FF]/;
    const latin = /[A-Za-z]/;
    const hasArabic = arabic.test(text);
    const hasLatin = latin.test(text);
    if (hasArabic && !hasLatin) return "Arabic";
    if (hasLatin && !hasArabic) return "English";
    return "Unknown";
};
