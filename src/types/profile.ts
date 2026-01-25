// Type definition for user profile data
export interface UserOcrStats {
    analyzedCount: number;
    accuracyCount: number;
    accuracySum: number;
    avgAccuracy: number | null;
    languages: Record<string, number>;
}

export interface UserProfile {
    firstName: string;
    lastName: string;
    email: string;
    createdAt: string;
    role?: "Admin" | "User" | string;
    profilePictureUrl?: string;
    profilePicturePath?: string;
    ocrStats?: UserOcrStats;
}

// Type definition for form input data
export interface ProfileFormData {
    firstName: string;
    lastName: string;
}
