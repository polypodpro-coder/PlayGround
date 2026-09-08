# Meshy connection fix — 2026-09-07

## Findings

- The supplied Worker, `https://poly-pod-meshy.polypodpro.workers.dev`, answers keyless API requests with the expected missing-key JSON and permits the GitHub Pages origin in the tested responses. CORS was not established as the user's failure cause.
- The live site asked each buyer to deploy and configure a proxy. It did not default to the owner's working service.
- GitHub Actions run `34172350951` built Claude commit `6a5dd9b1554ef18495db9911318b34813aec0f45` successfully but failed the deploy job before any steps ran. The last successful run was `34170668436` on `claude/3d-model-generator-stl-IifOO` at `f9a8cdafcdfd513c409b429a948533283852a790`.

## Changes

- Default to the owner-supplied Worker while preserving explicit custom settings.
- Connect Meshy with a buyer-owned API key; custom proxy setup moves to Advanced, with a restore-default action.
- Check service connectivity without a key. Check authenticated access with a read-only task-list request before saving settings. Neither check creates a generation task.
- Reject proxy URLs with query/fragment delimiters or embedded login credentials, and reject pasted key whitespace/control characters.
- Provide specific HTTP/network diagnostics, 15-second connection-check timeouts, abort handling, and key-redacted error messages. Browser requests omit cookies and reject redirects.
- Correct credential-handling text: the selected proxy operator receives the buyer's key in transit. Keys remain saved in browser localStorage until cleared; they are not embedded in builds.
- Use the API settings link from [Meshy's authentication documentation](https://docs.meshy.ai/en/api/authentication). The check uses the [documented task-list endpoint](https://docs.meshy.ai/en/api/text-to-3d).
- Clarify that stopping browser polling does not cancel an already submitted Meshy task or refund credits.

## Validation

- 196 Node tests passed, including mocked connection, auth/credit/rate-limit errors, response validation, redaction, timeouts, aborts, URL validation and storage behavior.
- Oxlint and Vite production build passed.
- Browser at `http://127.0.0.1:4180/#/create`: default Worker populated; keyless service check passed against the real Worker; missing-key form validation passed; invalid fragment URL rejected before network; restore-default action passed; no horizontal page overflow in the inspected desktop viewport.
- No real API key was read, no authenticated Meshy call was made, no generation was started, and no Meshy credits were spent during verification.
- No Cloudflare settings or deployed Worker code changed. Broader Worker redirect/resource-limit hardening remains separate work.

## Remaining boundary

The buyer must supply a valid API key in the site. Successful account authentication, actual API credit availability, paid generation, and downloading a real generated result cannot be claimed from keyless checks and mocked tests. The exact original user-visible error was not supplied during this fix.
