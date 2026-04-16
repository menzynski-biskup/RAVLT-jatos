# RAVLT-jatos

Standalone RAVLT assessment interface for use in JATOS/Mindprobe sessions.

## What it supports

- Participant setup fields: participant ID, group, session, and time of day.
- Manual list version selection (`v1`/`v2`) so repeat visits can use different forms.
- Standard RAVLT flow:
  - List A trials A1-A5
  - Interference trial B1
  - Post-interference immediate recall A6 (without re-reading List A)
  - Delay period timer
  - Delayed recall A7
- Trial-specific examiner instructions aligned to the AVLT flow (including no re-reading prompts for A6/A7).
- Live scoring-sheet style table during administration with per-trial scores and recalled words.
- Word-by-word scoring using clickable buttons during each recall trial.
- Trial-by-trial score capture with recalled words saved per trial.
- Results summary with JSON and CSV export.
- Optional JATOS integration: if `window.jatos.submitResultData` is available, result data is submitted automatically at completion.

## Run locally

Open `index.html` in a browser from the project directory.

## Data output

At the end of the task, the app stores:

- Participant metadata
- Start and finish timestamps
- All trial records (trial code, label, score, words selected)
- Delay duration in seconds

Use the **Download JSON** and **Download CSV** buttons from the summary screen.
