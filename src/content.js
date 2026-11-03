(function startTradeMeCategoryFilter() {
  /** @typedef {{ categoryPath: string, topLevelKey: string, segments: string[] }} ListingCategory */
  /** @typedef {{ key: string, label: string, count: number, depth: number, parentKey: string | null }} CategoryNode */
  /** @typedef {"selected" | "covered" | "partial" | "none"} NodeSelectionState */
  /** @typedef {{ card: Element, container: Element, category: ListingCategory }} ListingRecord */
  /** @typedef {{ parseListingCategory: (href: string) => ListingCategory | null, buildCategoryTree: (hrefs: string[]) => CategoryNode[], isExcludedPath: (categoryPath: string, excludedKeys: Set<string>) => boolean, getNodeSelectionState: (nodeKey: string, excludedKeys: Set<string>) => NodeSelectionState, normalizeFilterScope: (href: string) => string }} FilterCore */

  const loadedCore = /** @type {FilterCore | undefined} */ (
    /** @type {any} */ (globalThis).TradeMeFilterCore
  );

  if (!loadedCore) {
    console.error("Trade Me Category Filter: category core did not load");
    return;
  }

  const core = loadedCore;

  const HOST_ID = "trademe-category-filter";
  const STORAGE_PREFIX = "trademe-category-filter:";
  const CARD_SELECTOR = "tm-marketplace-search-card, tm-motors-basic-search-card";
  const AD_SELECTOR = ".ad-card, tm-display-ad-wrapper, tm-fuse-display-ad";
  const SPONSORED_SELECTOR = '[class*="sponsored"], [data-testid*="sponsored"]';
  const originalDisplays = new WeakMap();

  /** @type {{ scope: string, scopeVersion: number, excluded: Set<string>, expanded: Set<string>, categoryNodes: CategoryNode[], listings: ListingRecord[], reveal: boolean, scanTimer: number, collapsed: boolean, host: HTMLElement | null, shadow: ShadowRoot | null }} */
  const state = {
    scope: "",
    scopeVersion: 0,
    excluded: new Set(),
    expanded: new Set(),
    categoryNodes: [],
    listings: [],
    reveal: false,
    scanTimer: 0,
    collapsed: false,
    host: /** @type {HTMLElement | null} */ (null),
    shadow: /** @type {ShadowRoot | null} */ (null),
  };

  function ensurePanel() {
    if (state.host) {
      return;
    }

    const host = document.createElement("div");
    host.id = HOST_ID;
    host.hidden = true;

    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .panel {
          position: fixed;
          right: 16px;
          bottom: 16px;
          z-index: 2147483647;
          width: min(320px, calc(100vw - 32px));
          border: 1px solid #d7d5d2;
          border-radius: 10px;
          background: #fff;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
          color: #2b2926;
          font: 13px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 10px 12px;
          border-bottom: 1px solid #e8e6e3;
        }
        .title { margin: 0; font-size: 14px; font-weight: 700; }
        .icon-button { border: 0; background: transparent; color: #4854d3; cursor: pointer; font: inherit; }
        .body { padding: 10px 12px 12px; }
        .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .hidden-count { color: #65605d; font-variant-numeric: tabular-nums; }
        .actions { display: flex; gap: 6px; }
        button.action {
          border: 1px solid #c9c5c0;
          border-radius: 5px;
          background: #f6f5f4;
          color: #2b2926;
          cursor: pointer;
          font: inherit;
          padding: 4px 8px;
        }
        button.action:hover { background: #ece9e5; }
        .hint { margin: 10px 0 6px; color: #65605d; }
        .category-list { max-height: 380px; overflow: auto; border-top: 1px solid #e8e6e3; }
        .category-row {
          display: grid;
          grid-template-columns: 18px 1fr auto;
          align-items: center;
          gap: 8px;
          box-sizing: border-box;
          padding: 7px 0 7px calc(var(--depth, 0) * 14px);
          border-bottom: 1px solid #f0eeeb;
          cursor: default;
        }
        .category-row:last-child { border-bottom: 0; }
        .category-row:hover { background: #faf9f8; }
        .category-label {
          display: grid;
          grid-template-columns: 18px 1fr;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }
        .category-row.is-selected .category-name { font-weight: 600; }
        .category-row.is-partial .category-name { font-weight: 500; }
        .category-row.is-covered { opacity: 0.55; }
        .category-row.is-covered .category-label { cursor: default; }
        .category-row input { width: 16px; height: 16px; margin: 0; }
        .branch-toggle, .branch-spacer { width: 18px; height: 18px; padding: 0; }
        .branch-toggle {
          border: 0;
          background: transparent;
          color: #65605d;
          cursor: pointer;
          font: inherit;
          line-height: 1;
        }
        .branch-toggle:hover { color: #2b2926; }
        .category-name { overflow-wrap: anywhere; }
        .category-count { color: #76716d; font-variant-numeric: tabular-nums; }
      </style>
      <aside class="panel" aria-label="Trade Me category filter">
        <div class="header">
          <h2 class="title">Trade Me filter</h2>
          <button class="icon-button" type="button" data-action="collapse" aria-expanded="true">Minimise</button>
        </div>
        <div class="body" data-role="body">
          <div class="toolbar">
            <span class="hidden-count" data-role="hidden-count" aria-live="polite">0 hidden</span>
            <div class="actions">
              <button class="action" type="button" data-action="reveal">Show hidden</button>
              <button class="action" type="button" data-action="clear">Clear</button>
            </div>
          </div>
          <p class="hint">Select any level. Arrows expand; counts include children.</p>
          <div class="category-list" data-role="category-list"></div>
        </div>
      </aside>
    `;

    shadow.addEventListener("change", handlePanelChange);
    shadow.addEventListener("click", handlePanelClick);

    document.body.append(host);
    state.host = host;
    state.shadow = shadow;
  }

  /** @returns {string} */
  function currentScope() {
    return core.normalizeFilterScope(window.location.href);
  }

  /** @param {string} scope */
  function storageKey(scope) {
    return `${STORAGE_PREFIX}${scope}`;
  }

  /**
   * @param {string} scope
   * @returns {Promise<Set<string>>}
   */
  async function loadExclusions(scope) {
    if (globalThis.chrome?.storage?.local) {
      const key = storageKey(scope);
      try {
        const stored = await chrome.storage.local.get(key);
        return toExclusionSet(stored[key]);
      } catch (error) {
        console.error("Trade Me Category Filter: could not read saved exclusions", error);
        return new Set();
      }
    }

    try {
      const raw = window.localStorage.getItem(storageKey(scope));
      return toExclusionSet(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  }

  async function saveExclusions() {
    const key = storageKey(state.scope);
    const value = [...state.excluded];

    if (globalThis.chrome?.storage?.local) {
      await chrome.storage.local.set({ [key]: value });
      return;
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage can be unavailable in private windows. The current page still works.
    }
  }

  /** @param {unknown} value */
  function toExclusionSet(value) {
    if (!Array.isArray(value)) {
      return new Set();
    }

    return new Set(value.filter((item) => typeof item === "string"));
  }

  function collectListings() {
    /** @type {ListingRecord[]} */
    const listings = [];
    /** @type {string[]} */
    const hrefs = [];

    for (const card of document.querySelectorAll(CARD_SELECTOR)) {
      if (card.closest(AD_SELECTOR) || card.matches(SPONSORED_SELECTOR)) {
        continue;
      }

      if (card.querySelector(SPONSORED_SELECTOR)) {
        continue;
      }

      const link = card.querySelector('a[href*="/listing/"]');
      const href = link?.getAttribute("href");
      if (!href) {
        continue;
      }

      const category = core.parseListingCategory(href);
      if (!category) {
        continue;
      }

      listings.push({
        card,
        container: card.closest("tg-col") ?? card,
        category,
      });
      hrefs.push(href);
    }

    state.listings = listings;
    state.categoryNodes = core.buildCategoryTree(hrefs);
  }

  function renderPanel() {
    if (state.categoryNodes.length === 0) {
      if (state.host) {
        state.host.hidden = true;
      }
      return;
    }

    ensurePanel();
    if (!state.host || !state.shadow) {
      return;
    }

    state.host.hidden = false;

    const list = /** @type {HTMLElement | null} */ (
      state.shadow.querySelector('[data-role="category-list"]')
    );
    if (!list) {
      return;
    }

    const fragment = document.createDocumentFragment();
    const parentKeys = new Set();
    for (const node of state.categoryNodes) {
      if (node.parentKey) {
        parentKeys.add(node.parentKey);
      }
    }

    const visibleKeys = new Set();
    for (const node of state.categoryNodes) {
      if (node.parentKey !== null) {
        if (!visibleKeys.has(node.parentKey) || !state.expanded.has(node.parentKey)) {
          continue;
        }
      }
      visibleKeys.add(node.key);

      const selection = core.getNodeSelectionState(node.key, state.excluded);
      const hasChildren = parentKeys.has(node.key);
      const expanded = state.expanded.has(node.key);
      const row = document.createElement("div");
      row.className = "category-row";
      row.style.setProperty("--depth", String(node.depth));
      row.classList.toggle("is-selected", selection === "selected");
      row.classList.toggle("is-partial", selection === "partial");
      row.classList.toggle("is-covered", selection === "covered");
      if (selection === "covered") {
        row.title = "Hidden by a parent category";
      } else if (selection === "partial") {
        row.title = "Some subcategories are hidden";
      }

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.categoryKey = node.key;
      checkbox.checked = selection === "selected";
      checkbox.indeterminate = selection === "partial";
      checkbox.disabled = selection === "covered";
      checkbox.setAttribute("aria-label", `Hide ${node.label}`);

      const name = document.createElement("span");
      name.className = "category-name";
      name.textContent = node.label;

      const label = document.createElement("label");
      label.className = "category-label";
      label.append(checkbox, name);

      const branchControl = hasChildren
        ? document.createElement("button")
        : document.createElement("span");
      branchControl.className = hasChildren ? "branch-toggle" : "branch-spacer";
      if (branchControl instanceof HTMLButtonElement) {
        branchControl.type = "button";
        branchControl.dataset.action = "toggle-branch";
        branchControl.dataset.categoryKey = node.key;
        branchControl.textContent = expanded ? "▾" : "▸";
        branchControl.setAttribute("aria-expanded", String(expanded));
        branchControl.setAttribute(
          "aria-label",
          `${expanded ? "Collapse" : "Expand"} ${node.label}`,
        );
      }

      const count = document.createElement("span");
      count.className = "category-count";
      count.textContent = String(node.count);

      row.append(branchControl, label, count);
      fragment.append(row);
    }

    list.replaceChildren(fragment);
  }

  function applyExclusions() {
    let hiddenCount = 0;

    for (const listing of state.listings) {
      const excluded = core.isExcludedPath(listing.category.categoryPath, state.excluded);
      if (excluded) {
        hiddenCount += 1;
      }

      setElementVisible(listing.container, !excluded || state.reveal);
    }

    updatePanelState(hiddenCount);
  }

  /** @param {number} hiddenCount */
  function updatePanelState(hiddenCount) {
    if (!state.shadow) {
      return;
    }

    const count = state.shadow.querySelector('[data-role="hidden-count"]');
    if (count) {
      count.textContent = `${hiddenCount} hidden`;
    }

    const revealButton = /** @type {HTMLButtonElement | null} */ (
      state.shadow.querySelector('[data-action="reveal"]')
    );
    if (revealButton) {
      revealButton.textContent = state.reveal ? "Hide again" : "Show hidden";
      revealButton.disabled = hiddenCount === 0;
    }
  }

  /**
   * @param {Element} element
   * @param {boolean} visible
   */
  function setElementVisible(element, visible) {
    const htmlElement = /** @type {HTMLElement} */ (element);

    if (!visible) {
      if (!originalDisplays.has(htmlElement)) {
        originalDisplays.set(htmlElement, htmlElement.style.display);
      }
      htmlElement.style.setProperty("display", "none", "important");
      return;
    }

    if (originalDisplays.has(htmlElement)) {
      const original = originalDisplays.get(htmlElement) ?? "";
      if (original.length > 0) {
        htmlElement.style.display = original;
      } else {
        htmlElement.style.removeProperty("display");
      }
      originalDisplays.delete(htmlElement);
    }
  }

  /** @param {Event} event */
  function handlePanelChange(event) {
    const input = /** @type {HTMLInputElement} */ (event.target);
    if (!input.matches("input[data-category-key]")) {
      return;
    }

    const key = input.dataset.categoryKey;
    if (!key) {
      return;
    }

    if (input.checked) {
      for (const excludedKey of [...state.excluded]) {
        if (excludedKey.startsWith(`${key}/`)) {
          state.excluded.delete(excludedKey);
        }
      }
      state.excluded.add(key);
    } else {
      state.excluded.delete(key);
    }

    state.reveal = false;
    void saveExclusions();
    renderPanel();
    applyExclusions();
  }

  /** @param {Event} event */
  function handlePanelClick(event) {
    const target = /** @type {HTMLElement} */ (event.target);
    const actionElement = target.closest("[data-action]");
    const action = actionElement?.getAttribute("data-action");

    if (action === "reveal") {
      state.reveal = !state.reveal;
      applyExclusions();
      return;
    }

    if (action === "clear") {
      state.excluded.clear();
      state.reveal = false;
      void saveExclusions();
      renderPanel();
      applyExclusions();
      return;
    }

    if (action === "toggle-branch" && actionElement) {
      event.preventDefault();
      event.stopPropagation();
      const key = actionElement.getAttribute("data-category-key");
      if (!key) {
        return;
      }

      if (state.expanded.has(key)) {
        state.expanded.delete(key);
      } else {
        state.expanded.add(key);
      }
      renderPanel();
      applyExclusions();
      return;
    }

    if (action === "collapse" && state.shadow) {
      state.collapsed = !state.collapsed;
      const body = state.shadow.querySelector('[data-role="body"]');
      if (body instanceof HTMLElement) {
        body.hidden = state.collapsed;
      }
      target.textContent = state.collapsed ? "Expand" : "Minimise";
      target.setAttribute("aria-expanded", String(!state.collapsed));
    }
  }

  async function refresh() {
    const scope = currentScope();
    if (scope !== state.scope) {
      const version = ++state.scopeVersion;
      state.scope = scope;
      state.reveal = false;
      state.expanded.clear();
      const exclusions = await loadExclusions(scope);
      if (version !== state.scopeVersion) {
        return;
      }
      state.excluded = exclusions;
      expandAncestorsOfSelections();
    }

    collectListings();
    renderPanel();
    applyExclusions();
  }

  function scheduleRefresh() {
    if (state.scanTimer !== 0) {
      return;
    }

    state.scanTimer = window.setTimeout(() => {
      state.scanTimer = 0;
      void refresh().catch(reportError);
    }, 75);
  }

  /** @param {unknown} error */
  function reportError(error) {
    console.error("Trade Me Category Filter: refresh failed", error);
  }

  function expandAncestorsOfSelections() {
    for (const key of state.excluded) {
      for (const ancestor of getAncestorKeys(key)) {
        state.expanded.add(ancestor);
      }
    }
  }

  /** @param {string} key */
  function getAncestorKeys(key) {
    const parts = key.split("/");
    const start = parts[0] === "motors" ? 1 : 2;
    const ancestors = [];

    for (let index = start; index < parts.length; index += 1) {
      ancestors.push(parts.slice(0, index).join("/"));
    }

    return ancestors;
  }

  function watchPage() {
    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("popstate", scheduleRefresh);
    window.addEventListener("hashchange", scheduleRefresh);

    if (globalThis.chrome?.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "local") {
          return;
        }

        const key = storageKey(state.scope);
        if (changes[key]) {
          state.excluded = toExclusionSet(changes[key].newValue);
          renderPanel();
          applyExclusions();
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      void refresh().catch(reportError);
      watchPage();
    });
    return;
  }

  void refresh().catch(reportError);
  watchPage();
})();
