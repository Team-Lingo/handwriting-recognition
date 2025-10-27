"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { ProfileForm } from "@/components/ProfileForm";
import { ProfileView } from "@/components/ProfileView";
import { ProfileService } from "@/services/profileService";
import { ProfileFormData } from "@/types/profile";
import { storage, db } from "@/lib/firebase";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { doc, updateDoc, deleteField } from "firebase/firestore";

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

    // Redirect if not authenticated
    if (!user || !userProfile) {
        router.push("/login");
        return null;
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await ProfileService.updateProfile(user.uid, formData);
            await refreshUserProfile();
            setIsEditing(false);
        } catch (error) {
            console.error("Error updating profile:", error);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setFormData({ firstName: userProfile.firstName, lastName: userProfile.lastName });
    };

    // Profile picture upload state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Upload helper - uploads a File to Storage and updates Firestore
    const uploadFile = async (file: File) => {
        setUploadError(null);
        setSuccessMessage(null);
        if (!user) {
            setUploadError("No authenticated user.");
            return;
        }

        // Resize image client-side to limit dimensions and reduce upload size
        const resizeImage = (file: File, maxDim = 300): Promise<File> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                const reader = new FileReader();
                reader.onload = () => {
                    img.src = reader.result as string;
                };
                reader.onerror = (e) => reject(e);
                img.onerror = (e) => reject(e);
                img.onload = async () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return reject(new Error('Canvas not supported'));

                    const { width, height } = img;
                    const ratio = Math.min(1, maxDim / Math.max(width, height));
                    const targetW = Math.round(width * ratio);
                    const targetH = Math.round(height * ratio);
                    canvas.width = targetW;
                    canvas.height = targetH;
                    ctx.drawImage(img, 0, 0, targetW, targetH);

                    canvas.toBlob((blob) => {
                        if (!blob) return reject(new Error('Image resize failed'));
                        const newFile = new File([blob], file.name, { type: blob.type });
                        resolve(newFile);
                    }, 'image/jpeg', 0.85);
                };

                reader.readAsDataURL(file);
            });
        };

        try {
            setUploading(true);
            // resize before upload to save bandwidth and storage
            const fileToUpload = await resizeImage(file, 300);
            const basename = `${Date.now()}_${fileToUpload.name}`;
            const path = `users/${user.uid}/files/${basename}`;
            const sRef = storageRef(storage, path);
            const uploadTask = uploadBytesResumable(sRef, fileToUpload as any);

            await new Promise<void>((resolve, reject) => {
                uploadTask.on(
                    "state_changed",
                    (snapshot) => {
                        const prog = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        setUploadProgress(Math.round(prog));
                    },
                    (error) => reject(error),
                    () => resolve()
                );
            });

            const url = await getDownloadURL(sRef);
            // save both the download URL and storage path so we can remove the object later if needed
            await updateDoc(doc(db, "users", user.uid), { profilePictureUrl: url, profilePicturePath: path });
            await refreshUserProfile();
            setSelectedFile(null);
            setUploadProgress(null);
            setSuccessMessage("Profile picture uploaded successfully.");
        } catch (err: any) {
            setUploadError(err.message || "Upload failed");
        } finally {
            setUploading(false);
        }
    };

    // Remove profile picture: delete storage object if path available, and remove fields from user doc
    const removeProfilePicture = async () => {
        if (!user) return;
        const confirmRemove = confirm("Are you sure you want to remove your profile picture?");
        if (!confirmRemove) return;

        setUploadError(null);
        setSuccessMessage(null);
        try {
            const profilePath = (userProfile as any)?.profilePicturePath;
            if (profilePath) {
                try {
                    await deleteObject(storageRef(storage, profilePath));
                } catch (err) {
                    // ignore storage deletion errors but log
                    console.error("Failed to delete storage object:", err);
                }
            }

            await updateDoc(doc(db, "users", user.uid), { profilePictureUrl: deleteField(), profilePicturePath: deleteField() });
            await refreshUserProfile();
            setSuccessMessage("Profile picture removed.");
        } catch (err: any) {
            setUploadError(err.message || "Failed to remove profile picture");
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="px-6 py-8">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-bold text-gray-900">Profile</h2>
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Back to Dashboard
                        </button>
                    </div>

                    {!isEditing ? (
                        <ProfileView userProfile={userProfile} onEdit={() => setIsEditing(true)} />
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
                                    const credential = EmailAuthProvider.credential(user.email!, oldPassword);
                                    await reauthenticateWithCredential(user, credential);
                                    await updatePassword(user, newPassword);
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
                            (() => {
                                const pid = user?.providerData[0]?.providerId;
                                const providerName = pid === 'google.com' ? 'Google' : pid === 'github.com' ? 'GitHub' : 'your identity provider';
                                return (
                                    <div className="text-yellow-600 text-sm mt-4">
                                        You cannot change your password because you signed up with {providerName}.
                                    </div>
                                );
                            })()
                        )}
                    </div>

                    {/* Connected Accounts Section */}
                    <div className="mt-10 border-t pt-8">
                        <h3 className="text-lg font-semibold mb-4">Connected Accounts</h3>
                        <div className="space-y-3">
                            {/* Link/Unlink Google */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-medium">Google</div>
                                    <div className="text-sm text-gray-500">
                                        {user.providerData.some(p => p.providerId === 'google.com') ? 'Connected' : 'Not connected'}
                                    </div>
                                </div>
                                {user.providerData.some(p => p.providerId === 'google.com') ? (
                                    <button
                                        className="px-3 py-1 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
                                        onClick={async () => {
                                            try {
                                                // Prevent unlinking the last provider
                                                if (user.providerData.length <= 1) {
                                                    alert('You cannot unlink the only sign-in method.');
                                                    return;
                                                }
                                                const { unlink } = await import('firebase/auth');
                                                await unlink(user, 'google.com');
                                                await user.reload();
                                                alert('Google account unlinked.');
                                            } catch (err: any) {
                                                alert(err?.message || 'Failed to unlink Google.');
                                            }
                                        }}
                                    >
                                        Unlink
                                    </button>
                                ) : (
                                    <button
                                        className="px-3 py-1 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
                                        onClick={async () => {
                                            try {
                                                const { GoogleAuthProvider, linkWithPopup } = await import('firebase/auth');
                                                const provider = new GoogleAuthProvider();
                                                await linkWithPopup(user, provider);
                                                await user.reload();
                                                alert('Google account linked.');
                                            } catch (err: any) {
                                                // Surface guidance if account exists with different credential
                                                if (err?.code === 'auth/account-exists-with-different-credential') {
                                                    alert('This email is already used by another provider. Sign in with that provider first, then link Google.');
                                                } else {
                                                    alert(err?.message || 'Failed to link Google.');
                                                }
                                            }
                                        }}
                                    >
                                        Link
                                    </button>
                                )}
                            </div>

                            {/* Link/Unlink GitHub */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-medium">GitHub</div>
                                    <div className="text-sm text-gray-500">
                                        {user.providerData.some(p => p.providerId === 'github.com') ? 'Connected' : 'Not connected'}
                                    </div>
                                </div>
                                {user.providerData.some(p => p.providerId === 'github.com') ? (
                                    <button
                                        className="px-3 py-1 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
                                        onClick={async () => {
                                            try {
                                                if (user.providerData.length <= 1) {
                                                    alert('You cannot unlink the only sign-in method.');
                                                    return;
                                                }
                                                const { unlink } = await import('firebase/auth');
                                                await unlink(user, 'github.com');
                                                await user.reload();
                                                alert('GitHub account unlinked.');
                                            } catch (err: any) {
                                                alert(err?.message || 'Failed to unlink GitHub.');
                                            }
                                        }}
                                    >
                                        Unlink
                                    </button>
                                ) : (
                                    <button
                                        className="px-3 py-1 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
                                        onClick={async () => {
                                            try {
                                                const { GithubAuthProvider, linkWithPopup } = await import('firebase/auth');
                                                const provider = new GithubAuthProvider();
                                                provider.addScope('user:email');
                                                await linkWithPopup(user, provider);
                                                await user.reload();
                                                alert('GitHub account linked.');
                                            } catch (err: any) {
                                                if (err?.code === 'auth/account-exists-with-different-credential') {
                                                    alert('This email is already used by another provider. Sign in with that provider first, then link GitHub.');
                                                } else {
                                                    alert(err?.message || 'Failed to link GitHub.');
                                                }
                                            }
                                        }}
                                    >
                                        Link
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}