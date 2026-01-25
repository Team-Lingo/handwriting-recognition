"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { MdAdminPanelSettings, MdSecurity, MdSettings } from "react-icons/md";

import DashboardHeader from "@/components/Dashboard/DashboardHeader";
import DashboardSidebar from "@/components/Dashboard/DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { ProfileService } from "@/services/profileService";
import type { ProfileFormData } from "@/types/profile";
import { storage, db } from "@/lib/firebase";
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { doc, updateDoc, deleteField } from "firebase/firestore";

import "../dashboard/dashboard.css";
import "./settings.css";

export default function SettingsPage() {
    const { user, userProfile, refreshUserProfile, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const [isEditingProfile, setIsEditingProfile] = useState(false);

    const [formData, setFormData] = useState<ProfileFormData>({
        firstName: userProfile?.firstName || "",
        lastName: userProfile?.lastName || "",
    });

    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [pwdBusy, setPwdBusy] = useState(false);
    const [pwdError, setPwdError] = useState<string | null>(null);
    const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (!loading && (!user || !userProfile)) {
            router.push(`/auth?next=${encodeURIComponent(pathname || "/settings")}`);
        }
    }, [loading, user, userProfile, router, pathname]);

    useEffect(() => {
        setFormData({
            firstName: userProfile?.firstName || "",
            lastName: userProfile?.lastName || "",
        });
    }, [userProfile?.firstName, userProfile?.lastName]);

    if (loading || !user || !userProfile) {
        return (
            <div className="dashboard-layout">
                <DashboardSidebar user={user} userProfile={userProfile} />
                <main className="dashboard-main">
                    <div className="loading-container">Loading...</div>
                </main>
            </div>
        );
    }

    const firstName = userProfile?.firstName || user.displayName?.split(" ")[0] || "User";

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSuccessMessage(null);
        try {
            await ProfileService.updateProfile(user.uid, formData);
            await refreshUserProfile();
            setIsEditingProfile(false);
            setSuccessMessage("Profile updated.");
        } catch (error) {
            console.error("Error updating profile:", error);
            setUploadError((error as Error).message || "Failed to update profile");
        }
    };

    const handleCancel = () => {
        setIsEditingProfile(false);
        setFormData({ firstName: userProfile.firstName, lastName: userProfile.lastName });
    };

    const uploadFile = async (file: File) => {
        setUploadError(null);
        setSuccessMessage(null);

        const resizeImage = (original: File, maxDim = 300): Promise<File> => {
            return new Promise((resolve, reject) => {
                const img = new window.Image();
                const reader = new FileReader();

                reader.onload = () => {
                    img.src = reader.result as string;
                };
                reader.onerror = (e) => reject(e);
                img.onerror = (e) => reject(e);

                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return reject(new Error("Canvas not supported"));

                    const { width, height } = img;
                    const ratio = Math.min(1, maxDim / Math.max(width, height));
                    const targetW = Math.round(width * ratio);
                    const targetH = Math.round(height * ratio);

                    canvas.width = targetW;
                    canvas.height = targetH;
                    ctx.drawImage(img, 0, 0, targetW, targetH);

                    canvas.toBlob(
                        (blob) => {
                            if (!blob) return reject(new Error("Image resize failed"));
                            resolve(new File([blob], original.name, { type: blob.type }));
                        },
                        "image/jpeg",
                        0.85,
                    );
                };

                reader.readAsDataURL(original);
            });
        };

        try {
            const fileToUpload = await resizeImage(file, 300);
            const basename = `${Date.now()}_${fileToUpload.name}`;
            const path = `users/${user.uid}/files/${basename}`;
            const sRef = storageRef(storage, path);
            const uploadTask = uploadBytesResumable(sRef, fileToUpload);

            await new Promise<void>((resolve, reject) => {
                uploadTask.on(
                    "state_changed",
                    (snapshot) => {
                        const prog = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        setUploadProgress(Math.round(prog));
                    },
                    (err) => reject(err),
                    () => resolve(),
                );
            });

            const url = await getDownloadURL(sRef);
            await updateDoc(doc(db, "users", user.uid), { profilePictureUrl: url, profilePicturePath: path });
            await refreshUserProfile();

            setUploadProgress(null);
            setSuccessMessage("Profile picture updated.");
        } catch (err) {
            setUploadError((err as Error).message || "Upload failed");
            setUploadProgress(null);
        }
    };

    const removeProfilePicture = async () => {
        const confirmRemove = confirm("Are you sure you want to remove your profile picture?");
        if (!confirmRemove) return;

        setUploadError(null);
        setSuccessMessage(null);

        try {
            const profilePath = userProfile?.profilePicturePath as string | undefined;
            if (profilePath) {
                try {
                    await deleteObject(storageRef(storage, profilePath));
                } catch (err) {
                    console.error("Failed to delete storage object:", err);
                }
            }

            await updateDoc(doc(db, "users", user.uid), {
                profilePictureUrl: deleteField(),
                profilePicturePath: deleteField(),
            });

            await refreshUserProfile();
            setSuccessMessage("Profile picture removed.");
        } catch (err) {
            setUploadError((err as Error).message || "Failed to remove profile picture");
        }
    };

    const canChangePassword = user.providerData[0]?.providerId === "password";

    const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!canChangePassword) return;

        setPwdBusy(true);
        setPwdError(null);
        setPwdSuccess(null);

        const form = e.currentTarget;
        const oldPassword = (form.elements.namedItem("oldPassword") as HTMLInputElement).value;
        const newPassword = (form.elements.namedItem("newPassword") as HTMLInputElement).value;

        try {
            const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import("firebase/auth");
            const credential = EmailAuthProvider.credential(user.email!, oldPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);
            form.reset();
            setPwdSuccess("Password changed successfully.");
        } catch (error) {
            const err = error as Error;
            setPwdError(err.message || "Failed to change password.");
        } finally {
            setPwdBusy(false);
        }
    };

    const unlinkProvider = async (providerId: string) => {
        try {
            if (user.providerData.length <= 1) {
                alert("You cannot unlink the only sign-in method.");
                return;
            }
            const { unlink } = await import("firebase/auth");
            await unlink(user, providerId);
            await user.reload();
            alert("Account unlinked.");
        } catch (err) {
            alert((err as Error).message || "Failed to unlink.");
        }
    };

    const linkGoogle = async () => {
        try {
            const { GoogleAuthProvider, linkWithPopup } = await import("firebase/auth");
            const provider = new GoogleAuthProvider();
            await linkWithPopup(user, provider);
            await user.reload();
            alert("Google account linked.");
        } catch (err) {
            const error = err as { code?: string; message?: string };
            if (error?.code === "auth/account-exists-with-different-credential") {
                alert(
                    "This email is already used by another provider. Sign in with that provider first, then link Google.",
                );
            } else {
                alert(error?.message || "Failed to link Google.");
            }
        }
    };

    const linkGitHub = async () => {
        try {
            const { GithubAuthProvider, linkWithPopup } = await import("firebase/auth");
            const provider = new GithubAuthProvider();
            provider.addScope("user:email");
            await linkWithPopup(user, provider);
            await user.reload();
            alert("GitHub account linked.");
        } catch (err) {
            const error = err as { code?: string; message?: string };
            if (error?.code === "auth/account-exists-with-different-credential") {
                alert(
                    "This email is already used by another provider. Sign in with that provider first, then link GitHub.",
                );
            } else {
                alert(error?.message || "Failed to link GitHub.");
            }
        }
    };

    const isGoogleConnected = user.providerData.some((p) => p.providerId === "google.com");
    const isGitHubConnected = user.providerData.some((p) => p.providerId === "github.com");

    return (
        <div className="dashboard-layout">
            <DashboardSidebar user={user} userProfile={userProfile} />
            <main className="dashboard-main">
                <div className="dashboard-content">
                    <DashboardHeader userName={firstName} />

                    <div className="settings-topbar">
                        <div className="settings-topbar-title">
                            <h2 className="settings-title">Settings</h2>
                            <p className="settings-subtitle">Profile, security, and connected accounts.</p>
                        </div>

                        {successMessage ? (
                            <div className="settings-banner settings-banner-success" role="status">
                                {successMessage}
                            </div>
                        ) : uploadError ? (
                            <div className="settings-banner settings-banner-error" role="alert">
                                {uploadError}
                            </div>
                        ) : null}
                    </div>

                    <div className="settings-grid">
                        <section className="settings-card">
                            <div className="settings-card-head">
                                <div className="settings-card-icon" aria-hidden="true">
                                    <MdSettings />
                                </div>
                                <div>
                                    <div className="settings-card-title">Profile</div>
                                    <div className="settings-card-desc">Update your personal information.</div>
                                </div>
                            </div>

                            {!isEditingProfile ? (
                                <div className="settings-rows">
                                    <div className="settings-row">
                                        <div className="settings-row-text">
                                            <div className="settings-row-label">First name</div>
                                            <div className="settings-row-hint">{userProfile.firstName}</div>
                                        </div>
                                    </div>
                                    <div className="settings-row">
                                        <div className="settings-row-text">
                                            <div className="settings-row-label">Last name</div>
                                            <div className="settings-row-hint">{userProfile.lastName}</div>
                                        </div>
                                    </div>
                                    <div className="settings-row">
                                        <div className="settings-row-text">
                                            <div className="settings-row-label">Email</div>
                                            <div className="settings-row-hint">{userProfile.email}</div>
                                        </div>
                                    </div>

                                    <div className="settings-actions">
                                        <button
                                            type="button"
                                            className="settings-link"
                                            onClick={() => setIsEditingProfile(true)}>
                                            Edit profile
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <form className="settings-form" onSubmit={handleProfileSubmit}>
                                    <div className="settings-field">
                                        <label className="settings-label" htmlFor="firstName">
                                            First name
                                        </label>
                                        <input
                                            id="firstName"
                                            name="firstName"
                                            type="text"
                                            value={formData.firstName}
                                            onChange={handleInputChange}
                                            className="settings-input"
                                        />
                                    </div>

                                    <div className="settings-field">
                                        <label className="settings-label" htmlFor="lastName">
                                            Last name
                                        </label>
                                        <input
                                            id="lastName"
                                            name="lastName"
                                            type="text"
                                            value={formData.lastName}
                                            onChange={handleInputChange}
                                            className="settings-input"
                                        />
                                    </div>

                                    <div className="settings-form-actions">
                                        <button type="submit" className="settings-link">
                                            Save changes
                                        </button>
                                        <button type="button" className="settings-btn" onClick={handleCancel}>
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            )}
                        </section>

                        <section className="settings-card">
                            <div className="settings-card-head">
                                <div className="settings-card-icon" aria-hidden="true">
                                    <MdSecurity />
                                </div>
                                <div>
                                    <div className="settings-card-title">Security</div>
                                    <div className="settings-card-desc">
                                        Change password and manage sign-in methods.
                                    </div>
                                </div>
                            </div>

                            <div className="settings-rows">
                                {canChangePassword ? (
                                    <form className="settings-form" onSubmit={handleChangePassword}>
                                        <div className="settings-field">
                                            <label className="settings-label" htmlFor="oldPassword">
                                                Old password
                                            </label>
                                            <input
                                                id="oldPassword"
                                                name="oldPassword"
                                                type="password"
                                                minLength={6}
                                                required
                                                className="settings-input"
                                            />
                                        </div>
                                        <div className="settings-field">
                                            <label className="settings-label" htmlFor="newPassword">
                                                New password
                                            </label>
                                            <input
                                                id="newPassword"
                                                name="newPassword"
                                                type="password"
                                                minLength={6}
                                                required
                                                className="settings-input"
                                            />
                                        </div>

                                        {pwdError ? (
                                            <div
                                                className="settings-inline-alert settings-inline-alert-error"
                                                role="alert">
                                                {pwdError}
                                            </div>
                                        ) : pwdSuccess ? (
                                            <div
                                                className="settings-inline-alert settings-inline-alert-success"
                                                role="status">
                                                {pwdSuccess}
                                            </div>
                                        ) : null}

                                        <div className="settings-form-actions">
                                            <button type="submit" className="settings-link" disabled={pwdBusy}>
                                                {pwdBusy ? "Changing…" : "Change password"}
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="settings-inline-alert settings-inline-alert-warn">
                                        You can’t change your password because you signed up with an external provider.
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="settings-card">
                            <div className="settings-card-head">
                                <div className="settings-card-icon" aria-hidden="true">
                                    <span className="settings-avatar" aria-hidden="true">
                                        {userProfile.profilePictureUrl ? (
                                            <NextImage
                                                src={userProfile.profilePictureUrl}
                                                alt="Profile"
                                                width={42}
                                                height={42}
                                                className="settings-avatar-img"
                                            />
                                        ) : (
                                            (userProfile.firstName?.[0] || "U").toUpperCase()
                                        )}
                                    </span>
                                </div>
                                <div>
                                    <div className="settings-card-title">Profile picture</div>
                                    <div className="settings-card-desc">Upload, change, or remove your avatar.</div>
                                </div>
                            </div>

                            <div className="settings-rows">
                                <div className="settings-row">
                                    <div className="settings-row-text">
                                        <div className="settings-row-label">Upload new picture</div>
                                        <div className="settings-row-hint">PNG or JPG, cropped to a circle.</div>
                                    </div>
                                    <button
                                        type="button"
                                        className="settings-btn"
                                        onClick={() => fileInputRef.current?.click()}>
                                        Choose
                                    </button>
                                </div>

                                {userProfile.profilePictureUrl ? (
                                    <div className="settings-row">
                                        <div className="settings-row-text">
                                            <div className="settings-row-label">Remove picture</div>
                                            <div className="settings-row-hint">Reverts to initials.</div>
                                        </div>
                                        <button
                                            type="button"
                                            className="settings-btn settings-btn-danger"
                                            onClick={removeProfilePicture}>
                                            Remove
                                        </button>
                                    </div>
                                ) : null}

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="settings-hidden-input"
                                    onChange={(e) => {
                                        setUploadError(null);
                                        const f = e.target.files?.[0];
                                        if (f) void uploadFile(f);
                                    }}
                                />

                                {uploadProgress !== null ? (
                                    <div className="settings-inline-alert">Uploading… {uploadProgress}%</div>
                                ) : null}
                            </div>
                        </section>

                        <section className="settings-card">
                            <div className="settings-card-head">
                                <div className="settings-card-icon" aria-hidden="true">
                                    <MdAdminPanelSettings />
                                </div>
                                <div>
                                    <div className="settings-card-title">Connected accounts</div>
                                    <div className="settings-card-desc">Link or unlink sign-in providers.</div>
                                </div>
                            </div>

                            <div className="settings-rows">
                                <div className="settings-row">
                                    <div className="settings-row-text">
                                        <div className="settings-row-label">Google</div>
                                        <div className="settings-row-hint">
                                            {isGoogleConnected ? "Connected" : "Not connected"}
                                        </div>
                                    </div>
                                    {isGoogleConnected ? (
                                        <button
                                            type="button"
                                            className="settings-btn"
                                            onClick={() => void unlinkProvider("google.com")}>
                                            Unlink
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            className="settings-link"
                                            onClick={() => void linkGoogle()}>
                                            Link
                                        </button>
                                    )}
                                </div>

                                <div className="settings-row">
                                    <div className="settings-row-text">
                                        <div className="settings-row-label">GitHub</div>
                                        <div className="settings-row-hint">
                                            {isGitHubConnected ? "Connected" : "Not connected"}
                                        </div>
                                    </div>
                                    {isGitHubConnected ? (
                                        <button
                                            type="button"
                                            className="settings-btn"
                                            onClick={() => void unlinkProvider("github.com")}>
                                            Unlink
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            className="settings-link"
                                            onClick={() => void linkGitHub()}>
                                            Link
                                        </button>
                                    )}
                                </div>

                                {userProfile.role === "Admin" ? (
                                    <div className="settings-row">
                                        <div className="settings-row-text">
                                            <div className="settings-row-label">Admin console</div>
                                            <div className="settings-row-hint">Manage users and roles.</div>
                                        </div>
                                        <Link href="/admin" className="settings-btn">
                                            Open
                                        </Link>
                                    </div>
                                ) : null}
                            </div>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
}
