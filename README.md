# MTS Online Exam System - Drag & Drop Version

This is the static version of the Moro Testing Service exam website.

## Open Website

Open this file directly:

```text
index.html
```

Or upload the whole folder to Netlify Drop:

```text
https://app.netlify.com/drop
```

No npm, no build command, and no server is required.

## Main Files

```text
index.html
style.css
app.js
questions.js
assets/images/logo.png
netlify.toml
```

## Features

- Student login asks only Student Full Name and Roll Number.
- One question appears at a time.
- Science MCQs only.
- No difficulty labels.
- Timer with auto-submit.
- Tab-switch warning and basic copy/paste/right-click blocking.
- Professional result page.
- Answer review with correct answer and explanation.
- Download full result PDF.
- Download wrong questions.
- Download correct questions.
- Hidden admin page at:

```text
index.html?admin=1
```

Default static admin password:

```text
MTS@2026
```

## Important Note

This drag-and-drop version is fully static. Admin question changes are saved in the browser using localStorage.

For secure Airtable admin access without exposing credentials, use the advanced Netlify Functions version in the `src/` and `netlify/functions/` folders and deploy through Git/Netlify build instead of simple drag-and-drop.
