# Local Agent

A Chrome/Edge extension that takes a goal in plain English and works through it on real
web pages, narrating what it's doing as a chat transcript — much like Claude's own
Chrome extension, but pointed at a backend you choose: a model running free on your own
machine, or Gemini with your API key.

```
  Side panel        Service worker         LM Studio (local, free)
  chat transcript   observe → think  ──┬──▶ or
  approve/stop       propose           └──▶ Gemini API (your key)
                        │
                        ▼
                  Content script
            reads the page, clicks, types
```

Password fields are never read into what the model sees, and the model's endpoint is
whichever backend you pick below — nothing else.

## Two backends

| | Local (LM Studio) | Gemini |
|---|---|---|
| Cost | Free | Your API key, Google's usage-based pricing |
| Where it runs | Entirely on your machine | Google's servers |
| Reliability | A 4B model misclicks sometimes | Tool-calling is reliable |
| Default approval | **Every step** — every action pauses for you | **Checkpoints only** — most actions run immediately; only a form submit, a navigation off your allowlist, or anything the model flags as sensitive pauses |

Both are switchable anytime in **Settings**, and the approval mode is overridable there
too, independent of which backend you're on.

## Setup on Windows

### Option A: Local (LM Studio, free)

1. Install [LM Studio](https://lmstudio.ai/) and download a model. On a GPU with
   **under 8 GB of VRAM**, use:

   | Model | Size | Notes |
   |---|---|---|
   | **Qwen3-4B-Instruct-2507** (Q4_K_M) | ~2.5 GB | Recommended. Leaves room for a 16k context. |
   | Qwen2.5-7B-Instruct (Q4_K_M) | ~4.7 GB | Better judgement if you have a full 8 GB free. |
   | Llama-3.2-3B-Instruct (Q4_K_M) | ~2.0 GB | Fallback for 4–6 GB cards. Weaker at multi-step goals. |

2. Go to the **Developer** tab (LM Studio 0.3.x; older builds call it **Local Server**).
3. Load the model and set **Context Length** to at least **16384**.
4. Turn **CORS on**, then **Start Server**.
5. Check it in a browser: <http://localhost:1234/v1/models> should return JSON.
6. In the extension's Settings, pick **Local (LM Studio)** and confirm the model name
   matches.

### Option B: Gemini (your API key)

1. Get an API key from [Google AI Studio](https://aistudio.google.com/apikey).
2. In the extension's Settings, pick **Gemini**, paste the key, and leave the model at
   `gemini-2.5-flash` (fast and cheap) or switch to `gemini-2.5-pro` for harder pages.
3. **Test connection** confirms the key works before you run anything.

The key is stored only in this browser profile (`chrome.storage.local`) and sent only in
the `x-goog-api-key` header of requests to `generativelanguage.googleapis.com` — never in
a URL, never anywhere else.

### The extension itself

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this `browser-agent` folder.
4. Pin the extension and click its icon to open the side panel.

### Run a goal

Type a goal into the composer at the bottom and send it. The transcript fills in as the
agent works: its narration, then an action chip (icon, one-line description, and a check
or cross once it's done). On local, every chip pauses for your Approve/Reject before it
runs, with the target element ringed on the page. On Gemini in checkpoint mode, most
chips just complete — you'll only be stopped for something worth a second look.

Good first goals:

- *"Find the contact email address on this site"* — should read and scroll, never click.
- *"Search for wireless keyboards and open the first result"*
- *"Fill in this form with the name Alex Kim"* — should stop and ask you for anything it
  doesn't know.

## What it can do

| Tool | What it does |
|---|---|
| `navigate` | Load a URL |
| `click` | Click an element |
| `type` | Type into a field, optionally pressing Enter |
| `select` | Choose a dropdown option |
| `scroll` | Up, down, top, bottom |
| `wait` | Let a page settle |
| `ask_user` | Ask you a question and wait |
| `done` | Finish, with the answer |

Eight tools, deliberately — and defined exactly once
(`src/shared/action-schema.js`), so the local backend's JSON schema and Gemini's function
declarations can never drift apart on what a tool accepts.

## Approval modes

Set in Settings, independent of backend:

- **Every step** — every page-touching action pauses for you. Local's default; a small
  model misclicks often enough that this isn't optional there.
- **Checkpoints only** — most actions run immediately. Only these pause: a form submit
  (clicking a submit button, or typing with Enter), a navigation to a domain not on your
  allowlist, or anything the model itself marks `sensitive` (a purchase, a delete, a
  post — the system prompt asks it to flag these). Gemini's default.
- **Manual** — identical to Every step, available regardless of backend, for anyone who
  wants Gemini's reliability with local's caution.

`ask_user` always pauses on both backends — that one isn't about trust, it's about
information the run genuinely doesn't have.

## Design notes

A few decisions carry most of the weight:

**One tool vocabulary, two backends.** `src/shared/action-schema.js` defines every tool's
fields once. The local backend turns that into a `response_format: {type: "json_schema",
strict: true}` request — LM Studio compiles it into a sampling grammar, so a malformed
action is structurally impossible, which matters enormously at 4B where free-form JSON
fails often enough to make the agent unusable. Gemini turns the *same* field definitions
into eight `functionDeclarations` for its native tool-calling
(`src/background/providers/gemini.js`). Either way, the model's reply is reshaped into one
common `{tool, reasoning, ...args}` object and run through the same `validateAction()` —
same stale-ref check, same password-field block, same allowlist check, regardless of
which backend answered.

**Compressed page snapshots.** The model never sees HTML. It sees a numbered list of at
most 80 visible interactive elements plus a 1500-character text digest. Only the current
snapshot goes in the prompt; earlier steps collapse to one line each (`3. Click [12]
"Next" → ok, navigated to /step2`). Without that compaction a 16k context is gone by
step six.

**Stale-ref rejection.** Every snapshot has an id, and every action carries the id of the
snapshot it was planned against. If the page changed in between, the action is refused
and the page re-read — otherwise the model ends up clicking whatever now happens to be
element [7].

**A side panel, not a popup.** A popup closes the moment you click the page, which in a
run with live checkpoints is constantly.

**Framework-safe typing.** Assigning `element.value` is invisible to React. The actuator
calls the native value setter and dispatches `input`/`change` by hand, the way a real
keystroke does.

**Append, don't re-render.** The transcript (`src/sidepanel/panel.js`) appends a
permanent node per completed step and only ever replaces one "live" node — the currently
in-flight typing indicator, pending approval, or question — rather than re-rendering the
whole history on every state update.

## Safety

- Password field *values* are never read into the snapshot, so they never reach the
  model, the prompt, or the step log. The agent is blocked from typing into them and must
  use `ask_user` instead — on both backends and in every approval mode.
- A form submit and an off-allowlist navigation always pause for approval, even in
  checkpoint mode.
- The Gemini API key is stored locally and sent only to Google's API in a header, never a
  URL.
- The local endpoint defaults to `localhost`. **Pointing it at a remote host would send
  the contents of the pages you browse to that host.**

## Tests

```bash
npm install
npm test                  # everything
npm run test:unit         # pure logic — no browser needed
npm run test:dom          # content scripts against a real page
npm run test:extension    # the packed extension, end to end
```

`test/mock-llm-server.mjs` stands in for either backend — `mode: 'local'` (default) for
LM Studio's API shape, `mode: 'gemini'` for Gemini's — so the whole loop runs without a
GPU or an API key. To drive the real extension by hand against scripted actions:

```bash
node test/mock-llm-server.mjs --port 1234              # local-shaped
node test/mock-llm-server.mjs --port 1234 --mode gemini # gemini-shaped
```

…then set the endpoint in Settings accordingly.

## Troubleshooting

| Symptom | Cause |
|---|---|
| "Cannot reach the local model" | LM Studio's server isn't started, or the port differs. Check <http://localhost:1234/v1/models>. |
| "Gemini rejected the request" | Check the API key in Settings, and that the Generative Language API is enabled for it. |
| "rate limit or quota exceeded" | Gemini quota — wait, or check usage in Google AI Studio. |
| "The model did not answer within…" | First token on a cold local model can be slow. Raise the timeout in Settings, or use a smaller quantization. |
| "unusable actions in a row" | The local model is too small or the context is too short. Raise Context Length to 16384+, or move up a model size. |
| "This agent cannot run on…" | Chrome blocks extensions on `chrome://` pages and the Web Store. Open an ordinary site. |
| Agent can't see part of the page | Content in a cross-origin iframe. Only the top frame is read in this version. |

## Not in this version

Screenshots/vision, cross-tab work, iframes, recorded macro replay, Firefox, and any
backend beyond local + Gemini.
