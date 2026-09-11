# Set up your custom issue tracker

You are a coding agent. Finish wiring up the **custom issue tracker** for this Sandcastle project. It was scaffolded in a deliberately broken-until-configured state: until you complete the steps below, every Sandcastle run hard-fails with a pointer back to this file.

## Goal

Wire up the issue tracker so the scaffolded prompts can **list**, **view**, and **close** tasks. There is no runtime abstraction to implement — the tracker commands are baked into the scaffolded files, so you edit those files **in place**.

## 1. Interview the user

Ask the user:

- Which issue tracker do they use (e.g. Jira, Linear, a GitHub repo other than this one, an internal API)?
- How should the sandbox authenticate — a CLI that is already logged in, or an API token? If a token, what is the environment variable name?

## 2. Produce three commands

Work out, together with the user, the shell commands for:

- **list** — print all open tasks **as JSON** (match the shape the built-in trackers emit: an array of objects, each with at least an id/number, title, and body). This is what the agent reads at the start of every iteration.
- **view** `<ID>` — show a single task by id.
- **close** `<ID>` — close a single task by id.

## 3. Edit the scaffolded files in place

- **Dockerfile / Containerfile** — replace the line

  ```
  # TODO: install your issue tracker's CLI here. See .sandcastle/SETUP_ISSUE_TRACKER.md
  ```

  with the install steps for your tracker's CLI (if it needs one).

- **Prompt files (`.sandcastle/*.md`)** — replace the sentinel

  ```
  echo 'No issue tracker configured — run .sandcastle/SETUP_ISSUE_TRACKER.md through your coding agent.' >&2; exit 1
  ```

  with your **list** command. In the prompt file the sentinel sits inside a Sandcastle **shell expression** — a leading `!` followed by the command in backticks — whose output is injected into the prompt before each run. Keep that `!` and the surrounding backticks; replace only the command between them, and **remove the `exit 1`** (leaving it keeps every run hard-failing). Then replace the `<view command — see .sandcastle/SETUP_ISSUE_TRACKER.md>` and `<close command — see .sandcastle/SETUP_ISSUE_TRACKER.md>` markers with your **view** and **close** commands.

- **`.env.example`** — replace the `# TODO` block with the real env var(s) your tracker needs, then tell the user to set them in `.sandcastle/.env`.

## 4. Build the image

Once the files are wired up, build the sandbox image:

```
sandcastle docker build-image
```

## 5. Verify

Run your **list** command inside the built image and confirm it returns the open tasks as JSON. If it errors, fix the command or the auth and rebuild.
