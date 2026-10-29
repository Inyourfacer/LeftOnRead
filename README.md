# Left On Read

A small iPhone app that reminds you which texts you still owe a reply, and helps you write the reply from a template.

**It cannot send messages.** There is no code in it that can text, email or share anything. When you draft a reply it goes to your clipboard, and you paste it into Messages yourself.

## What it does

- **To reply list:** tap **+**, enter who texted you and (optionally) what it was about, then pick when to be reminded (in 1 hour, tonight, tomorrow morning, this weekend or a custom time). Overdue items are highlighted and sorted to the top.
- **Draft reply:** pick a template. It fills in the person's first name, and you can edit the text before tapping **Copy text**.
- **Done / Snooze / Edit** on each item. Finished items go to a "Replied" section with Undo.
- **Templates tab:** edit the starter templates or add your own. `{name}` becomes the person's first name, and `[brackets]` mark parts you fill in yourself.
- **Calendar alert** (under Edit): adds a Calendar event with an alert at the reminder time, so your iPhone notifies you even when the app is closed.
- Works offline. Everything is stored only on your phone, with no account and no server.

## Install on your iPhone

1. Open **https://inyourfacer.github.io/LeftOnRead/** in **Safari**.
2. Tap the **Share** button, then **Add to Home Screen**.
3. Open it from the new Home Screen icon. It runs full-screen like a normal app.

## Limits

- iOS doesn't let third-party apps read your Messages, so you add people yourself. It can't detect unread texts automatically.
- Without a server, a web app can't show a notification on its own when it's closed. Use **Calendar alert** for a notification you can't miss. Otherwise the list (and the icon badge, on iOS 16.4+) shows what's overdue each time you open it.
- Data lives in this app on this phone. Deleting the Home Screen app deletes its list.

## Development

It's plain HTML/CSS/JS with no build step. To run it locally: `python3 -m http.server` and open http://localhost:8000.
Pushing to `main` deploys to GitHub Pages via `.github/workflows/pages.yml`. When you change cached files, bump `VERSION` in `sw.js`.
