# Agent Instructions

This file defines project-level guidance for coding agents working in this repository.

## Scope

- Treat this file as the cross-tool baseline for agent behavior.
- When guidance appears in multiple places, prefer following the more specific instruction for the current tool and task.

## Language

- Write code, identifiers, and code comments in English.
- Write the README and agent skills in English, except the `sdd` skill's templates, which follow the language of the documents they produce.
- Specs, plans, the roadmap, PR descriptions, and the manual checks in `tests/manual/` follow the language rules in the `sdd` skill.

## Spec-Driven Development

This repo uses spec-driven development: every change to spec'd behavior or architecture starts from a plan, and code follows. Implementing a change means entering this workflow: when the change alters spec'd behavior or architecture, the first deliverable is a plan PR, not code. Before making any change to this repo (code, docs, or config), load the `sdd` skill and follow it.

When reading docs for any purpose:

- `docs/specs/` describes what the code on the `main` branch implements now. The exception is the positioning, target users, scope, and non-goals in `docs/specs/product.md`, which describe the intended product, including features not built yet.
- `docs/plans/` and `docs/plans/roadmap.md` describe approved and future changes, not current behavior.
- `docs/plans/archive/` is history. Never treat it as current guidance.

Never push to `main` and never merge a PR. The user merges.
