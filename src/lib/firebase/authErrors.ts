export function getFriendlyAuthError(code: string): string {
  const errorMessages: Record<string, string> = {
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/operation-not-allowed': 'This operation is not allowed.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'auth/requires-recent-login': 'Please log in again to continue.',
    'auth/invalid-verification-code': 'Invalid verification code.',
    'auth/invalid-verification-id': 'Invalid verification ID.',
    'auth/code-expired': 'Verification code has expired.',
    'auth/missing-verification-code': 'Please enter the verification code.',
    'auth/missing-verification-id': 'Verification ID is missing.',
    'auth/quota-exceeded': 'Quota exceeded. Please try again later.',
    'auth/captcha-check-failed': 'reCAPTCHA verification failed.',
    'auth/invalid-phone-number': 'Invalid phone number.',
    'auth/missing-phone-number': 'Please enter a phone number.',
    'auth/credential-already-in-use': 'This credential is already in use.',
    'auth/timeout': 'Request timeout. Please try again.',
    'auth/app-deleted': 'This app instance has been deleted.',
    'auth/invalid-api-key': 'Invalid API key.',
    'auth/invalid-user-token': 'Invalid user token. Please log in again.',
    'auth/expired-action-code': 'This action code has expired.',
    'auth/invalid-action-code': 'Invalid action code.',
    'auth/unauthorized-domain': 'This domain is not authorized.',
  };

  return errorMessages[code] || `An error occurred: ${code}`;
}
