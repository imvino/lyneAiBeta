"use client";
import { useState } from "react";

export default function Home() {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!message.trim()) return;

    const newChat = [...chat, { role: "user", content: message }];
    setChat(newChat);
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/lyneports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newChat }),
      });

      const data = await res.json();
      setChat([
        ...newChat,
        { role: "assistant", content: data.text, data: data.data }
      ]);
    } catch {
      setChat([
        ...newChat,
        { role: "assistant", content: "⚠️ Error connecting to server" }
      ]);
    }
    setLoading(false);
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "700px",
        height: "90vh",
        background: "rgba(255,255,255,0.95)",
        borderRadius: "16px",
        boxShadow: "0 8px 25px rgba(0,0,0,0.2)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        backdropFilter: "blur(10px)"
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#002147", // navy blue aviation theme
          color: "white",
          padding: "1rem",
          textAlign: "center",
          fontWeight: "bold",
          fontSize: "1.2rem",
          letterSpacing: "1px"
        }}
      >
        ✈️ Lyneports ChatBot
      </div>

      {/* Chat window */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1rem",
          backgroundColor: "#f8fafc"
        }}
      >
        {chat.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              margin: "0.75rem 0"
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.5rem",
                maxWidth: "75%"
              }}
            >
              {msg.role === "assistant" && <span>✈️</span>}
              {msg.role === "user" && <span>👤</span>}
              <div
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius:
                    msg.role === "user"
                      ? "16px 16px 0 16px"
                      : "16px 16px 16px 0",
                  background: msg.role === "user" ? "#1a73e8" : "#e2e8f0",
                  color: msg.role === "user" ? "white" : "#1a202c",
                  fontSize: "0.95rem",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                  maxWidth: "75%",
                  wordWrap: "break-word",    // ✅ force wrapping of long words
                  whiteSpace: "pre-wrap"     // ✅ preserve formatting, wrap long text
                }}
              >

                {msg.content}

                {/* Show structured data if present */}
                {msg.data && Object.keys(msg.data).length > 0 && (
                  <details style={{ marginTop: "0.5rem" }}>
                    <summary style={{ cursor: "pointer", fontSize: "0.85rem" }}>
                      📐 Design Data
                    </summary>
                    <pre
                      style={{
                        background: "#111827",
                        color: "#10b981",
                        padding: "0.5rem",
                        borderRadius: "8px",
                        fontSize: "0.8rem",
                        maxWidth: "100%",        // ✅ restrict width
                        overflowX: "auto",       // ✅ scroll if too wide
                        whiteSpace: "pre-wrap",  // ✅ wrap long lines
                        wordWrap: "break-word"   // ✅ prevent overflow
                      }}
                    >
                      {JSON.stringify(msg.data, null, 2)}
                    </pre>

                  </details>
                )}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ fontStyle: "italic", color: "#666" }}>
            ✈️ Co-pilot is typing...
          </div>
        )}
      </div>

      {/* Input bar */}
      <div
        style={{
          display: "flex",
          padding: "0.75rem",
          borderTop: "1px solid #ddd",
          background: "#f1f5f9"
        }}
      >
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask about helipads, vertiports, designs..."
          style={{
            flex: 1,
            padding: "0.75rem",
            borderRadius: "20px",
            border: "1px solid #ccc",
            outline: "none",
            fontSize: "0.95rem",
            marginRight: "0.5rem"
          }}
        />
        <button
          onClick={sendMessage}
          style={{
            padding: "0.75rem 1.5rem",
            border: "none",
            borderRadius: "20px",
            background: "#1a73e8",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onMouseDown={(e) => {
            e.target.style.transform = "scale(0.95)";
            e.target.style.background = "#1669d9"; // darker blue
          }}
          onMouseUp={(e) => {
            e.target.style.transform = "scale(1)";
            e.target.style.background = "#1a73e8"; // original
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
