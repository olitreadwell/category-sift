const fs = require("node:fs");
const path = require("node:path");

const { chromium, expect, test } = require("@playwright/test");

const extensionPath = path.resolve(__dirname, "../..");
const fixture = fs.readFileSync(path.join(__dirname, "../fixtures/search.html"), "utf8");

test("hides category subtrees and remembers them for the same search", async () => {
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });

  try {
    const page = await context.newPage();
    await page.route("https://www.trademe.co.nz/a/marketplace/search?*", (route) => {
      return route.fulfill({
        status: 200,
        contentType: "text/html",
        body: fixture,
      });
    });

    await page.goto("https://www.trademe.co.nz/a/marketplace/search?dollar_reserve_only=true");

    const panel = page.locator("#trademe-category-filter .panel");
    await expect(panel).toBeVisible();

    const gamingTradingCards = panel.locator(
      'input[data-category-key="marketplace/gaming/trading-cards"]',
    );
    const sportsTradingCards = panel.locator(
      'input[data-category-key="marketplace/sports/trading-cards"]',
    );
    const gamingToggle = panel.locator(
      '[data-action="toggle-branch"][data-category-key="marketplace/gaming"]',
    );
    const sportsToggle = panel.locator(
      '[data-action="toggle-branch"][data-category-key="marketplace/sports"]',
    );

    await expect(gamingTradingCards).toBeHidden();
    await expect(sportsTradingCards).toBeHidden();
    await expect(gamingToggle).toHaveAttribute("aria-expanded", "false");

    const books = panel.locator('input[data-category-key="marketplace/books"]');
    await books.check();
    await expect(page.locator('[data-listing="books-1"]')).toBeHidden();
    await books.uncheck();
    await expect(page.locator('[data-listing="books-1"]')).toBeVisible();

    await gamingToggle.click();
    await expect(gamingTradingCards).toBeVisible();
    await expect(gamingToggle).toHaveAttribute("aria-expanded", "true");

    await sportsToggle.click();
    await expect(sportsTradingCards).toBeVisible();

    await gamingTradingCards.check();
    await expect(page.locator('[data-listing="gaming-trading-card-1"]')).toBeHidden();
    await expect(page.locator('[data-listing="gaming-console-1"]')).toBeVisible();
    await expect(page.locator('[data-listing="sports-trading-card-1"]')).toBeVisible();
    await expect(panel.locator('[data-role="hidden-count"]')).toHaveText("1 hidden");
    await expect(panel.locator('input[data-category-key="marketplace/gaming"]')).toHaveJSProperty(
      "indeterminate",
      true,
    );

    await sportsTradingCards.check();
    await expect(page.locator('[data-listing="sports-trading-card-1"]')).toBeHidden();
    await expect(page.locator('[data-listing="sports-cycling-1"]')).toBeVisible();
    await expect(panel.locator('[data-role="hidden-count"]')).toHaveText("2 hidden");

    await page.evaluate(() => {
      const row = document.querySelector("#results");
      const cell = document.createElement("tg-col");
      cell.className = "result-cell";
      cell.dataset.listing = "gaming-trading-card-2";
      cell.innerHTML = `
        <tm-marketplace-search-card>
          <a href="/a/marketplace/gaming/trading-cards/magic/listing/888">
            <article class="result-card">Magic cards</article>
          </a>
        </tm-marketplace-search-card>
      `;
      row?.append(cell);
    });
    await expect(page.locator('[data-listing="gaming-trading-card-2"]')).toBeHidden();

    await panel.locator('[data-action="reveal"]').click();
    await expect(page.locator('[data-listing="gaming-trading-card-1"]')).toBeVisible();
    await expect(page.locator('[data-listing="sports-trading-card-1"]')).toBeVisible();

    await page.reload();
    await expect(gamingTradingCards).toBeVisible();
    await expect(sportsTradingCards).toBeVisible();
    await expect(page.locator('[data-listing="gaming-trading-card-1"]')).toBeHidden();
    await expect(page.locator('[data-listing="sports-trading-card-1"]')).toBeHidden();
    await expect(page.locator('[data-listing="gaming-console-1"]')).toBeVisible();
    await expect(page.locator('[data-listing="sports-cycling-1"]')).toBeVisible();

    await gamingToggle.click();
    await expect(gamingTradingCards).toBeHidden();
    await expect(panel.locator('input[data-category-key="marketplace/gaming"]')).toHaveJSProperty(
      "indeterminate",
      true,
    );
    await gamingToggle.click();
    await expect(gamingTradingCards).toBeVisible();
    await expect(gamingTradingCards).toBeChecked();

    await panel.locator('input[data-category-key="marketplace/gaming"]').check();
    await expect(page.locator('[data-listing="gaming-trading-card-1"]')).toBeHidden();
    await expect(page.locator('[data-listing="gaming-console-1"]')).toBeHidden();
    await expect(gamingTradingCards).toBeDisabled();
    await expect(page.locator('[data-listing="sports-cycling-1"]')).toBeVisible();
    await expect(page.locator('[data-ad="display"]')).toBeVisible();
    await expect(page.locator('[data-listing="sponsored-gaming"]')).toBeVisible();

    const jewelleryToggle = panel.locator(
      '[data-action="toggle-branch"][data-category-key="marketplace/jewellery-watches"]',
    );
    const mensJewellery = panel.locator(
      'input[data-category-key="marketplace/jewellery-watches/mens-jewellery"]',
    );

    await jewelleryToggle.click();
    await expect(mensJewellery).toBeVisible();
    await mensJewellery.check();
    await jewelleryToggle.click();
    await expect(mensJewellery).toBeHidden();
    await expect(jewelleryToggle).toHaveAttribute("aria-expanded", "false");

    await panel.locator('input[data-category-key="motors"]').check();
    await expect(page.locator('[data-listing="motors-1"]')).toBeHidden();
    await expect(mensJewellery).toBeHidden();
    await expect(jewelleryToggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator('[data-listing="books-1"]')).toBeVisible();
  } finally {
    await context.close();
  }
});
