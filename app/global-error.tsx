"use client";

export default function GlobalError({
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html lang="en">
            <body
                style={{
                    margin: 0,
                    fontFamily: "system-ui, sans-serif",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "100vh",
                    backgroundColor: "#0a0a0a",
                    color: "#ededed",
                }}
            >
                <div style={{ textAlign: "center" }}>
                    <h2 style={{ marginBottom: "1rem" }}>Something went wrong</h2>
                    <button
                        onClick={reset}
                        style={{
                            padding: "0.5rem 1.5rem",
                            backgroundColor: "#ededed",
                            color: "#0a0a0a",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "1rem",
                        }}
                    >
                        Try again
                    </button>
                </div>
            </body>
        </html>
    );
}
