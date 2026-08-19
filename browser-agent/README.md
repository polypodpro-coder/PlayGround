# Local Browser Agent

A Chrome/Edge extension that takes a goal in plain English ("find the cheapest flight to Lisbon next
Tuesday and tell me the price") and drives your browser to accomplish it — clicking, typing,
scrolling, reading — using a **large language model running on your own PC**. No cloud API, no
account, no credits.

## How it works

```
side panel (goal)  ->  background service worker  ->  local LLM (Ollama / OpenAI-compatible)
                                  |                            |
                                  |     one JSON action per step
                                  v
                          content script  ->  the real page (click / type / read / scroll)
```

Each step the agent:
1. Snapshots the active tab — URL, title, up to 120 visible interactive elements with stable
   per-step ids, and truncated visible text.
2. Asks the local model for exactly one action as JSON.
3. Executes it, then loops with the new page state.

Old observations collapse to a one-liner so the context stays small enough for an 8B model.

## Setup on Windows

### 1. Install a local model runner

**Ollama** (easiest):

```powershell
winget install Ollama.Ollama
ollama pull qwen3:8b        # good balance; qwen2.5:14b or llama3.1:8b also work
```

Ollama refuses cross-origin requests by default, so allow the extension once:

```powershell
setx OLLAMA_ORIGINS "chrome-extension://*"
```

Then quit Ollama from the system tray and start it again (the variable is only read at startup).

**Alternatives:** LM Studio (`http://localhost:1234`) or llama.cpp's `llama-server`
(`http://localhost:8080`) — pick the *OpenAI-compatible* provider in settings. Both need CORS
enabled for extension origins (LM Studio: enable the local server's CORS toggle; llama.cpp: run with
`--cors` / `--api-cors`).

### 2. Load the extension

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. **Load unpacked** → select the `browser-agent` folder.
4. Pin the extension and click its icon to open the side panel.

### 3. Configure

Open **Settings** from the side panel and press **Test connection**. It should list your installed
models. Set the model name, and optionally an allow-list of domains the agent may touch.

## Using it

1. Open the page you want to start from (the agent works in the **active tab**).
2. Open the side panel, type a goal, press **Run** (or Ctrl+Enter).
3. Watch each step in the log; press **Stop** at any time.
4. If the agent needs a decision it asks in the panel — type an answer and press Send.

Example goals:
- `Search Hacker News for "sqlite" and summarise the top 3 story titles.`
- `On this Wikipedia article, find the population figure and tell me the number.`
- `Fill the contact form with name Alex and email alex@example.com, but ask me before sending.`

## Actions the model can take

| Action | Effect |
| --- | --- |
| `navigate` | Load a URL in the active tab |
| `click` | Click an element by its snapshot id |
| `type` | Set an input's value, optionally pressing Enter |
| `select` | Choose an option in a `<select>` |
| `scroll` | up / down / top / bottom |
| `back` | Browser back |
| `read` | Read visible text, optionally under a CSS selector |
| `wait` | Let the page settle |
| `ask` | Ask you a question and wait |
| `done` | Finish, with an answer |

## Safety

- The system prompt forbids entering credentials and requires confirmation before irreversible
  actions (purchases, deletions, sending, posting). This is a prompt-level guardrail, not a
  sandbox — supervise runs on sites where you're logged in.
- **Allowed domains** in settings is a hard check enforced in the background worker: the agent is
  stopped if the tab leaves the list, and `navigate` outside it is refused.
- `maxSteps` bounds runaway loops. **Stop** aborts mid-step, including the in-flight model call.
- Browser-internal pages (`chrome://`, `edge://`, extension pages) are refused outright.
- Page content is untrusted input to the model. Instructions embedded in a page can try to steer the
  agent; the domain allow-list and supervision are your defence.

## Files

| Path | Role |
| --- | --- |
| `manifest.json` | MV3 manifest |
| `background.js` | Message router, run lifecycle |
| `src/agent.js` | The observe → think → act loop |
| `src/llm.js` | Ollama + OpenAI-compatible clients, JSON repair |
| `src/prompt.js` | System prompt and observation formatting |
| `src/settings.js` | Defaults, storage, domain allow-list |
| `content/content.js` | Page snapshotting and action execution |
| `sidepanel/` | Goal input, live log, question prompts |
| `options/` | Provider/model/limits configuration |

## Tuning

- **Model too slow?** Try a 4B–8B model, or a quantised build (`qwen3:8b-q4_K_M`).
- **Model ignores the JSON format?** Keep temperature at 0 and prefer instruct-tuned models. The
  parser already strips code fences and `<think>` blocks.
- **Agent picks wrong elements?** Scroll to the relevant part of the page before starting — the
  snapshot budget prioritises in-viewport elements.
