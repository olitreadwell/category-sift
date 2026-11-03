const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildCategoryTree,
  getNodeSelectionState,
  isExcludedPath,
  normalizeFilterScope,
  parseListingCategory,
} = require("../../src/filter-core.js");

test("parses a Marketplace listing to its full category path", () => {
  const category = parseListingCategory(
    "/a/marketplace/gaming/trading-cards/pokemon/listing/6210176105",
  );

  assert.deepEqual(category, {
    categoryPath: "marketplace/gaming/trading-cards/pokemon",
    topLevelKey: "marketplace/gaming",
    segments: ["marketplace", "gaming", "trading-cards", "pokemon"],
  });
});

test("keeps the full Motors category path", () => {
  const category = parseListingCategory("/a/motors/cars/mazda/cx-5/listing/6209903197");

  assert.deepEqual(category, {
    categoryPath: "motors/cars/mazda/cx-5",
    topLevelKey: "motors",
    segments: ["motors", "cars", "mazda", "cx-5"],
  });
});

test("ignores links that are not Trade Me listing links", () => {
  assert.equal(parseListingCategory("/a/marketplace/gaming/"), null);
  assert.equal(parseListingCategory("https://example.com/listing/1"), null);
});

test("builds a category tree with subtree counts", () => {
  const tree = buildCategoryTree([
    "/a/marketplace/gaming/trading-cards/pokemon/listing/1",
    "/a/marketplace/gaming/consoles/listing/2",
    "/a/marketplace/books/fiction/listing/3",
    "/a/marketplace/gaming/trading-cards/pokemon/listing/4",
  ]);

  assert.deepEqual(tree, [
    {
      key: "marketplace/gaming",
      label: "Gaming",
      count: 3,
      depth: 0,
      parentKey: null,
    },
    {
      key: "marketplace/gaming/trading-cards",
      label: "Trading cards",
      count: 2,
      depth: 1,
      parentKey: "marketplace/gaming",
    },
    {
      key: "marketplace/gaming/trading-cards/pokemon",
      label: "Pokemon",
      count: 2,
      depth: 2,
      parentKey: "marketplace/gaming/trading-cards",
    },
    {
      key: "marketplace/gaming/consoles",
      label: "Consoles",
      count: 1,
      depth: 1,
      parentKey: "marketplace/gaming",
    },
    {
      key: "marketplace/books",
      label: "Books",
      count: 1,
      depth: 0,
      parentKey: null,
    },
    {
      key: "marketplace/books/fiction",
      label: "Fiction",
      count: 1,
      depth: 1,
      parentKey: "marketplace/books",
    },
  ]);
});

test("keeps each branch contiguous when listings arrive out of order", () => {
  const tree = buildCategoryTree([
    "/a/marketplace/gaming/trading-cards/pokemon/listing/1",
    "/a/marketplace/sports/trading-cards/other/listing/2",
    "/a/marketplace/gaming/trading-cards/other/listing/3",
  ]);

  assert.deepEqual(
    tree.map((node) => node.key),
    [
      "marketplace/gaming",
      "marketplace/gaming/trading-cards",
      "marketplace/gaming/trading-cards/pokemon",
      "marketplace/gaming/trading-cards/other",
      "marketplace/sports",
      "marketplace/sports/trading-cards",
      "marketplace/sports/trading-cards/other",
    ],
  );
});

test("stops the Motors tree at vehicle type", () => {
  const tree = buildCategoryTree([
    "/a/motors/cars/mazda/cx-5/listing/1",
    "/a/motors/trucks/tractor-units/listing/2",
  ]);

  assert.deepEqual(
    tree.map((node) => node.key),
    ["motors", "motors/cars", "motors/trucks"],
  );
});

test("matches exclusions against the full category subtree", () => {
  const excluded = new Set(["marketplace/sports/trading-cards"]);

  assert.equal(isExcludedPath("marketplace/sports/trading-cards/other", excluded), true);
  assert.equal(isExcludedPath("marketplace/sports/cycling", excluded), false);
  assert.equal(isExcludedPath("marketplace/gaming/trading-cards/pokemon", excluded), false);
});

test("a parent exclusion hides every descendant", () => {
  const excluded = new Set(["marketplace/gaming"]);

  assert.equal(isExcludedPath("marketplace/gaming/trading-cards/pokemon", excluded), true);
  assert.equal(isExcludedPath("marketplace/gaming/consoles", excluded), true);
  assert.equal(isExcludedPath("marketplace/sports", excluded), false);
});

test("reports selected, covered, partial and clear category nodes", () => {
  assert.equal(
    getNodeSelectionState("marketplace/gaming", new Set(["marketplace/gaming"])),
    "selected",
  );
  assert.equal(
    getNodeSelectionState("marketplace/gaming/trading-cards", new Set(["marketplace/gaming"])),
    "covered",
  );
  assert.equal(
    getNodeSelectionState("marketplace/gaming", new Set(["marketplace/gaming/trading-cards"])),
    "partial",
  );
  assert.equal(getNodeSelectionState("marketplace/books", new Set(["marketplace/gaming"])), "none");
});

test("normalises filter scope by dropping page, sort and view", () => {
  const scope = normalizeFilterScope(
    "https://www.trademe.co.nz/a/marketplace/search?sort_order=price_asc&page=2&dollar_reserve_only=true&view=gallery",
  );

  assert.equal(scope, "/a/marketplace/search?dollar_reserve_only=true");
});

test("keeps the search text in the filter scope", () => {
  const scope = normalizeFilterScope(
    "https://www.trademe.co.nz/a/marketplace/search?search_string=rtx+4090&page=3",
  );

  assert.equal(scope, "/a/marketplace/search?search_string=rtx+4090");
});
