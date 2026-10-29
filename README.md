# Left On Read

A small iPhone app that reminds you which texts you still owe a reply, and helps you write the reply from a template.

**It cannot send messages.** There is no code in it that can text, email or share anything. When you draft a reply it goes to your clipboard, and you paste it into Messages yourself.

## What it does

- **To reply list:** tap **+**, enter who texted you and (optionally) what it was about, then pick when to be reminded (in 1 hour, tonight, tomorrow morning, this weekend or a custom time). Overdue items are highlighted and sorted to the top.
- **Draft reply:** pick a template. It fills in the person's first name, and you can edit the text before tapping **Copy text**.
- **Done / Snooze / Edit** on each item. Finished items go to a "Replied" section with Undo.
- **Check tab:** paste a text you've opened, or import a batch your iPhone Shortcut saved. Left On Read sorts each one into *Worth replying*, *Maybe*, *No reply needed* ("ok", "haha", tapbacks) or *Automated or spam* (verification codes, short-code senders, delivery and bank alerts, toll and prize scams, marketing). It shows the reasons and suggests 2–3 replies that fit what the text is about (plans, a request, news, bad news, a check-in and so on). Tap a suggestion to copy it, or **Remind me** to add it to your To reply list. All of this runs on your phone; no message text is sent anywhere.
- **Templates tab:** edit the starter templates or add your own. `{name}` becomes the person's first name, and `[brackets]` mark parts you fill in yourself.
- **Calendar alert** (under Edit): adds a Calendar event with an alert at the reminder time, so your iPhone notifies you even when the app is closed.
- Works offline. Everything is stored only on your phone, with no account and no server.

## Install on your iPhone

1. Open **https://inyourfacer.github.io/LeftOnRead/** in **Safari**.
2. Tap the **Share** button, then **Add to Home Screen**.
3. Open it from the new Home Screen icon. It runs full-screen like a normal app.

## Optional: catch new texts automatically with a Shortcut

iOS won't let any app read your Messages history, but the built-in **Shortcuts** app can save each *new* text as it arrives. Left On Read can then import and check them all at once.

1. Open **Shortcuts** → **Automation** → **+** → **Message**.
2. Under **Sender**, pick the people you care about (or leave it open if iOS lets you). Choose **Run Immediately**, then **Next**.
3. Add a **Text** action containing exactly:
   ```
   From: [Shortcut Input › Sender]
   [Shortcut Input › Content]
   ---
   ```
   (Tap in the Text box, choose the *Shortcut Input* variable, and pick *Sender* or *Content*.)
4. Add **Append to Text File**: append the Text above to `Shortcuts/LeftOnRead.txt` in iCloud Drive, with **Make New Line** on.
5. Whenever you like, open Left On Read → **Check** → **Import texts saved by your Shortcut** and pick `LeftOnRead.txt`. Texts you've already checked are skipped, so you can keep re-importing the same file.

This only captures texts that arrive after you set it up, and it hasn't been tried on a real iPhone yet, so the exact menu names may differ slightly on your iOS version.

**Tip:** for a screenshot of a conversation, open it in Photos, long-press the text (Live Text) to copy it, then paste it into **Check**.

## Limits

- iOS doesn't let any third-party app read your Messages, so it can't scan conversations you've already opened. You paste texts in, or use the Shortcut above for new ones.
- The spam and needs-a-reply check uses simple on-device rules, not AI. It's right for common cases but will sometimes be wrong. Use **Actually needs a reply** or **Dismiss** to correct it.
- Without a server, a web app can't show a notification on its own when it's closed. Use **Calendar alert** for a notification you can't miss. Otherwise the list (and the icon badge, on iOS 16.4+) shows what's overdue each time you open it.
- Data lives in this app on this phone. Deleting the Home Screen app deletes its list.

## Development

It's plain HTML/CSS/JS with no build step. `triage.js` holds the message rules; run `node tests/triage.test.js` after changing them. To run it locally: `python3 -m http.server` and open http://localhost:8000.
Pushing to `main` deploys to GitHub Pages via `.github/workflows/pages.yml`. When you change cached files, bump `VERSION` in `sw.js`.
