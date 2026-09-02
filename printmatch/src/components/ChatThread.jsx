import { useState } from "react";
import { Camera, Send } from "lucide-react";

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ChatThread({ messages, currentRole, onSend }) {
  const [text, setText] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend?.(text.trim());
    setText("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.map((m) => {
          const mine = m.senderRole === currentRole;
          return (
            <div
              key={m.id}
              className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm ${
                  mine
                    ? "rounded-br-sm bg-navy text-white"
                    : "rounded-bl-sm bg-white text-navy ring-1 ring-black/5"
                }`}
              >
                {m.imageUrl && (
                  <img
                    src={m.imageUrl}
                    alt="Update"
                    className="mb-1.5 max-h-40 w-full rounded-lg object-cover"
                  />
                )}
                {m.text && <p>{m.text}</p>}
              </div>
              <span className="mt-1 text-[10px] text-navy/35">
                {formatTime(m.timestamp)}
              </span>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={submit}
        className="flex items-center gap-2 border-t border-black/5 bg-white px-3 py-2.5"
      >
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-navy/50 hover:bg-navy/5"
          aria-label="Attach photo"
        >
          <Camera size={19} />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message..."
          className="min-w-0 flex-1 rounded-full bg-gray-100 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
        />
        <button
          type="submit"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white active:scale-95"
          aria-label="Send"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
