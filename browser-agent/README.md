# Local Browser Agent

A Chrome/Edge extension that takes a goal in plain English and works through it on
real web pages, one approved step at a time — driven entirely by a model running on
your own machine. No API keys, no credits, no page content leaving `localhost`.

```
  Side panel        Service worker            LM Studio
  goal + feed  ──▶  observe → think  ──HTTP──▶ localhost:1234
  approve/stop ◀──  propose  ──BLOCK──┐
                                      ▼
                              Content script
                        reads the page, clicks, types
```

Every step it takes is proposed to you first, with the target element highlighted on
the page. Nothing happens until you approve it.

## Setup on Windows

### 1. LM Studio

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

### 2. The extension

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this `browser-agent` folder.
4. Pin the extension and click its icon to open the side panel.
5. Open **Settings** from the panel and confirm the model name matches what LM Studio
   has loaded. **Test connection** tells you straight away if it doesn't.

### 3. Run a goal

Open a normal website, type a goal into the side panel, and press Start. For each step
you'll see the proposed action, the model's one-line reasoning, and an orange ring
around the element on the page. Approve it, reject it (the agent is told and tries
something else), or edit the text before it runs.

Good first goals:

- *"Find the contact email address on this site"* — should read and scroll, never click.
- *"Search for wireless keyboards and open the first result"*
- *"Fill in this form with the name Alex Kim"* — should stop and ask you for anything
  it doesn't know.

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

Eight tools, deliberately. A 4B model starts inventing tool names when given more.

## Design notes

A few decisions carry most of the weight:

**JSON-schema-constrained output, not tool-calling.** Requests set
`response_format: {type: "json_schema", strict: true}`, which LM Studio compiles into a
sampling grammar — the model physically cannot emit a malformed action. Free-form
tool-calling at 4B fails often enough to make the agent unusable. A second layer
(`validateAction`) then checks the action makes *sense*: that the element number exists
in the current snapshot, that a URL is http(s), that nothing is typing into a password
field.

**Compressed page snapshots.** The model never sees HTML. It sees a numbered list of at
most 80 visible interactive elements plus a 1500-character text digest. Only the current
snapshot goes in the prompt; earlier steps collapse to one line each (`3. Click [12]
"Next" → ok, navigated to /step2`). Without that compaction a 16k context is gone by
step six.

**Stale-ref rejection.** Every snapshot has an id, and every action carries the id of the
snapshot it was planned against. If the page changed in between, the action is refused
and the page re-read — otherwise the model ends up clicking whatever now happens to be
element [7].

**A side panel, not a popup.** A popup closes the moment you click the page, which in an
approve-every-step loop is constantly.

**Framework-safe typing.** Assigning `element.value` is invisible to React. The actuator
calls the native value setter and dispatches `input`/`change` by hand, the way a real
keystroke does.

## Safety

- Password field *values* are never read into the snapshot, so they never reach the
  model, the prompt, or the step log. The agent is blocked from typing into them and
  must use `ask_user` instead.
- Every page-touching action needs your explicit approval.
- The optional domain allowlist (Settings) flags any navigation off-list in the approval
  card.
- The endpoint defaults to `localhost`. **Pointing it at a remote host would send the
  contents of the pages you browse to that host.**

## Tests

```bash
npm install
npm test                  # everything
npm run test:unit         # pure logic — no browser needed
npm run test:dom          # content scripts against a real page
npm run test:extension    # the packed extension, end to end
```

`test/mock-llm-server.mjs` stands in for LM Studio, so the whole loop runs without a GPU.
To drive the real extension by hand against scripted actions:

```bash
node test/mock-llm-server.mjs --port 1234
```

…then set the endpoint in Settings to `http://localhost:1234/v1`.

## Troubleshooting

| Symptom | Cause |
|---|---|
| "Cannot reach the local model" | LM Studio's server isn't started, or the port differs. Check <http://localhost:1234/v1/models>. |
| "The model did not answer within…" | First token on a cold model can be slow. Raise the timeout in Settings, or use a smaller quantization. |
| "unusable actions in a row" | The model is too small or the context is too short. Raise Context Length to 16384+, or move up a model size. |
| "This agent cannot run on…" | Chrome blocks extensions on `chrome://` pages and the Web Store. Open an ordinary site. |
| Agent can't see part of the page | Content in a cross-origin iframe. Only the top frame is read in this version. |

## Not in this version

Screenshots/vision (unreliable and slow at 4B), cross-tab work, iframes, recorded macro
replay, Firefox.
