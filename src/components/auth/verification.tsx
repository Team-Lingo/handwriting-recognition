import React from "react";
import styles from "./verification.module.css";
import LoadingButton from "@/components/loading/loading/LoadingButton";

interface VerificationProps {
  code: string;
  onCodeChange: (v: string) => void;
  onSubmit: () => void;
  onResend?: () => void;
  error?: string;
  loading?: boolean;
  resendLoading?: boolean;
}
const Verification = ({
  code,
  onCodeChange,
  onSubmit,
  onResend,
  error,
  loading,
  resendLoading,
}: VerificationProps) => {
  const handleResend = async () => {
    await onResend?.();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className={styles.container}>
      <form className={styles.wrapper} onSubmit={handleFormSubmit}>
        <h2 className={styles.title}>
          We’ve sent a one-time code to your email. Enter it below to verify
          your login.
        </h2>
        <div className={styles.inputGroup}>
          <label className={styles.label}>Code</label>
          <input
            type="text"
            className={styles.input}
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            placeholder=""
          />
        </div>
        <LoadingButton
          onClick={onSubmit}
          loading={loading}
          className={styles.button}
          type="submit"
          spinnerType="dots"
        >
          {loading ? "Verifying..." : "Verify"}
        </LoadingButton>
        {error && <p className={styles.error}>{error}</p>}
        {onResend && (
          <LoadingButton
            onClick={handleResend}
            loading={resendLoading}
            className={styles.link}
            type="button"
            size="small"
            variant="secondary"
          >
            {resendLoading ? "Sending..." : "Resend the code?"}
          </LoadingButton>
        )}
      </form>
    </div>
  );
};

export default Verification;
