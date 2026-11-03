# Category Sift

A browser extension for filtering listing categories on Trade Me search pages.

## Language

**Listing**:
One item offered for sale, shown as a card in a result list.
_Avoid_: Product, result, ad

**Category path**:
The full category path carried by a listing URL, such as `marketplace/gaming/trading-cards/pokemon`.
_Avoid_: Category group, item type, tag, keyword

**Category tree**:
The collapsible indented list of category nodes built from the loaded listings, with parent and child relationships.
_Avoid_: Category list, filter list

**Category node**:
A selectable point in the category tree, such as Gaming or Gaming > Trading cards.
_Avoid_: Category group, filter, bucket

**Branch**:
A category node with children that can be expanded or collapsed.
_Avoid_: Folder, group

**Exclusion**:
A selected category node whose subtree is hidden from the result list.
_Avoid_: Block, ban, mute

**Filter scope**:
The normalised search or category page that owns the current exclusions. Page, sort order and view do not change the scope.
_Avoid_: Saved filter, profile

**Hidden listing**:
A listing hidden by this extension. It is not removed from Trade Me and still appears when hidden listings are revealed.
_Avoid_: Removed listing, deleted listing

**Ad card**:
Sponsored or display content without a listing category. It never counts as a listing.
_Avoid_: Listing, result
