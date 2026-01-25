import { auth } from '../firebase';

/**
 * Call backend function to update user profile
 */
export async function callUpdateProfile(profileData: {
  firstName: string;
  lastName: string;
  timezone: string;
  timeFormat: string;
}) {
  const idToken = await auth.currentUser?.getIdToken();
  
  const response = await fetch('/api/profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify(profileData),
  });

  if (!response.ok) {
    throw new Error('Failed to update profile');
  }

  return response.json();
}
