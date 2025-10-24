// Type definition for user profile data
export interface UserProfile {
    firstName: string;
    lastName: string;
    email: string;
    createdAt: string;
    role?: "Admin" | "User" | string;
}

// Type definition for form input data
export interface ProfileFormData {
    firstName: string;
    lastName: string;
}