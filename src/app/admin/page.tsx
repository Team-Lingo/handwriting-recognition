"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { UserProfile } from "@/types/profile";

interface UserRow extends UserProfile {
  id: string;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, userProfile, loading } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const isAdmin = useMemo(() => (userProfile?.role === "Admin"), [userProfile]);

  useEffect(() => {
    if (loading) return; // wait for auth to resolve

    // Not signed in -> go to login
    if (!user) {
      router.replace("/login");
      return;
    }

    // Signed in but not admin -> send to dashboard
    if (!isAdmin) {
      router.replace("/dashboard");
      return;
    }

    // Admin -> fetch all users
    const run = async () => {
      try {
        setFetching(true);
        setFetchError(null);
        const snap = await getDocs(collection(db, "users"));
        const list: UserRow[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as UserProfile) }));
        setUsers(list);
      } catch (err) {
        console.error("Failed to load users:", err);
        const message = (err as any)?.code === "permission-denied"
          ? "Permission denied. Ensure Firestore rules allow Admins to read the users collection and that your user has role 'Admin'."
          : (err as any)?.message || "Unknown error fetching users.";
        setFetchError(message);
      } finally {
        setFetching(false);
      }
    };

    run();
  }, [loading, user, isAdmin, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">Loading...</div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  const setRole = async (targetUser: UserRow, newRole: "Admin" | "User") => {
    try {
      setUpdating((m) => ({ ...m, [targetUser.id]: true }));
      await updateDoc(doc(db, "users", targetUser.id), { role: newRole });
      setUsers((list) => list.map((u) => (u.id === targetUser.id ? { ...u, role: newRole } : u)));
    } catch (err) {
      console.error("Failed to update role:", err);
      alert((err as any)?.message || "Failed to update role");
    } finally {
      setUpdating((m) => ({ ...m, [targetUser.id]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl bg-white rounded-lg shadow">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h1 className="text-2xl font-semibold">Admin • Users</h1>
          <button
            onClick={() => router.push("/profile")}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            Back to Profile
          </button>
        </div>

        <div className="p-6 overflow-x-auto">
          {fetching ? (
            <p>Loading users…</p>
          ) : fetchError ? (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
              {fetchError}
            </div>
          ) : users.length === 0 ? (
            <p>No users found.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">UID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">First Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((u) => {
                  const currentRole = (u.role ?? "User");
                  const isSelf = u.id === user!.uid;
                  const canDemoteSelf = !(isSelf && currentRole === "Admin");
                  const busy = !!updating[u.id];
                  const targetRole = currentRole === "Admin" ? "User" : "Admin";

                  return (
                    <tr key={u.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{u.id}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{u.firstName || "-"}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{u.lastName || "-"}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{u.email || "-"}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{currentRole}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{u.createdAt ? new Date(u.createdAt).toLocaleString() : "-"}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <button
                          disabled={busy || (!canDemoteSelf && targetRole === "User")}
                          onClick={() => setRole(u, targetRole)}
                          className={`px-3 py-1 rounded border text-sm ${
                            targetRole === "Admin"
                              ? "bg-indigo-600 text-white hover:bg-indigo-700"
                              : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          title={!canDemoteSelf && targetRole === "User" ? "You cannot remove your own Admin role" : ""}
                        >
                          {busy ? "Updating…" : targetRole === "Admin" ? "Make Admin" : "Make User"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
