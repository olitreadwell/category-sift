# Filter rendered listings instead of calling the Trade Me API

The extension hides listings by reading category paths from rendered listing cards. The Trade Me search API needs account authorization, has request limits, and does not map cleanly to every result shown on the page. The rendered DOM gives the prototype the same listings the user sees without a login flow. The trade-off is that Trade Me markup changes can break discovery, so the content script must fail visible rather than hide the wrong content.
