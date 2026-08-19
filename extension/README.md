# Local Browser Agent

A Chrome/Edge extension that takes a goal in plain English and works toward it in your
browser — clicking, typing, scrolling, reading pages — driven by a language model running
**on your own PC** through [Ollama](https://ollama.com). No API keys, no credits, no page
content ever leaves the machine.

```
side panel  ──goal──▶  service worker  ──http://localhost:11434──▶  Ollama (your GPU/CPU)
     ▲                       │
     └───steps/answer────────┤
                             ▼
                       content script  ──clicks / typing / reading──▶  the page
```

## Setup on Windows

**1. Install Ollama and a model**

```powershell
winget install Ollama.Ollama
ollama pull qwen3:8b
```

Model guidance — the agent needs instruction-following and JSON output, not size:

| Your hardware | Model | Notes |
| --- | --- | --- |
| 8 GB RAM, no GPU | `qwen2.5:3b-instruct` | fast, occasionally clumsy |
| 16 GB RAM / 8 GB VRAM | `qwen3:8b` *(default)* | best all-round balance |
| 24 GB+ VRAM | `qwen3:14b`, `llama3.1:8b` | better at multi-step plans |
| Vision (optional) | `qwen2.5vl:7b` | required if you enable screenshots |

**2. Let the extension talk to Ollama**

Ollama blocks cross-origin requests by default, so allow extension origins once:

```powershell
setx OLLAMA_ORIGINS "chrome-extension://*"
```

Then quit Ollama from the system tray and start it again (the variable is only read at
startup). Verify with `curl http://localhost:11434/api/tags`.

**3. Load the extension**

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. **Load unpacked** → select this `extension` folder.
4. Pin the extension and click its icon to open the side panel.
5. Open **Settings** in the panel and hit **Test connection** — it should list your models.

## Using it

Open the page you want to work from, type a goal, press **Run** (or Ctrl+Enter).

Goals that work well:

- *"Find the top 3 Hacker News stories about Rust and summarise them"*
- *"Search this site's docs for how to configure webhooks and give me the steps"*
- *"Fill the contact form with name Alex, email alex@example.com, message 'requesting a demo' — but stop before submitting"*

The panel streams each step: the model's reasoning, the action it chose, and what happened.
The task ends when the model answers, you press **Stop**, or the step limit is hit.

## Safety

- **Approve each action** (checkbox in the panel, or Settings) pauses before every action so
  you confirm or cancel — recommended while you learn how your model behaves.
- The system prompt forbids entering credentials and requires the agent to `ask` before
  anything irreversible: purchases, sending, posting, deleting. The model follows this most
  of the time, which is not the same as always — use step mode on sites that matter.
- The agent acts as **you**, in your logged-in session. Prefer a separate Chrome profile for
  unattended runs.
- It cannot touch `chrome://` pages, other extensions, or the file system.
- Disable **Let the agent open URLs directly** in Settings to keep it on the current site.

## How it works

| File | Role |
| --- | --- |
| `content/content.js` | Turns the DOM into a numbered list of visible interactive elements; executes click/type/select/scroll/press/extract. |
| `background/agent.js` | The loop: snapshot page → ask model → run action → repeat until `answer`. |
| `background/ollama.js` | Calls `/api/chat` with a JSON schema so replies are always parseable. |
| `background/prompt.js` | System prompt, page rendering, and the compact per-step history. |
| `sidepanel/` | Goal input, live step log, approval prompts. |
| `options/` | Endpoint, model picker, step limit, temperature, context size, safety toggles. |

Each turn sends only the system prompt, a one-line summary of previous steps, and the
current page — so context stays small and a local 8B model keeps up.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Could not reach Ollama" | `ollama serve` running? `OLLAMA_ORIGINS` set and Ollama restarted? |
| "Model did not return JSON" | Use an instruct-tuned model; `qwen3:8b` and `llama3.1:8b` are reliable. |
| Agent repeats one action | Lower temperature, or raise the context window so the whole element list fits. |
| "cannot act on browser pages" | Focus a normal http(s) tab before running. |
| Elements missing from the list | It only indexes visible elements in the top frame — scroll, or open the iframe's page directly. |
| Very slow steps | Smaller model, smaller `num_ctx`, and keep screenshots off. |
