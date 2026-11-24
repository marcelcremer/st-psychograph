---
name: pr-overview
description: Summarize the current branch's changes as a file walkthrough table and a Mermaid diagram of imports between changed files. Use when the user asks for a PR overview, change summary, file walkthrough, or diagram of what a branch changes, optionally posted as a pull request comment on GitHub or Gitea.
argument-hint: "[base-ref] [--comment]"
---

Produce a reviewer-oriented overview of the changes on the current branch.

## 1. Collect the changes

- Base: use the base ref from the arguments if given. Otherwise use the remote default
  branch (`git symbolic-ref --short refs/remotes/origin/HEAD`), falling back to `main`, then `master`.
- Compare committed branch changes only: `git diff -M --numstat <base>...HEAD` for line counts
  and `git diff -M --name-status <base>...HEAD` for status and rename sources.
- If the working tree has uncommitted changes, say that they are not included.
- Binary files report `-` in `--numstat`; show them as `binary`.

## 2. File walkthrough

Read the diff of every changed file (and the full current file when the diff alone does not
explain the change). Then build one table row per file:

| Column | Content |
| --- | --- |
| File | Path at HEAD; for renames `old → new` |
| Changes | `+additions/-deletions` from `--numstat` |
| Role | What the file is, from the role list below |
| Type | What the change does: `feature`, `bugfix`, or `refactoring`; `—` for role `generated` |
| Summary | One sentence on what changed and why, based on the diff, not the filename |

- Sort rows by additions plus deletions, largest first.
- Escape `|` in cells as `\|`.

### Roles

Assign exactly one role per file, using only these names. Decide by the file's responsibility as
seen in its content, not by its name, directory, or language conventions. If a file has several
responsibilities, pick the one the change touches most. If none fits, use `other`.

| Role | Responsibility |
| --- | --- |
| `test` | Exercises other code to verify its behavior: unit, integration, and end-to-end tests, test fixtures, test helpers, mocks |
| `controller` | Receives external input and hands it to the application: HTTP routes and handlers, RPC or GraphQL resolvers, CLI commands, message or event consumers, webhooks, scheduled jobs |
| `service` | Business logic and domain operations, independent of how they are triggered or where data is stored |
| `model` | Data shapes without behavior beyond validation: entities, types, schemas, DTOs, enums |
| `data-access` | Reads or writes persistent or remote data: database queries, repositories, ORM mappings, migrations, clients for external APIs |
| `ui` | What users see or interact with: views, components, templates, styles, translations, static assets |
| `config` | Controls how the software is built, run, or deployed: build files, CI pipelines, application settings, infrastructure definitions, container files |
| `util` | Generic helpers with no domain knowledge, reusable in another project unchanged |
| `docs` | Prose for humans: READMEs, guides, changelogs, comments-only files |
| `generated` | Not written by hand: lockfiles, generated code, vendored dependencies, binary files |
| `other` | None of the above |

### Types

Classify by the change itself, not by the file's role:

- `feature`: adds or extends behavior.
- `bugfix`: corrects behavior that was wrong.
- `refactoring`: keeps behavior unchanged and changes structure, names, or organization.

A test written for new behavior is `feature`; a test reproducing a fixed bug is `bugfix`.

## 3. Diagram walkthrough

Draw a Mermaid `flowchart LR` of dependencies between changed files.

- Nodes: every changed file, with ids `f0`, `f1`, … and the path as a quoted label:
  `f0["src/api/user.ts"]`. Replace `"` inside labels with `#quot;`.
- Edges: for each changed file that still exists at HEAD, read its actual import statements in
  whatever language it uses (for example ES `import`/`export … from`/`require()`/`import()`,
  Python `import`/`from`, Go `import`, Rust `use`/`mod`, CSS `@import`, Nix `import ./path`).
  Resolve each target to a repository path. Add an edge only if the target is also a changed file.
- Only draw edges backed by a statement you have read. Never infer edges from naming or from
  what the code probably uses.
- Edge label: the imported symbols, comma-separated, or `imports` if none are named.
  If the importing file has role `test`, use `validates` instead.
  Syntax: `f1 -->|"getUser, User"| f0`.
- Deleted files appear as nodes without outgoing edges.
- With more than 30 changed files, keep only files that have at least one edge and state how
  many unconnected files were omitted.
- Add the note: "Only direct imports between changed files are shown."

## 4. Output

Print Markdown with the headings `### File walkthrough` and `### Diagram walkthrough`, the table,
and the diagram in a ```` ```mermaid ```` block, so the result can be pasted into a pull request.
Without `--comment`, stop here.

## 5. Post to the pull request (only with `--comment`)

Post the overview as a single pull request comment on GitHub or Gitea, updating an earlier one
instead of adding another. Ask the user whenever a step below is ambiguous; never guess a target.

### Find the platform and repository

- Remote: the branch's upstream remote (`git rev-parse --abbrev-ref @{u}`), else `origin`.
  If several remotes point to different repositories and the pull request could live in either
  (for example a fork and its upstream), ask which one to use.
- Parse host, owner, and repository from the remote URL (SSH or HTTPS, with or without port).
- Platform:
  - `github.com`, or a host for which `gh auth status --hostname <host>` succeeds: GitHub, via `gh`.
  - A host where `https://<host>/api/v1/version` returns JSON with a `version` field: Gitea
    (Forgejo works the same way), via its REST API at `https://<host>/api/v1`.
  - Anything else: ask.
- Gitea authentication: send `Authorization: token $GITEA_TOKEN`. If the variable is not set,
  ask the user how to authenticate. Never print or echo a token.

### Find the pull request

- GitHub: `gh pr view --json number,url,baseRefName,headRefOid`.
- Gitea: `GET /repos/{owner}/{repo}/pulls?state=open` and select pull requests whose `head.ref`
  is the current branch.
- No open pull request, or more than one: ask.
- If the pull request's base branch differs from the base used above, redo the overview against
  the pull request's base.
- If the pull request's head commit differs from local `HEAD` (unpushed or outdated commits),
  tell the user and ask whether to post anyway.

### Create or update the comment

- Comment body: first line exactly `<!-- PR Overview -->`, then a blank line, then the overview,
  with each section wrapped in `<details><summary>File walkthrough</summary> … </details>` and
  `<details><summary>Diagram walkthrough</summary> … </details>`. Keep the blank lines around
  the table and the Mermaid block inside `<details>` so both still render.
- Determine the authenticated user: GitHub `gh api user --jq .login`, Gitea `GET /user` (`login`).
- List the pull request's issue comments (GitHub
  `gh api --paginate repos/{owner}/{repo}/issues/{number}/comments`, Gitea
  `GET /repos/{owner}/{repo}/issues/{number}/comments`). The existing overview is the comment
  whose body starts with `<!-- PR Overview -->` and whose author is the authenticated user.
  Ignore marked comments by anyone else.
- If it exists, replace its body: GitHub `gh api -X PATCH repos/{owner}/{repo}/issues/comments/{id}`,
  Gitea `PATCH /repos/{owner}/{repo}/issues/comments/{id}`. If several exist, update the newest.
- Otherwise create one: GitHub `gh api -X POST repos/{owner}/{repo}/issues/{number}/comments`,
  Gitea `POST /repos/{owner}/{repo}/issues/{number}/comments`.
- Send the body as JSON built from a file (for example `jq -Rs '{body: .}' overview.md`), never
  by interpolating Markdown into a shell string.
- Report whether the comment was created or updated, with its URL.
