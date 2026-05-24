import { useState } from "react";

export default function FeedbackForm() {
  const [status, setStatus] = useState("idle");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = new FormData(form);

    const response = await fetch("https://formspree.io/f/xpqbvyza", {
      method: "POST",
      body: data,
      headers: { Accept: "application/json" },
    });

    if (response.ok) {
      setStatus("success");
      form.reset();
    } else {
      setStatus("error");
    }
  };

  return (
    <div style={{
      maxWidth: "480px", margin: "2rem auto", padding: "1.5rem",
      borderRadius: "12px", boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
      backgroundColor: "#ffffff"
    }}>
      <h3 style={{ color: "#1F3864", marginBottom: "1rem" }}>
        Share Your Feedback
      </h3>

      {status === "success" && (
        <p style={{ color: "#27AE60", marginBottom: "1rem" }}>
          ✅ Thanks! Your feedback has been received.
        </p>
      )}

      {status === "error" && (
        <p style={{ color: "#C0392B", marginBottom: "1rem" }}>
          ❌ Something went wrong. Please try again.
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="name"
          placeholder="Your name (optional)"
          style={{
            width: "100%", padding: "0.6rem 0.8rem",
            marginBottom: "0.75rem", borderRadius: "8px",
            border: "1px solid #ddd", fontSize: "14px",
            boxSizing: "border-box",
            color: "#1F3864", backgroundColor: "#ffffff"
          }}
        />
        <input
          type="email"
          name="email"
          placeholder="Your email (optional)"
          style={{
            width: "100%", padding: "0.6rem 0.8rem",
            marginBottom: "0.75rem", borderRadius: "8px",
            border: "1px solid #ddd", fontSize: "14px",
            boxSizing: "border-box",
            color: "#1F3864", backgroundColor: "#ffffff"
          }}
        />
        <textarea
          name="message"
          placeholder="What do you think of QRoots? Any suggestions?"
          required
          rows={4}
          style={{
            width: "100%", padding: "0.6rem 0.8rem",
            marginBottom: "0.75rem", borderRadius: "8px",
            border: "1px solid #ddd", fontSize: "14px",
            boxSizing: "border-box", resize: "vertical",
            color: "#1F3864", backgroundColor: "#ffffff"
          }}
        />
        <button
          type="submit"
          style={{
            width: "100%", padding: "0.75rem",
            backgroundColor: "#1F3864", color: "#ffffff",
            border: "none", borderRadius: "8px",
            fontSize: "15px", fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          Send Feedback
        </button>
      </form>
    </div>
  );
}