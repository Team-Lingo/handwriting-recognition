"use client";

import { UserProfile } from "@/types/profile";

interface ProfileViewProps {
    userProfile: UserProfile;
    onEdit: () => void;
}

/**
 * Component for displaying user profile information
 */
export function ProfileView({ userProfile, onEdit }: ProfileViewProps) {
    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">
                    First Name
                </label>
                <p className="mt-1 text-lg text-gray-900">{userProfile.firstName}</p>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">
                    Last Name
                </label>
                <p className="mt-1 text-lg text-gray-900">{userProfile.lastName}</p>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">
                    Email
                </label>
                <p className="mt-1 text-lg text-gray-900">{userProfile.email}</p>
            </div>
            <div className="mt-6">
                <button
                    onClick={onEdit}
                    className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    Edit Profile
                </button>
            </div>
        </div>
    );
}