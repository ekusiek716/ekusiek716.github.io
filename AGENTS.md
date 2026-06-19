# AGENTS.md

This file gives repository-specific guidance to Codex and other coding agents.

<!-- BEGIN:codex-pr-review-guidelines -->
## Codex PR Review Guidelines

Codex code review is expected to run on pull requests for this repository after the repository is enabled in ChatGPT Codex Code review settings. If an immediate review is needed, comment `@codex review` on the pull request.

When reviewing, prioritize P0/P1 issues: security/privacy regressions, data loss, broken auth, broken build/test, user-visible behavior changes, and missing validation around env vars, migrations, background jobs, notifications, payments, storage, and external APIs.

For UI changes, verify design-system usage before accepting scratch components or hard-coded styling. Reusable primitives that belong in the design system should be moved there instead of duplicated locally.

Respect this repository's local ownership rules and validation commands. A review should mention the commands that were run, or explicitly state what could not be run. Do not approve or recommend merge while required checks, migrations, secrets, or runtime configuration are unverified.

Do not implement or change payment, billing, or subscription logic without explicit user confirmation.
<!-- END:codex-pr-review-guidelines -->
