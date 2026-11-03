(function attachFilterCore(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  /** @type {any} */ (root).TradeMeFilterCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createFilterCore() {
  /** @typedef {{ categoryPath: string, topLevelKey: string, segments: string[] }} ListingCategory */
  /** @typedef {{ key: string, label: string, count: number, depth: number, parentKey: string | null }} CategoryNode */
  /** @typedef {"selected" | "covered" | "partial" | "none"} NodeSelectionState */

  /** @type {Record<string, string>} */
  const MARKETPLACE_LABELS = {
    "antiques-collectables": "Antiques & collectables",
    art: "Art",
    "baby-gear": "Baby gear",
    books: "Books",
    "building-renovation": "Building & renovation",
    "business-farming-industry": "Business, farming & industry",
    "clothing-fashion": "Clothing & fashion",
    computers: "Computers",
    crafts: "Crafts",
    deals: "Deals",
    "electronics-photography": "Electronics & photography",
    gaming: "Gaming",
    "health-beauty": "Health & beauty",
    "home-living": "Home & living",
    "jewellery-watches": "Jewellery & watches",
    "mobile-phones": "Mobile phones",
    "movies-tv": "Movies & TV",
    "music-instruments": "Music & instruments",
    "pets-animals": "Pets & animals",
    "pottery-glass": "Pottery & glass",
    sports: "Sports",
    "toys-models": "Toys & models",
    "travel-events-activities": "Travel, events & activities",
  };

  /** @type {Record<string, string>} */
  const SUBCATEGORY_LABELS = {
    "4wd": "4WD",
    "cigarette-cards": "Cigarette cards",
    "dvds-blu-ray": "DVDs & Blu-ray",
    "figurines-miniatures": "Figurines & miniatures",
    "mens-clothing": "Men's clothing",
    "mens-jewellery": "Men's jewellery",
    suv: "SUV",
    "tobacco-related": "Tobacco related",
    "trading-cards": "Trading cards",
    "womens-clothing": "Women's clothing",
    "womens-jewellery": "Women's jewellery",
  };

  const IGNORED_SCOPE_PARAMS = new Set([
    "page",
    "sort_order",
    "sort",
    "view",
    "card_view_mode",
    "display_mode",
  ]);

  /**
   * Turns a Trade Me listing URL into its full category path.
   * @param {string} href
   * @returns {ListingCategory | null}
   */
  function parseListingCategory(href) {
    if (typeof href !== "string" || href.length === 0) {
      return null;
    }

    let url;
    try {
      url = new URL(href, "https://www.trademe.co.nz");
    } catch {
      return null;
    }

    if (url.hostname !== "www.trademe.co.nz") {
      return null;
    }

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] !== "a" || (parts[1] !== "marketplace" && parts[1] !== "motors")) {
      return null;
    }

    const listingIndex = parts.indexOf("listing");
    if (listingIndex === -1 || listingIndex + 1 >= parts.length) {
      return null;
    }

    const segments = parts.slice(1, listingIndex);
    if (segments.length < 2) {
      return null;
    }

    const vertical = segments[0];
    const topLevelKey = vertical === "motors" ? "motors" : `marketplace/${segments[1]}`;

    return {
      categoryPath: segments.join("/"),
      topLevelKey,
      segments,
    };
  }

  /**
   * Builds a flat tree of category nodes. Counts include all descendants.
   * @param {string[]} hrefs
   * @returns {CategoryNode[]}
   */
  function buildCategoryTree(hrefs) {
    /** @type {Map<string, CategoryNode>} */
    const nodes = new Map();

    for (const href of hrefs) {
      const category = parseListingCategory(href);
      if (!category) {
        continue;
      }

      const keys = categoryNodeKeys(category);
      keys.forEach((key, depth) => {
        const existing = nodes.get(key);
        if (existing) {
          existing.count += 1;
          return;
        }

        nodes.set(key, {
          key,
          label: labelForCategoryKey(key),
          count: 1,
          depth,
          parentKey: depth === 0 ? null : keys[depth - 1],
        });
      });
    }

    /** @type {Map<string, CategoryNode[]>} */
    const childrenByParent = new Map();
    /** @type {CategoryNode[]} */
    const roots = [];

    for (const node of nodes.values()) {
      if (node.parentKey === null) {
        roots.push(node);
        continue;
      }

      const children = childrenByParent.get(node.parentKey) ?? [];
      children.push(node);
      childrenByParent.set(node.parentKey, children);
    }

    /** @type {CategoryNode[]} */
    const ordered = [];
    /** @param {CategoryNode} node */
    function visit(node) {
      ordered.push(node);
      for (const child of childrenByParent.get(node.key) ?? []) {
        visit(child);
      }
    }

    for (const root of roots) {
      visit(root);
    }

    return ordered;
  }

  /**
   * Tests whether a category path is hidden by any selected node.
   * @param {string} categoryPath
   * @param {Set<string>} excludedKeys
   * @returns {boolean}
   */
  function isExcludedPath(categoryPath, excludedKeys) {
    for (const key of excludedKeys) {
      if (isAncestorKey(key, categoryPath)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Describes how a category node relates to the current exclusions.
   * @param {string} nodeKey
   * @param {Set<string>} excludedKeys
   * @returns {NodeSelectionState}
   */
  function getNodeSelectionState(nodeKey, excludedKeys) {
    if (excludedKeys.has(nodeKey)) {
      return "selected";
    }

    for (const key of excludedKeys) {
      if (isAncestorKey(key, nodeKey)) {
        return "covered";
      }
    }

    for (const key of excludedKeys) {
      if (isAncestorKey(nodeKey, key)) {
        return "partial";
      }
    }

    return "none";
  }

  /**
   * Builds the storage key for a search. Pagination, sort order and view are ignored.
   * @param {string} href
   * @returns {string}
   */
  function normalizeFilterScope(href) {
    const url = new URL(href, "https://www.trademe.co.nz");
    const params = [...url.searchParams.entries()]
      .filter(([key]) => !IGNORED_SCOPE_PARAMS.has(key))
      .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
        return leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue);
      });

    const search = new URLSearchParams(params).toString();
    return search.length > 0 ? `${url.pathname}?${search}` : url.pathname;
  }

  /**
   * @param {string} slug
   * @returns {string}
   */
  function prettifySlug(slug) {
    return slug
      .split("-")
      .filter(Boolean)
      .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
      .join(" ");
  }

  /**
   * @param {ListingCategory} category
   * @returns {string[]}
   */
  function categoryNodeKeys(category) {
    const start = category.segments[0] === "motors" ? 1 : 2;
    const end =
      category.segments[0] === "motors"
        ? Math.min(2, category.segments.length)
        : category.segments.length;
    const keys = [];

    for (let index = start; index <= end; index += 1) {
      keys.push(category.segments.slice(0, index).join("/"));
    }

    return keys;
  }

  /** @param {string} key */
  function labelForCategoryKey(key) {
    if (key === "motors") {
      return "Motors";
    }

    const parts = key.split("/");
    if (parts[0] === "marketplace" && parts.length === 2) {
      const slug = parts[1];
      return MARKETPLACE_LABELS[slug] ?? prettifySlug(slug);
    }

    const slug = parts.at(-1) ?? key;
    return SUBCATEGORY_LABELS[slug] ?? prettifySlug(slug);
  }

  /**
   * @param {string} ancestor
   * @param {string} descendant
   */
  function isAncestorKey(ancestor, descendant) {
    return descendant === ancestor || descendant.startsWith(`${ancestor}/`);
  }

  return {
    buildCategoryTree,
    getNodeSelectionState,
    isExcludedPath,
    normalizeFilterScope,
    parseListingCategory,
  };
});
