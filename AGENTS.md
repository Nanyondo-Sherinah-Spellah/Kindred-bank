<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Hausa, Igbo and Yoruba spoken turns use capability-checked NDJSON replies, translating complete thoughts before speech generation; verified account credentials retain the non-streaming path so recognition cookies are set before headers are sent, and customer read-back excludes numbers and credentials.
- Fictional account opening uses capability-protected applications, admin-only customer exports and an atomic email-verification function; test identity checks never activate real bank accounts or staff auth users.
- Customer-facing replies are composed server-side in `src/lib/engine.server.ts` from approved `knowledge` rows; the AI only classifies intent and picks a knowledge id — keeps answers non-fabricated and auditable.
- `customers.demo_verification_code` is never granted to `authenticated`; verification runs in server functions via the admin client — prevents codes reaching the browser.
- Channel workflows live in `src/lib/cs.functions.ts` and log to `interaction_logs`; staff functions require auth, while public voice functions accept only server-issued conversation capabilities and read a customer record only after an account number + verification code match (max 3 tries, digits masked in transcripts).
- Integration status is derived from server secrets presence only; never show a service as connected without credentials.
- The staff console exposes email, social, staff voice and WhatsApp assistants through the allowlist in `src/lib/access.ts`; public `/voice` is outside the protected layout, while `/staff-voice` retains private history and demo verification.
- The public index is an assistant launcher; protected assistants share a header with a return link to it, so navigation never requires a sidebar and staff authentication remains enforced.

- Phone layouts use shrink-safe grid tracks for text beside fixed controls, stacked assistant panels, and touch-sized inputs; the launcher uses a minimum viewport height and content-driven growth so short desktop and mobile screens never clip essential content.
- WhatsApp runs through `src/lib/whatsapp.server.ts` and the signed receiver `src/routes/api/public/whatsapp/webhook.ts`, storing every delivery in `whatsapp_webhook_events` before processing — keeps replies idempotent and retryable while using the same engine as other channels.
- Conversation language is remembered and passed to `classify`; public Hausa/Igbo/Yoruba replies use server-side faithful translation of approved text with immutable numeric/product placeholders, while other channels retain their existing approved wording.
- Public suggested questions are translated server-side from approved English questions with protected values and returned only in the selected language; client filtering never adds English fallback questions.
- Voice training is stored in a staff-readable question bank with original answers kept out of browser responses; reviewed replies use the existing logged escalation path, and an explicit voice language choice is recorded in the first transcript turn — keeps training auditable and the chosen language stable.
- Public voice uses `PublicVoiceChat` (voice or text-chat mode, chosen in the launcher bubble) on the launcher and on `/voice`; only a SHA-256 capability hash is stored in server-only `public_voice_access`, and every continuation verifies its session binding and expiry before access — prevents visitors from reading or modifying another conversation.
- Customer recognition uses expiring HttpOnly device capabilities for greetings only; atomic conversation verification is required again for private account access, and customer profiles never grant staff sign-in rights.
- Public voice/chat creates one support ticket per conversation; server-side satisfaction/end actions close only answered non-escalated cases and offer approved products absent from recorded holdings, leaving unresolved human cases open.
- Page-history arrows are mounted once in the root layout and use router history, with a home fallback for direct arrivals — keeps backward/forward navigation available across public and staff pages.
- Public browser speech selection is centralized in `browser-voice.ts`, uses explicit gender labels or known provider names, and locks the chosen voice for the mounted conversation — Web Speech exposes no gender metadata and installed voices vary by device.
- Hausa/Igbo/Yoruba voice auditions use the SDK Live relay with conversation capabilities and typed verification; backend delegation retrieves existing approved answers, and native accent quality is never claimed without listening review.
- The admin area is a standalone `/admin` layout (side nav: dashboard, AI assistant, downloads, new customers, voice test, settings) plus `/admin-login`, outside the staff layout and never linked publicly; its AI assistant (`src/lib/admin.functions.ts`) checks the admin role server-side and answers only from ticket data — keeps admin access hidden and role-gated.
