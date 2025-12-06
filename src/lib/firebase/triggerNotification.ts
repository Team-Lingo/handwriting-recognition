import { auth } from '../firebase';

export default async function triggerNotification(data: {
  type: string;
  notification: string;
}) {
  const idToken = await auth.currentUser?.getIdToken();
  
  const response = await fetch('/api/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    console.error('Failed to trigger notification');
  }

  return response.ok;
}
