# Trade Me Category Filter

Chrome extension that hides selected Trade Me listing categories on search pages.

Not affiliated with Trade Me. Provided as-is, with no warranty.

## Load it

This extension is not on the Chrome Web Store. Install it from source:

1. Download the latest release ZIP from https://github.com/olitreadwell/trademe-category-filter/releases/latest, or clone the repository.
2. Unzip the download if needed.
3. Open `chrome://extensions`.
4. Turn on Developer mode.
5. Choose Load unpacked.
6. Select the folder that contains `manifest.json`.
7. Open https://www.trademe.co.nz/a/marketplace/search?dollar_reserve_only=true

The filter panel appears in the bottom right when listing cards are present.

## Use it

- Tick any level of the category tree to hide that subtree on the current search.
- For example, hide Sports > Trading cards without hiding Sports > Cycling.
- Branches start collapsed. Use the arrow to expand a category and pick a subcategory.
- Branches with active exclusions open automatically after reload.
- Branches you collapse stay collapsed when you select another category.
- Counts include every loaded listing below that node.
- Choose Show hidden to inspect what was removed without clearing the rules.
- Choose Clear to remove every exclusion for the current search.
- Reload the page or change page and sort order. The rules stay with that search.

## What works

- A selectable category tree built from the loaded listing paths.
- Collapsible branches for top-level categories and their children.
- Marketplace and Motors listing cards on the same page.
- Display ads and sponsored listing cards stay visible.
- New listing cards are caught after the page loads more results.
- Exclusions are stored per normalised search path and query.
- No network requests leave the browser.

## What does not

- Keyword exclusion.
- Searching two positive categories at once.
- A library of named filters across many searches.
- Watchlist or homepage filtering.

## Development

```sh
npm install
npm run check
```

Useful commands:

```sh
npm run test:unit
npm run test:e2e
npm run lint
npm run typecheck
```

There is no build step. Load the folder that contains `manifest.json` as an unpacked extension. Reload the extension after code changes.

## Architecture

`src/filter-core.js` parses listing URLs, builds the category tree, matches exclusions against subtrees, and normalises the search scope. It is a classic script with a CommonJS export so Node tests can load it.

`src/content.js` renders the panel in a shadow root, scans rendered listing cards, hides matching grid cells, and stores exclusions in `chrome.storage.local`.

`tests/unit/filter-core.test.js` tests category parsing, tree counts, subtree matching, and scope rules. `tests/e2e/extension.spec.js` loads the real extension against a Trade Me-shaped fixture in Chromium.

Domain language lives in `GLOSSARY.md`. The reason for filtering the rendered page instead of the Trade Me API is in `docs/adr/0001-filter-rendered-listings.md`.

## Limitations

Trade Me can change its custom element names or card markup. The extension skips cards it cannot parse. A markup change should reduce coverage while unparsed rows stay visible. The panel also needs at least one parseable listing card before it appears.

The tree comes from category paths in loaded cards, so a category only appears after at least one of its listings loads. Marketplace branches can go deep. Motors stops at vehicle type, such as Cars or Trucks, rather than make and model.

## Quality notes

Dependencies are pinned in `package.json`, with `package-lock.json` for reproducible installs. The CI workflow uses the same `npm run check` gate.

Port binding, health endpoints, OpenAPI, containerisation, and service logs do not apply to a browser extension. The prototype has no secrets, no remote code, and only the `storage` permission.
