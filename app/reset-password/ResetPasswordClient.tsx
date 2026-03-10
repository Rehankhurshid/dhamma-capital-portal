"use client";

import type { CSSProperties, FormEvent } from "react";
import { useState } from "react";

export function ResetPasswordClient({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedPassword, setSavedPassword] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("This reset link is invalid or missing.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
          confirmPassword,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Unable to reset password.");
      }

      setSavedPassword(password);
      setMessage("Password updated. You can return to the login page and sign in.");
      setShowSuccessModal(true);
      setCopied(false);
      setPassword("");
      setConfirmPassword("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to reset password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <h1 style={styles.title}>Reset password</h1>
        <p style={styles.subtitle}>Choose a new password for the Dhamma Capital investor portal.</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            <span>New password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={styles.input}
              minLength={8}
              required
            />
          </label>

          <label style={styles.label}>
            <span>Confirm password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              style={styles.input}
              minLength={8}
              required
            />
          </label>

          {error ? <p style={styles.error}>{error}</p> : null}
          {message ? <p style={styles.success}>{message}</p> : null}

          <button type="submit" disabled={isSubmitting || !token} style={styles.button}>
            {isSubmitting ? "Updating..." : "Update password"}
          </button>
        </form>
      </section>

      {showSuccessModal ? (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCard}>
            <h2 style={styles.modalTitle}>Password updated</h2>
            <p style={styles.modalText}>Use this password to sign in again.</p>
            <div style={styles.passwordBox}>{savedPassword || "Password updated successfully"}</div>
            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(savedPassword);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? "Copied" : "Copy password"}
              </button>
              <a href="https://www.dhammacapital.in/login" style={styles.linkButton}>
                Back to login
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background: "linear-gradient(180deg, #f5f8fb 0%, #edf3f8 100%)",
    fontFamily: "Georgia, serif",
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    background: "#ffffff",
    border: "1px solid rgba(11, 74, 111, 0.12)",
    borderRadius: "18px",
    padding: "28px",
    boxShadow: "0 20px 60px rgba(15, 23, 42, 0.08)",
  },
  title: {
    margin: "0 0 8px",
    color: "#0b4a6f",
    fontSize: "32px",
    lineHeight: "1.1",
  },
  subtitle: {
    margin: "0 0 20px",
    color: "#4b6476",
    fontSize: "15px",
    lineHeight: "1.5",
  },
  form: {
    display: "grid",
    gap: "14px",
  },
  label: {
    display: "grid",
    gap: "8px",
    color: "#17365d",
    fontSize: "14px",
    fontWeight: 600,
  },
  input: {
    border: "1px solid rgba(23, 54, 93, 0.2)",
    borderRadius: "10px",
    padding: "12px 14px",
    fontSize: "15px",
    color: "#17365d",
  },
  button: {
    border: 0,
    borderRadius: "10px",
    padding: "12px 14px",
    fontSize: "15px",
    fontWeight: 600,
    background: "#0b4a6f",
    color: "#ffffff",
    cursor: "pointer",
  },
  error: {
    margin: 0,
    color: "#a32626",
    fontSize: "14px",
  },
  success: {
    margin: 0,
    color: "#0f6b43",
    fontSize: "14px",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.42)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
  },
  modalCard: {
    width: "100%",
    maxWidth: "420px",
    background: "#ffffff",
    borderRadius: "18px",
    padding: "24px",
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)",
    display: "grid",
    gap: "14px",
  },
  modalTitle: {
    margin: 0,
    color: "#0b4a6f",
    fontSize: "28px",
    lineHeight: "1.1",
  },
  modalText: {
    margin: 0,
    color: "#4b6476",
    fontSize: "15px",
    lineHeight: "1.5",
  },
  passwordBox: {
    border: "1px solid rgba(23, 54, 93, 0.16)",
    borderRadius: "12px",
    padding: "14px 16px",
    background: "#f6f9fc",
    color: "#17365d",
    fontSize: "15px",
    fontWeight: 600,
    wordBreak: "break-word",
  },
  modalActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
  secondaryButton: {
    border: "1px solid rgba(11, 74, 111, 0.18)",
    borderRadius: "10px",
    padding: "12px 14px",
    fontSize: "15px",
    fontWeight: 600,
    background: "#ffffff",
    color: "#0b4a6f",
    cursor: "pointer",
  },
  linkButton: {
    borderRadius: "10px",
    padding: "12px 14px",
    fontSize: "15px",
    fontWeight: 600,
    background: "#0b4a6f",
    color: "#ffffff",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
};
