# Agent Instructions

## Read first

- `GLOSSARY.md` for the project language.
- `docs/adr/` for settled architecture choices.

## Commands

- `npm run check` runs format, lint, typecheck, unit tests, and browser tests.
- `npm run test:unit` exercises `src/filter-core.js`.
- `npm run test:e2e` loads the unpacked extension against `tests/fixtures/search.html`.

## Structure

- `src/filter-core.js` holds pure category tree, subtree matching, and scope logic.
- `src/content.js` holds DOM scanning, the panel, hiding, and storage.
- `manifest.json` is the Chrome Manifest V3 entry point.

## Rules

- Start behaviour changes with a failing test at one of the two existing seams.
- Keep `src/filter-core.js` loadable by classic content scripts and Node tests.
- Keep the content script dependency-free and build-free.
- Keep selectors in the named constants near the top of `src/content.js`.
- Never hide display ads or sponsored cards.
- Update `GLOSSARY.md` when domain language changes.
