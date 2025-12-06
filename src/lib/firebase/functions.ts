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

/**
 * Start email MFA verification
 */
export async function callStartEmailMfa() {
  const idToken = await auth.currentUser?.getIdToken();
  
  const response = await fetch('/api/mfa/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to start MFA');
  }

  return response.json();
}

/**
 * Clear email MFA
 */
export async function callClearEmailMfa() {
  const idToken = await auth.currentUser?.getIdToken();
  
  const response = await fetch('/api/mfa/clear', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to clear MFA');
  }

  return response.json();
}

export async function callVerifyEmailMfa(code: string) {
  const idToken = await auth.currentUser?.getIdToken();
  
  const response = await fetch('/api/mfa/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Invalid verification code');
  }

  return response.json();
}
