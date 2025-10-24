"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { ProfileForm } from "@/components/ProfileForm";
import { ProfileView } from "@/components/ProfileView";
import { ProfileService } from "@/services/profileService";
import { ProfileFormData } from "@/types/profile";

/**
 * Profile page component that handles user profile management
 * Includes viewing and editing functionality with proper authentication checks
 */
export default function ProfilePage() {
    // Hooks for authentication, routing and state management
    const { user, userProfile, refreshUserProfile } = useAuth();
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);

    // Form state management
    const [formData, setFormData] = useState<ProfileFormData>({
        firstName: userProfile?.firstName || "",
        lastName: userProfile?.lastName || "",
    });

    // Authentication check - redirect to login if not authenticated
    if (!user || !userProfile) {
        router.push("/login");
        return null;
    }

    /**
     * Handles form input changes
     * @param e - Change event from form inputs
     */
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    /**
     * Handles form submission and profile update
     * @param e - Form submission event
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await ProfileService.updateProfile(user.uid, formData);
            // Refresh user profile data from Firebase
            await refreshUserProfile();
            setIsEditing(false);
        } catch (error) {
            console.error("Error updating profile:", error);
        }
    };

    /**
     * Handles cancellation of profile editing
     * Resets form data to current profile values
     */
    const handleCancel = () => {
        setIsEditing(false);
        setFormData({
            firstName: userProfile.firstName,
            lastName: userProfile.lastName,
        });
    };

    return (
        <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="px-6 py-8">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-bold text-gray-900">
                            Profile
                        </h2>
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Back to Dashboard
                        </button>
                    </div>

                    {!isEditing ? (
                        <ProfileView 
                            userProfile={userProfile} 
                            onEdit={() => setIsEditing(true)} 
                        />
                    ) : (
                        <ProfileForm
                            formData={formData}
                            onSubmit={handleSubmit}
                            onChange={handleInputChange}
                            onCancel={handleCancel}
                        />
                    )}

                    {/* Change Password Section */}
                    <div className="mt-10 border-t pt-8">
                        <h3 className="text-lg font-semibold mb-4">Change Password</h3>
                        {user && user.providerData[0]?.providerId === "password" ? (
                            <form className="space-y-4" onSubmit={async (e) => {
                                e.preventDefault();
                                const form = e.target as HTMLFormElement;
                                const oldPassword = (form.elements.namedItem('oldPassword') as HTMLInputElement).value;
                                const newPassword = (form.elements.namedItem('newPassword') as HTMLInputElement).value;
                                
                                try {
                                    const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import('firebase/auth');
                                    const { auth } = await import('@/lib/firebase');
                                    const credential = EmailAuthProvider.credential(
                                        user.email!,
                                        oldPassword
                                    );
                                    
                                    // First, re-authenticate
                                    await reauthenticateWithCredential(user, credential);
                                    
                                    // Then change password
                                    await updatePassword(user, newPassword);
                                    
                                    // Clear form and show success
                                    form.reset();
                                    alert('Password changed successfully!');
                                } catch (error: any) {
                                    alert(error.message || 'Failed to change password. Please try again.');
                                }
                            }}>
                                <div>
                                    <label htmlFor="oldPassword" className="block text-sm font-medium text-gray-700">Old Password</label>
                                    <input
                                        type="password"
                                        id="oldPassword"
                                        name="oldPassword"
                                        required
                                        minLength={6}
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">New Password</label>
                                    <input
                                        type="password"
                                        id="newPassword"
                                        name="newPassword"
                                        required
                                        minLength={6}
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    Change Password
                                </button>
                            </form>
                        ) : (
                            <div className="text-yellow-600 text-sm mt-4">
                                You cannot change your password because you signed up with Google.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}