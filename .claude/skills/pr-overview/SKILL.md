---
name: pr-overview
description: Summarize the current branch's changes as a file walkthrough table and a Mermaid diagram of imports between changed files, and post it as a pull request comment on GitHub or Gitea. Use when the user asks for a PR overview, change summary, file walkthrough, or diagram of what a branch changes.
argument-hint: "[base-ref]"
---

Produce a reviewer-oriented overview of the changes on the current branch.

## 1. Collect the changes

- Base: the base branch of the branch's open pull request (see *Find the pull request* in
  section 5). Only if there is no open pull
  request, or no MCP server for the platform is available, fall back to the remote default
  branch (`git symbolic-ref --short refs/remotes/origin/HEAD`), then `main`, then `master`, and
  say which base was used. A base ref given as argument overrides both.
- Compare against the remote-tracking base (`origin/<base>`), fetching it first if it is missing.
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

Build Markdown with the headings `### File walkthrough` and `### Diagram walkthrough`, the table,
and the diagram in a ```` ```mermaid ```` block. If the branch has an open pull request, post it
there (section 5) instead of printing it. Only without an open pull request, or without an MCP
server for the platform, print it in the chat and say why it was not posted.

## 5. Post to the pull request

Post the overview as a single pull request comment on GitHub or Gitea, updating an earlier one
instead of adding another. Use the platform's MCP tools only; never fall back to a CLI or raw
REST calls. Ask the user whenever a step below is ambiguous; never guess a target.

### Find the platform and repository

- Remote: the branch's upstream remote (`git rev-parse --abbrev-ref @{u}`), else `origin`.
  If several remotes point to different repositories and the pull request could live in either
  (for example a fork and its upstream), ask which one to use.
- Parse host, owner, and repository from the remote URL (SSH or HTTPS, with or without port).
- Platform: `github.com` uses the GitHub MCP server (`mcp__github__*`); any other host uses the
  MCP server configured for that host (for example a Gitea/Forgejo MCP server). If the tools are
  deferred, load them first. If no MCP server for the host is available, say so and stop.

### Find the pull request

- GitHub: `list_pull_requests` with `state: "open"` and `head: "<owner>:<branch>"`.
  Gitea: the server's equivalent pull request listing, filtered to `head.ref` = current branch.
- No open pull request: print the overview instead (section 4). More than one: ask.
- Read the pull request (GitHub `pull_request_read` with `method: "get"`) for its number, URL,
  base branch, and head SHA.
- If the pull request's head SHA differs from local `HEAD` (unpushed or outdated commits),
  tell the user and ask whether to post anyway.

### Create or update the comment

- Comment body: first line exactly `<!-- PR Overview -->`, then a blank line, then the overview,
  with each section wrapped in `<details><summary>File walkthrough</summary> … </details>` and
  `<details><summary>Diagram walkthrough</summary> … </details>`. Keep the blank lines around
  the table and the Mermaid block inside `<details>` so both still render.
- Determine the authenticated user: GitHub `get_me` (`login`), Gitea the server's equivalent.
- List the pull request's conversation comments (GitHub `issue_read` with
  `method: "get_comments"` and the pull request number, paginating until all are read). The
  existing overview is the comment whose body starts with `<!-- PR Overview -->` and whose author
  is the authenticated user. Ignore marked comments by anyone else.
- If it exists, replace its body (GitHub `update_issue_comment`). If several exist, update the
  newest.
- Otherwise create one (GitHub `add_issue_comment` with the pull request number as
  `issue_number`).
- Report whether the comment was created or updated, with its URL.
