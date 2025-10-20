import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ProfileFormData } from "@/types/profile";

/**
 * Service class for handling profile-related operations
 */
export class ProfileService {
    /**
     * Updates the user profile in Firestore
     * @param userId - The ID of the user whose profile is being updated
     * @param profileData - The new profile data to be saved
     */
    static async updateProfile(userId: string, profileData: ProfileFormData): Promise<void> {
        try {
            // Convert ProfileFormData to a plain object that Firebase can accept
            const updateData = {
                firstName: profileData.firstName,
                lastName: profileData.lastName,
            };
            
            await updateDoc(doc(db, "users", userId), updateData);
        } catch (error) {
            console.error("Error updating profile:", error);
            throw error;
        }
    }
}