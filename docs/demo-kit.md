# Demo kit

## Prompts checked against the widget rulebook

Use these verbatim. Each names the storage behavior so the model picks the
right storage type.

1. **Shared poll (main demo)**
   > Create a poll titled "What should we build next?" with the options Mobile app, Billing revamp, and Onboarding. Everyone on the team votes and sees the live totals with percentage bars. Votes are shared with the whole workspace. Remember in personal storage which option this person chose, show "You voted for …", and let them change their vote.

2. **Launch countdown**
   > Make a big, attractive countdown to Friday at 5 PM showing days, hours, minutes, and seconds, updating every second. No storage needed.

3. **Personal scratchpad**
   > Create a personal notes widget with a large text area that automatically saves what I type in personal storage so it is still there after a refresh. Show a small "Saved" indicator.

Stretch, only if time allows:

4. **Shared expense tracker**
   > Create a shared expense tracker. Everyone sees the same list of expenses (description, amount, category) and the total. Each person can hide categories using checkboxes, and that filter is remembered only for them in personal storage.

## If generation fails live

- Click generate again once; Luminal occasionally returns 503 and the backend retries.
- Fall back to the saved poll you created during rehearsal. **Rehearse by
  generating and saving the poll before the demo**, so a working widget already
  exists in the workspace.
- Last resort: open `/widgets/<id>?preview=1` with the engine's built-in sample
  poll, which never touches Luminal.

## 90-second script

**0–15s — the problem.** "Teams constantly need tiny apps: a poll, a countdown, a shared list. AI can write them in seconds, but hosting, sharing, and saving data still takes hours. WorkspaceZero makes that part disappear."

**15–40s — generate.** Logged in as admin. Type prompt 1. "I describe what I need in plain English. Our backend asks DeepSeek on Luminal Cloud to write a complete mini-app." Preview appears. Vote once in the preview. "This is live and interactive before I even save it." Click save.

**40–65s — share.** Open the widget page. Vote. Refresh. "Still there: the votes live in MongoDB." Switch to a second browser logged in as a member. "My teammate sees the same totals, and can vote too." Vote there, refresh the first browser.

**65–85s — safety.** "Every widget is AI-written code we've never seen, so it runs in a locked sandbox: no access to our page, cookies, or the internet. The only way out is one tiny four-function storage API, and every request is checked by the server." Optionally click the dark-mode toggle: the widget follows.

**85–90s — close.** "Describe it, use it, share it. No deploys, no databases, no setup. WorkspaceZero: a cloud for small software."

## Rehearsal checklist

- [ ] Workspace created; admin and member passwords known.
- [ ] Poll generated and saved at least once before the demo.
- [ ] Second browser (or private window) logged in as member.
- [ ] Dark mode toggle tried once.
- [ ] Vercel URL loads in under 3 seconds.
