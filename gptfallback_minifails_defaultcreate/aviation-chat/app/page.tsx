"use client";
import { useState } from "react";

export default function ChatUI() {
  const [messages, setMessages] = useState<
    { role: string; content: string }[]
  >([]);
  const [json, setJson] = useState(null);

  const sendMessage = async (question: string, pastedJson: string) => {
    let parsedJson = null;

    if (pastedJson.trim()) {
      try {
        parsedJson = JSON.parse(pastedJson);
      } catch {
        alert("Invalid JSON format!");
        return;
      }
    }

    const jsonToSend = parsedJson || json || {};

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [...messages, { role: "user", content: question }],
        existingJson: jsonToSend,
      }),
    });

    const data = await response.json();

    if (data.error) {
    // Show the error as an assistant message
    setMessages([
      ...messages,
      { role: "user", content: question },
      { role: "assistant", content: `⚠️ ${data.error}` },
    ]);
    return;
  }

    setMessages([
      ...messages,
      { role: "user", content: question },
      { role: "assistant", content: data.text },
      { role: "assistant-json", content: JSON.stringify(data.updatedJson, null, 2) },
    ]);

    setJson(data.updatedJson || jsonToSend);
  };

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* Chat Window */}
      <div className="border rounded p-4 h-96 overflow-y-auto mb-4 space-y-3">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`p-2 rounded-lg max-w-[80%] ${
              msg.role === "user"
                ? "bg-blue-500 text-white ml-auto text-right"
                : msg.role === "assistant"
                ? "bg-gray-200 text-black mr-auto text-left"
                : "bg-black text-green-400 text-xs font-mono whitespace-pre-wrap mr-auto"
            }`}
          >
            {msg.content}
          </div>
        ))}
      </div>

      {/* Inputs */}
      <ChatInputs onSend={sendMessage} />

      {/* JSON Preview */}
      <pre className="mt-4 bg-black-100 p-2 rounded text-sm overflow-x-auto">
        {JSON.stringify(json, null, 2)}
      </pre>
    </div>
  );
}

function ChatInputs({ onSend }) {
  const [question, setQuestion] = useState("");
  const [jsonInput, setJsonInput] = useState("");

  return (
    <div className="flex flex-col gap-2">
      {/* Question Input */}
      <input
        className="border rounded px-2 py-1"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Enter your question..."
      />

      {/* JSON Input (only needed first time) */}
      <textarea
        className="border rounded px-2 py-1 text-sm"
        rows={6}
        value={jsonInput}
        onChange={(e) => setJsonInput(e.target.value)}
        placeholder="Paste JSON here (only required first time)"
      />

      <button
        onClick={() => {
          if (question.trim()) {
            onSend(question, jsonInput);
            setQuestion("");
            setJsonInput(""); // clear JSON after first send
          }
        }}
        className="px-4 py-1 bg-blue-600 text-white rounded"
      >
        Send
      </button>
    </div>
  );
}