#!/usr/bin/env python3
"""
Generates supabase/seed.sql from structured Python data.
Run manually whenever the real menu/ingredient data changes:
    python3 scripts/gen_seed.py > supabase/seed.sql
This script itself is not part of the app runtime -- it's a one-time/occasional
authoring aid so the ~250 ingredient-mapping rows can be reviewed as data
instead of hand-typed SQL (much lower chance of a typo silently breaking a
lookup by ingredient name).
"""

# ---------------------------------------------------------------------------
# Seats
# ---------------------------------------------------------------------------
SEATS = [(f"T{i}", f"Table {i}", "table") for i in range(1, 10)] + [
    (f"S{i}", f"Counter {i}", "counter") for i in range(1, 5)
]

# ---------------------------------------------------------------------------
# Ingredients: name -> (unit, starting_stock, low_stock_threshold)
# Starting stock / threshold are placeholder par levels for day one -- not a
# real physical count. Adjust via /admin/inventory once real counts are in.
# ---------------------------------------------------------------------------
PRIMARIES = {
    "White Sauce": ("ml", 1000, 200),
    # Round 29 (9/24 fourth follow-up): retired as its own tracked primary --
    # the owner's call is that sautéing mushrooms in-kitchen doesn't need its
    # own separate inventory line, it's just "Mushroom." Recipes that used to
    # deduct Sautéed Mushrooms now deduct the plain "Mushroom" raw ingredient
    # directly, at the same gram figure (see MAPPINGS' SD-MUS/SP-AWS0 below).
    # This does mean the small amount of Garlic/Green Chilli/Butter/Olive Oil/
    # Salt/Black Pepper that went into the sauté step is no longer tracked
    # per-order -- flagged to the owner as a real (if minor) loss of
    # granularity, not silently dropped.
    "Potato Patty": ("pcs", 24, 6),
    "Tikka Marinated Mince": ("g", 800, 150),
    "Homemade Mayo": ("ml", 750, 150),
    "Fresh Salsa": ("ml", 300, 60),
    "Gochujang Sauce": ("ml", 300, 60),
    # Round 23: was tracked directly in tbsp; converted to g (1 tbsp = 15g,
    # the owner's own conversion rule) so it deducts in the same unit as
    # everything else. unit_label="tbsp" is set on each recipe link below so
    # staff still SEE "tbsp" on screen -- only the underlying stock math
    # changed, per the Round 22 unit_label design (display-only override).
    "Caramelised Onions": ("g", 600, 150),
    "Sugar Syrup": ("ml", 1200, 200),
    "Coffee Concentrate": ("ml", 1000, 200),
    "Black Tea Concentrate": ("ml", 1000, 200),
    # Added when the Drinks SOP introduced a blended-milk base (Meiji :
    # Carnation : Mali, 7:2:1) used across Cappuccino/Mocha/Cocoa. 2-day
    # shelf life per the SOP.
    "Base Milk": ("ml", 2000, 400),
    # House-made from Base Milk + cocoa powder + sugar, cooked down. Distinct
    # from the raw "Chocolate Sauce" ingredient (a store-bought drizzle, now
    # unlinked -- see UNLINKED_VISIBILITY_ONLY). 2-day shelf life.
    "Chocolate Syrup": ("ml", 800, 150),
    # Momo primaries, added once the food SOP got Momo recipes.
    "Chicken Keema": ("g", 1200, 250),
    "Veg Keema": ("g", 2200, 400),
    "Tomato Sauce": ("ml", 650, 150),
    # Round 29 (9/24 third follow-up): the owner reversed the prior round's
    # "Ginger-Garlic Paste" consolidation -- ginger paste and garlic paste
    # are prepped as two separate batch items in the kitchen (even though
    # both SOP recipes that use them happen to call for a 1:1 ratio), so
    # they're split back out here. Neither SOP documents a raw-ginger/
    # raw-garlic-to-paste conversion ratio (no batch-prep sub-section for
    # either), so -- same treatment Caramelised Onions got before its own
    # recipe existed -- these are directly-restocked primaries with no
    # nested PRIMARY_RECIPES entry.
    "Ginger Paste": ("g", 500, 100),
    "Garlic Paste": ("g", 500, 100),
}

RAW = {
    # Food
    "Frozen Fries": ("g", 5000, 1000),
    # Real usage pattern (owner, Aug 2026): buys 5L/week, pours the whole
    # jug in Monday, draws down through the week -- currently open Mon-Fri
    # with no mid-week top-up. Plan is to refill every 3 days and add
    # Saturday service once order volume grows enough to justify it -- when
    # that happens, bump current_stock accordingly (or restock mid-week via
    # /admin/inventory) rather than changing this seed file again.
    "Frying Oil": ("L", 5, 1),
    "Ketchup": ("ml", 2000, 400),
    "Peri-Peri Seasoning": ("g", 300, 60),
    "Garlic Powder": ("g", 300, 60),
    "Zab Seasoning": ("g", 300, 60),
    # Added when the Zab Fries SOP picked up a second dry seasoning
    # alongside Zab Seasoning.
    "Lime Seasoning": ("g", 300, 60),
    # Round 29 (9/24 third follow-up): "Fresh Lemon Juice" removed and every
    # recipe that used it (Tikka Marinated Mince, Homemade Mayo, SD-CHS)
    # switched to this -- owner's explicit instruction, overriding the
    # Round 28 decision below (T-GLT0 etc.) that lemon/lime were genuinely
    # different bottles; the "Fresh" prefix was also dropped from the name
    # as part of the same round's broader "Fresh X" cleanup (see Ginger/
    # Coriander below too).
    "Lime Juice": ("ml", 500, 100),
    "Frozen Samosas": ("pcs", 60, 15),
    "Maggi Noodles": ("g", 2000, 400),
    "Maggi Masala Sachet": ("pcs", 30, 8),
    "Butter": ("g", 2000, 400),
    "Tortilla Chips": ("g", 1500, 300),
    "Mozzarella Cheese Shredded": ("g", 2000, 400),
    "Sour Cream": ("ml", 800, 150),
    "BBQ Sauce": ("ml", 800, 150),
    "Cheese Sauce": ("ml", 800, 150),
    "Sandwich Bread": ("slices", 100, 20),
    "Cheese Slice": ("pcs", 150, 30),
    "Tikka Masala Paste": ("ml", 500, 100),
    "Iceberg Lettuce": ("g", 2000, 400),
    "Burger Bun": ("pcs", 60, 15),
    "Frozen Chicken Patty": ("pcs", 60, 15),
    # Round 29 (9/24 third follow-up): "Fresh Cucumber Slices" renamed to
    # plain "Cucumber" and switched from a "slices" unit to grams (owner:
    # cucumber and cucumber slices are the same ingredient, tracking by
    # slice count was the inconsistency). ~8g/slice is an owner-authorized
    # estimate (same "assume a reasonable conversion" treatment as Garlic's
    # existing ~5g/clove figure) -- the SOP itself only ever says "3 slices,"
    # never a weight. Recipe link updated below (3 slices -> 24g).
    "Cucumber": ("g", 1200, 240),
    "Spaghetti (Dry)": ("g", 3000, 600),
    "Garlic": ("cloves", 200, 40),
    "Grated Parmesan Cheese": ("g", 800, 150),
    "Green Chilli": ("pcs", 100, 20),
    "Olive Oil": ("ml", 1500, 300),
    "Frozen Corn": ("g", 500, 100),
    "Frozen Peas": ("g", 500, 100),
    "Chilli Oil": ("ml", 500, 100),
    "Momo Wrap": ("pcs", 300, 60),
    # Drinks
    "Black Tea Leaves": ("g", 500, 100),
    "Red Label Tea Leaves": ("g", 300, 60),
    "Red Label Masala Powder": ("g", 300, 60),
    "Ginger": ("g", 500, 100),
    "Honey": ("ml", 800, 150),
    "Ground Coffee": ("g", 2000, 400),
    "Thai Tea Powder": ("g", 500, 100),
    "Dried Butterfly Pea Flowers": ("pcs", 200, 40),
    "Hazelnut Syrup": ("ml", 800, 150),
    "Chocolate Sauce": ("ml", 800, 150),
    "Cocoa Powder": ("g", 800, 150),
    "Strawberry Syrup": ("ml", 800, 150),
    "Mango Syrup": ("ml", 800, 150),
    "Passionfruit Syrup": ("ml", 800, 150),
    "Lychee Syrup": ("ml", 800, 150),
    # Added for the new Mixed Berry Soda menu item.
    "Mixed Berry Syrup": ("ml", 800, 150),
    # Round 21: the Drinks SOP replaced Lemon/Passionfruit Iced Tea's Black
    # Tea Concentrate base with a dedicated instant powder mix -- originally
    # tracked directly in tbsp since that was the SOP's own unit and there
    # was no owner-approved g-per-tbsp conversion yet.
    # Round 23: the owner gave an explicit conversion rule (1 tbsp = 15g), so
    # this converted from tbsp to g like everything else. unit_label="tbsp"
    # on each recipe link below preserves the on-screen display.
    "Lemon Iced Tea Powder": ("g", 3000, 600),
    "Blue Curacao Syrup (Non-Alcoholic)": ("ml", 500, 100),
    "Coconut Syrup": ("ml", 500, 100),
    "Soda Water": ("ml", 5000, 1000),
    "Cola": ("can", 48, 12),
    "Pink Salt": ("g", 200, 40),
    # Round 29 (9/24 fourth follow-up): merged the separate "Lemon" duplicate
    # (a legacy production row, gram-tracked) into this one -- owner's call
    # that lemon and lemon slice garnish are the same ingredient, tracked by
    # weight. Renamed from "Lemon Slice" (pcs) to "Lemon" (g); recipe qty
    # converted from "1 slice" to an assumed 8g/slice (same estimation
    # convention as Cucumber's ~8g/slice below) -- worth the owner's
    # confirmation if a real average slice weight is known.
    "Lemon": ("g", 1600, 320),

    # ------------------------------------------------------------------
    # Round 23: raw sub-ingredients behind the batch-prep primaries above.
    # Until now, a primary's own raw components were deliberately NOT
    # tracked (see PRIMARY_RECIPES below and the schema.sql prep_batch()
    # function for the reversal of that call) -- these are new per the
    # owner's explicit request to go through both SOPs and track every
    # ingredient behind every primary, food and drink. Quantities in
    # PRIMARY_RECIPES were converted from the SOPs' tbsp/tsp/pinch amounts
    # using the owner's own rule: 1 tbsp = 15g/ml, 1 tsp = 5g/ml, 1 pinch =
    # 0.3g, "to taste" = 1 pinch. Starting stock/threshold are placeholder
    # par levels, same convention as every other ingredient in this file.
    # ------------------------------------------------------------------
    "All-Purpose Flour": ("g", 3000, 600),
    "Cream Cheese": ("g", 1000, 200),
    "Salt": ("g", 5000, 1000),
    "White Pepper": ("g", 200, 40),
    "Nutmeg": ("g", 100, 20),
    # Round 29 (9/24 fourth follow-up): renamed from "Button Mushrooms (Raw)"
    # -- the owner's call that Sautéed Mushrooms is the same ingredient as
    # this one and doesn't need its own separate batch-prep tracking; see the
    # PRIMARIES section's own comment on retiring Sautéed Mushrooms.
    "Mushroom": ("g", 3000, 600),
    "Black Pepper": ("g", 500, 100),
    "Corn Flour": ("g", 2000, 400),
    "Onion": ("g", 5000, 1000),
    "Coriander": ("g", 500, 100),
    "Cumin Powder": ("g", 300, 60),
    "Coriander Powder": ("g", 300, 60),
    "Garam Masala": ("g", 300, 60),
    "Red Chilli Powder": ("g", 300, 60),
    # Distinct from the existing "Frozen Chicken Patty" (a preformed patty
    # product) -- this is loose raw mince, used only in Tikka Marinated Mince.
    "Raw Chicken Breast Mince": ("g", 5000, 1000),
    "Eggs": ("pcs", 200, 40),
    "Mustard Powder": ("g", 100, 20),
    # Round 29 (9/24 fourth follow-up): renamed from "Tomatoes" -- merged
    # with the separate legacy "Tomato" and "Tomato Slices" production
    # duplicates, per the owner's instruction to have one canonical "Tomato."
    "Tomato": ("g", 3000, 600),
    # Named "(Store-Bought)" to distinguish the purchased base sauce from the
    # "Gochujang Sauce" primary it's mixed into -- same product name in the
    # SOP, different inventory rows.
    "Gochujang Paste (Store-Bought)": ("ml", 1000, 200),
    "Light Soy Sauce": ("ml", 1000, 200),
    # Distinct SKU from the "Homemade Mayo" primary -- a separate
    # store-bought jar used only inside Gochujang Sauce.
    "Store-Bought Mayo": ("ml", 1000, 200),
    # Distinct from "Raw Chicken Breast Mince" above -- the SOP's Chicken
    # Keema recipe uses a coarser/cheaper momo-filling grade mince, bought
    # separately. Named to avoid colliding with the "Chicken Keema" primary
    # itself, which is the finished, seasoned product made FROM this.
    "Raw Chicken Mince (Momo Grade)": ("g", 5000, 1000),
    "Spring Onion": ("g", 500, 100),
    "MSG": ("g", 100, 20),
    "Sesame Oil": ("ml", 500, 100),
    # Generic cooking oil, distinct from "Olive Oil" (which the SOP calls out
    # by name specifically where that's what's meant).
    "Cooking Oil": ("ml", 3000, 500),
    "Carrot": ("g", 2000, 400),
    "Cabbage": ("g", 2000, 400),
    # Shared between Potato Patty and Veg Keema.
    "Potato": ("g", 5000, 1000),
    "Turmeric": ("g", 300, 60),
    "Paprika": ("g", 300, 60),
    "Timur Pepper": ("g", 100, 20),
    # Base Milk's three named brand components -- specific bar-purchased
    # products the SOP names directly.
    # Round 28 (9/24 second follow-up): the owner confirmed "Full-Fat Milk"
    # (previously its own separate SKU, used only in White Sauce) and
    # "Meiji Milk" are literally the same purchased product -- the cafe
    # buys one milk, brand Meiji, and both the Food SOP's White Sauce and
    # the Drinks SOP's Base Milk recipe draw from it. Merged into this one
    # ingredient; White Sauce's primary recipe now points here instead of
    # the now-removed "Full-Fat Milk" row (see PRIMARY_RECIPES below).
    # Round 30 (9/30): owner doesn't want to distinguish brand for the
    # fresh-milk pool at all -- renamed "Meiji Milk" -> plain "Milk" (no
    # brand). The other two named components turned out to be mislabeled:
    # a fresh SOP re-read shows Carnation is the evaporated milk (not
    # condensed, as first guessed) and Mali is the condensed milk -- both
    # renamed to generic names with the brand moved to the ingredient's
    # own brand field instead of baked into the name.
    "Milk": ("ml", 6000, 1000),
    "Evaporated Milk": ("ml", 3000, 500),  # brand: Carnation
    "Condensed Milk": ("ml", 3000, 500),  # brand: Mali
    "Instant Coffee": ("g", 2000, 400),
    # Plain granulated sugar, used inside Sugar Syrup and Chocolate Syrup's
    # own recipes -- distinct from the "Sugar Syrup" primary itself.
    "Sugar": ("g", 10000, 2000),
    "Breadcrumbs (Dry)": ("g", 2000, 400),

    # ------------------------------------------------------------------
    # Round 29 (9/24 third follow-up): full ingredient-vs-menu-item audit
    # (owner's request: "account for every ingredient used in a menu item").
    # These 5 rows came back as genuinely orphaned -- not referenced by any
    # current recipe -- and a fresh full re-read of both SOPs found no
    # mention of any of them anywhere, in any dish, under any name. Kept as
    # restockable rows (not deleted) and moved to UNLINKED_VISIBILITY_ONLY
    # below rather than force-linked to a guessed recipe. Cauliflower in
    # particular was actually purchased (Sep 17 restock, 700g/฿89) -- worth
    # the owner's attention specifically, since as of this recipe no dish
    # deducts it at all.
    # ------------------------------------------------------------------
    "Smoked Paprika": ("g", 200, 40),
    # "Tomato Slices" removed here as of Round 29 (9/24 fourth follow-up) --
    # merged into "Tomato" above, per the owner's instruction to have one
    # canonical Tomato ingredient rather than separate whole/slices/plural
    # rows. See PRIMARIES' "Tomato" comment.
    "Pickled Cucumber Slices": ("slices", 150, 30),
    "Pickled Cabbage / Coleslaw": ("g", 1000, 200),
    "Cauliflower": ("g", 1500, 300),
}

# ---------------------------------------------------------------------------
# Round 23: nested bill-of-materials for batch-prep primaries. Each entry is
# primary_name -> (reference_batch_qty, [(raw_ingredient_name, qty), ...]),
# where reference_batch_qty is in the primary's own tracked unit (see
# PRIMARIES above) and qty is the SOP's amount for that exact reference
# batch. schema.sql's prep_batch() scales these to whatever batch size staff
# actually record: qty_per_unit = qty / reference_batch_qty.
#
# Sourced from a full re-read of both SOPs (Food section 1, Drinks batch-prep
# section + the Black Tea recipe's embedded concentrate instructions).
# Several entries are judgment calls the owner should know about:
#   - Chicken Keema's and Veg Keema's own ingredient tables don't sum to
#     their own stated yields (likely a source-spreadsheet error) -- used the
#     SOP's literal ingredient amounts against its literal stated yield
#     anyway, per instruction, rather than silently reconciling the gap.
#   - Gochujang Sauce's stated "2 servings" doesn't match its own ingredient
#     total (65ml) or the burger's "15ml per serving" note (65ml / 15ml =
#     ~4.3 servings) -- used the actual 65ml ingredient total as the
#     reference batch.
#   - Garlic is tracked in cloves; Tomato Sauce's "40g" garlic was converted
#     at 1 clove ~= 5g (an approximation, not an SOP-stated fact).
#   - Fresh Salsa's "1/2 medium onion" and "1-2 green chilli" have no exact
#     SOP gram figure -- used ~60g for the onion (matching Potato Patty's own
#     60g/"1 small" estimate) and the top of the chilli range (2).
#   - Chocolate Syrup's true finished ml yield isn't stated (SOP just says
#     "a little less" than the milk you start with) -- used the 1000ml
#     Base-Milk-in figure as the reference batch on an input basis.
#   - Round 28 (9/24 second follow-up): Caramelised Onions previously had NO
#     ingredient table in the SOP (only prose) and was deliberately left out
#     of this dict as a directly-restocked primary with no nested deduction.
#     The owner has now added a real quantified recipe (Primary 1.11); it's
#     added below using the same tbsp/tsp->g conversion rule as everything
#     else (1 tbsp = 15g/ml, 1 tsp = 5g/ml).
# ---------------------------------------------------------------------------
PRIMARY_RECIPES = {
    # Round 28 (9/24 second follow-up): "Full-fat milk" -> "Meiji Milk",
    # same 200ml, per the owner-confirmed Full-Fat Milk/Meiji Milk merge
    # (see the Meiji Milk RAW entry's comment above). Round 30: "Meiji
    # Milk" -> plain "Milk" (see the RAW entry's Round 30 comment).
    "White Sauce": (250, [
        ("Butter", 15), ("All-Purpose Flour", 15), ("Milk", 200),
        ("Cream Cheese", 25), ("Salt", 2.5), ("White Pepper", 0.3), ("Nutmeg", 0.3),
    ]),
    # "Sautéed Mushrooms" removed here as of Round 29 (9/24 fourth follow-up)
    # -- retired as its own primary; see PRIMARIES' comment and MAPPINGS'
    # SD-MUS/SP-AWS0 entries, which now deduct "Mushroom" directly.
    # Round 28: revised Food SOP's Potato Patty table/method no longer
    # includes Fresh Lemon Juice at all -- removed rather than guessed as
    # still-current (owner confirmed: trust the revised SOP).
    "Potato Patty": (8, [
        ("Potato", 750), ("Breadcrumbs (Dry)", 60), ("Corn Flour", 20), ("Onion", 60),
        ("Green Chilli", 2), ("Coriander", 30), ("Cumin Powder", 2.5),
        ("Coriander Powder", 2.5), ("Garam Masala", 1.25), ("Red Chilli Powder", 2.5),
        ("Salt", 3.75),
    ]),
    "Tikka Marinated Mince": (400, [
        ("Raw Chicken Breast Mince", 400), ("Tikka Masala Paste", 30), ("Garlic", 3),
        ("Ginger", 5), ("Lime Juice", 15), ("Salt", 2.5), ("Cooking Oil", 15),
    ]),
    "Homemade Mayo": (250, [
        ("Eggs", 2), ("Garlic", 2), ("Lime Juice", 22.5), ("Olive Oil", 160),
        ("Salt", 2.5), ("White Pepper", 0.3), ("Mustard Powder", 1.25),
    ]),
    "Fresh Salsa": (150, [
        ("Tomato", 300), ("Onion", 60), ("Garlic", 3), ("Green Chilli", 2),
        ("Salt", 2.5), ("Black Pepper", 1.25), ("Lime Juice", 15), ("Coriander", 30),
    ]),
    "Gochujang Sauce": (65, [
        ("Gochujang Paste (Store-Bought)", 45), ("Light Soy Sauce", 5), ("Store-Bought Mayo", 15),
    ]),
    # Round 29 (9/24 third follow-up): Chicken Keema's own SOP table (Primary
    # 1.8) lists Ginger paste 40g and Garlic paste 40g as two separate rows
    # -- a 1160g-batch re-audit found the previous single "Ginger-Garlic
    # Paste" 10g figure was wrong (predated this consolidation entirely, an
    # old error, not something this round's split caused) and has been
    # corrected to the real 40g/40g split.
    "Chicken Keema": (1160, [
        ("Raw Chicken Mince (Momo Grade)", 1000), ("Onion", 588), ("Spring Onion", 59),
        ("Ginger Paste", 40), ("Garlic Paste", 40), ("Salt", 3.6), ("Black Pepper", 3.6), ("MSG", 3.6),
        ("Coriander Powder", 3.6), ("Coriander", 59), ("Cumin Powder", 3.6),
        ("Butter", 24), ("Sesame Oil", 24), ("Cooking Oil", 24),
    ]),
    # Round 28: revised Food SOP has a genuinely blank row exactly where
    # Cauliflower used to be (confirmed via direct PDF image inspection, not
    # a text-extraction artifact) -- removed per the owner's instruction to
    # trust the revised SOP.
    # Round 29 (9/24 third follow-up): split back out of "Ginger-Garlic
    # Paste" into separate Ginger Paste / Garlic Paste lines, 5g each (the
    # owner reversed the prior round's consolidation -- see the PRIMARIES
    # entries' own comment). Same total (10g) as before, just split by name.
    "Veg Keema": (2145, [
        ("Carrot", 400), ("Cabbage", 400), ("Potato", 300),
        ("Onion", 300), ("Coriander", 50), ("Spring Onion", 50), ("Salt", 15),
        ("Black Pepper", 7.5), ("Garam Masala", 7.5), ("Butter", 20), ("Cumin Powder", 5),
        ("Coriander Powder", 5), ("Ginger Paste", 5), ("Garlic Paste", 5),
        ("Light Soy Sauce", 10), ("Sesame Oil", 20),
    ]),
    "Tomato Sauce": (700, [
        ("Tomato", 400), ("Ginger", 40), ("Garlic", 8), ("Turmeric", 15),
        ("Salt", 15), ("Paprika", 15), ("Timur Pepper", 5),
    ]),
    # Round 30: "Meiji Milk" -> "Milk", "Carnation Evaporated Milk" ->
    # "Evaporated Milk" (brand Carnation), "Mali Condensed Milk" ->
    # "Condensed Milk" (brand Mali). Same 700/200/100 split as before, just
    # renamed (see the RAW entries' Round 30 comment).
    "Base Milk": (1000, [
        ("Milk", 700), ("Evaporated Milk", 200), ("Condensed Milk", 100),
    ]),
    "Coffee Concentrate": (1000, [("Instant Coffee", 330)]),
    "Sugar Syrup": (1000, [("Sugar", 500)]),
    # Uses the Base Milk primary as one of its own inputs -- a primary can be
    # an ingredient of another primary, same as any raw ingredient.
    "Chocolate Syrup": (1000, [("Base Milk", 1000), ("Cocoa Powder", 133), ("Sugar", 533)]),
    "Black Tea Concentrate": (110, [("Black Tea Leaves", 10)]),
    # Round 28 (9/24 second follow-up): newly-added SOP recipe (Primary
    # 1.11). Salt "1/4 tsp" -> 1.25g per the standing conversion rule; Oil
    # is given as an explicit 30ml in the table (mapped to the generic
    # "Cooking Oil" ingredient, same convention as Tikka Marinated Mince's
    # and Chicken Keema's own plain "Oil" lines). Yield is the SOP's own
    # stated "500g" -- used literally even though it equals the raw onion
    # input weight (cooking-down water loss vs. moisture/oil pickup roughly
    # cancel out per the SOP's own numbers; not reconciled further).
    "Caramelised Onions": (500, [("Onion", 500), ("Salt", 1.25), ("Cooking Oil", 30)]),
}

# Ingredients that exist for manual/visibility restock tracking only --
# genuinely unquantifiable in the SOP. Deliberately NOT linked to any menu
# item, so they're never auto-deducted -- staff track and restock by eye.
UNLINKED_VISIBILITY_ONLY = {
    "Frying Oil",  # "sufficient to submerge"
    # Round 28: was wrongly linked to Black Coffee Hot (C-BLC0) at 20g -- the
    # revised Drinks SOP's Black Coffee Hot table actually calls for Instant
    # Coffee 8g, an ingredient this dish never used before. Ground Coffee
    # itself isn't mentioned anywhere in the revised SOP and is now used by
    # no recipe -- kept as a restockable row rather than deleted outright.
    "Ground Coffee",
    # Both went from a fixed per-order quantity to an unquantified garnish
    # once the Drinks SOP reworked Cappuccino/Mocha/Cocoa around the new
    # Base Milk + Chocolate Syrup primaries: Cocoa Powder is now just an
    # unquantified dusting on Cocoa (previously 20g/13.5g/0.3g mixed-in
    # across three drinks); Chocolate Sauce is now just an unquantified
    # drizzle garnish on Mocha (previously 15ml mixed-in).
    "Cocoa Powder",
    "Chocolate Sauce",
    # Round 29 (9/24 third follow-up): full ingredient-vs-menu-item audit --
    # see these rows' own comment up in RAW for the full explanation.
    # ("Tomato Slices" was also on this list originally but was merged into
    # "Tomato" in the fourth follow-up instead -- see RAW's "Tomato" comment.)
    "Smoked Paprika",
    "Pickled Cucumber Slices",
    "Pickled Cabbage / Coleslaw",
    "Cauliflower",
}

# Ingredients excluded ENTIRELY -- no ingredients row at all, same manual
# par-stock treatment as salt and sugar (owner's ruling: keep a spare on
# hand, replace the moment one is opened/finished, no digital tracking).
# Originally just salt/sugar; extended on the owner's instruction to also
# cover chilli flakes, black pepper, condensed milk, and whipped cream,
# since none of those had a usable SOP quantity anyway. Purely documentation
# here -- nothing in this script creates rows for any of these.
# Round 23: Salt, Black Pepper, and Sugar were moved OUT of this set -- they
# now have real quantified uses inside primary recipes (PRIMARY_RECIPES,
# below), converted from the SOPs' tbsp/tsp/pinch amounts per the owner's own
# conversion rule, so they're tracked ingredients now. Condensed Milk,
# Whipped Cream, and Chilli Flakes stay excluded -- no quantified use was
# found for any of them in either SOP's batch-prep sections.
EXCLUDED_MANUAL_PAR_STOCK = {
    "Chilli Flakes",
    "Condensed Milk",
    "Whipped Cream",
}

# Round 22: packaging consumables (straws, takeaway boxes/cups/glasses).
# Deliberately NOT referenced by any MAPPINGS entry -- they're never part of
# a menu item's recipe. Instead, place_order()/fulfill_pre_order() deduct
# them dynamically at order time by looking these exact names up, based on
# each order item's fulfillment_type (dine-in vs takeaway) crossed with its
# menu item's packaging_type (food / hot_drink / cold_drink) -- see the
# Round 22 section of schema.sql. Placeholder par levels, same as everything
# else in this file.
CONSUMABLES = {
    "Takeaway Food Box": ("pcs", 200, 50),
    "Hot Takeaway Glass": ("pcs", 200, 50),
    "Cold Takeaway Glass": ("pcs", 200, 50),
    # Given with every cold drink regardless of dine-in/takeaway, so it turns
    # over faster than the takeaway-only containers above.
    "Straw": ("pcs", 300, 75),
    # Round 23: goes out with every Takeaway Food Box (deducted alongside it
    # in schema.sql -- same par level, since it turns over 1:1 with the box).
    "Plastic Cutlery Set": ("pcs", 200, 50),
}

ALL_INGREDIENTS = {**PRIMARIES, **RAW, **CONSUMABLES}

# ---------------------------------------------------------------------------
# Menu items: code -> (name, category, price, active)
# ---------------------------------------------------------------------------
MENU_ITEMS = [
    # Snacks
    ("SN-FRF", "French Fries", "Snacks", 45),
    ("SN-PPF", "Peri-Peri Fries", "Snacks", 50),
    ("SN-ZAF", "Zab Fries", "Snacks", 50),
    ("SN-SMT", "Samosa (3 Pcs)", "Snacks", 35),
    ("SN-MGN", "Maggie Noodles", "Snacks", 45),
    ("SN-ECM", "EXTRA CHEESY Maggie", "Snacks", 65),
    ("SN-CLN", "Chicken Loaded Nachos", "Snacks", 65),
    # Momo
    ("M-VMM", "Veg Momo", "Momo", 70),
    ("M-CMM", "Chicken Momo", "Momo", 80),
    # Sandwich
    ("SD-MUS", "Mushroom Sandwich", "Sandwich", 55),
    ("SD-GCS", "Grilled Cheese Sandwich", "Sandwich", 55),
    ("SD-CHS", "Chicken Sandwich", "Sandwich", 60),
    # Burger
    ("B-CVB", "Cheesy Veg Burger", "Burger", 55),
    ("B-CCB", "Chicken Cheese Burger", "Burger", 60),
    ("B-DTB", "Double Trouble Burger", "Burger", 75),
    ("B-GCB", "Gochujang Chicken Burger", "Burger", 65),
    ("B-SCB", "Spicy Chicken Burger", "Burger", 65),
    # Spaghetti
    ("SP-AWS0", "Spaghetti Alfredo (Mushroom)", "Spaghetti", 65),
    ("SP-AWS1", "Spaghetti Alfredo (Chicken)", "Spaghetti", 65),
    # Tea
    ("T-GLT0", "Ginger Lemon Tea (Hot)", "Tea", 35),
    ("T-GLT1", "Ginger Lemon Tea (Cold)", "Tea", 45),
    ("T-BLT0", "Black Tea (Hot)", "Tea", 30),
    ("T-BLT1", "Black Tea (Cold)", "Tea", 40),
    ("T-TMT0", "Thai Milk Tea (Hot)", "Tea", 40),
    ("T-TMT1", "Thai Milk Tea (Cold)", "Tea", 45),
    ("T-MST0", "Masala Tea (Hot)", "Tea", 35),
    ("T-MST1", "Masala Tea (Cold)", "Tea", 45),
    ("T-BPT0", "Butterfly Pea Tea (Hot)", "Tea", 40),
    ("T-BPT1", "Butterfly Pea Tea (Cold)", "Tea", 50),
    # Coffee
    ("C-BLC0", "Black Coffee (Hot)", "Coffee", 30),
    ("C-BLC1", "Black Coffee (Cold)", "Coffee", 40),
    ("C-CPN0", "Cappuccino (Hot)", "Coffee", 45),
    ("C-CPN1", "Cappuccino (Cold)", "Coffee", 55),
    ("C-HZL0", "Hazelnut Latte (Hot)", "Coffee", 45),
    ("C-HZL1", "Hazelnut Latte (Cold)", "Coffee", 55),
    ("C-MCH0", "Mocha (Hot)", "Coffee", 45),
    ("C-MCH1", "Mocha (Cold)", "Coffee", 55),
    ("C-CCA0", "Cocoa (Hot)", "Coffee", 40),
    ("C-CCA1", "Cocoa (Cold)", "Coffee", 50),
    # Iced Tea
    ("I-LIT", "Lemon Iced Tea", "Iced Tea", 45),
    ("I-PIT", "Passionfruit Iced Tea", "Iced Tea", 45),
    # Soda
    ("SO-SLS", "Strawberry Lemon Soda", "Soda", 45),
    ("SO-MPS", "Mango Passion Soda", "Soda", 45),
    ("SO-MBS", "Mixed Berry Soda", "Soda", 45),
    ("SO-LLS", "Lychee Lemon Soda", "Soda", 45),
    ("SO-BHS", "Blue Hawaii Soda", "Soda", 45),
    ("SO-CRC", "Crispy Coke", "Soda", 45),
]

# ---------------------------------------------------------------------------
# Menu item -> ingredient mappings: code -> [(ingredient_name, qty), ...]
# (Round 29 (9/24 third follow-up): the comment that used to be here said
# Veg Momo/Chicken Momo were intentionally absent because no SOP recipe
# existed for them -- that's stale. Both now have full recipes (Primary
# 1.8/1.9 Chicken/Veg Keema -> Momo Wrap + Tomato Sauce achar) and are
# mapped below via M-VMM/M-CMM, same as everything else.)
# ---------------------------------------------------------------------------
MAPPINGS = {
    # Round 28: revised Food SOP's table says Mayo 30ml only (no Ketchup) --
    # previously followed the method text (Ketchup 30ml + Mayo 15ml); owner
    # confirmed follow the table literally.
    "SN-FRF": [("Frozen Fries", 130), ("Homemade Mayo", 30)],
    # Round 28: revised table says Mayo 30ml (was following the method
    # text's 20ml) -- owner confirmed follow the table literally.
    # Round 28 (9/24 second follow-up, tbsp/tsp audit): the current table
    # has only two ingredient rows -- Frozen Fries and "Peri-peri seasoning
    # | 3/4 tsp" -- Garlic Powder and Smoked Paprika are no longer separate
    # table lines (removed per the same "table is authoritative, trust the
    # revised SOP" rule used elsewhere this round), and the seasoning itself
    # was previously coded at the wrong gram figure (2.25g, an old value
    # that predates this 3/4 tsp table row) -- corrected to 3.75g (3/4 tsp
    # x 5g/tsp, the standing conversion rule).
    "SN-PPF": [("Frozen Fries", 130), ("Peri-Peri Seasoning", 3.75), ("Homemade Mayo", 30)],
    # Updated SOP: dropped Fresh Lime Juice, picked up a second dry
    # seasoning (Lime Seasoning) and Mayonnaise (mapped to the Homemade Mayo
    # primary, same "house mayo" convention used elsewhere -- see project
    # notes). Round 21: the SOP's own table now lists Ketchup 30ml too
    # (previously only mentioned in the method text, not a tracked link).
    # Round 28: revised table raised both dry seasonings and no longer lists
    # Ketchup at all (method text still mentions plating with ketchup but
    # gives no amount) -- owner confirmed follow the table literally.
    "SN-ZAF": [("Frozen Fries", 130), ("Zab Seasoning", 7.5), ("Lime Seasoning", 5), ("Homemade Mayo", 30)],
    "SN-SMT": [("Frozen Samosas", 3), ("Ketchup", 30)],
    # Round 28: revised table raised Frozen Corn/Frozen Peas 10g -> 15g each.
    "SN-MGN": [("Maggi Noodles", 80), ("Maggi Masala Sachet", 1), ("Frozen Corn", 15), ("Frozen Peas", 15), ("Butter", 10)],
    "SN-ECM": [("Maggi Noodles", 80), ("Maggi Masala Sachet", 1), ("Frozen Corn", 15), ("Frozen Peas", 15), ("Cheese Slice", 1), ("Butter", 10)],
    "SN-CLN": [("Tortilla Chips", 80), ("Tikka Marinated Mince", 60), ("Mozzarella Cheese Shredded", 40), ("Sour Cream", 20), ("BBQ Sauce", 15), ("Cheese Sauce", 20), ("Fresh Salsa", 30)],

    # Round 28: revised table lowered the achar from 35ml to 30ml.
    "M-VMM": [("Veg Keema", 100), ("Momo Wrap", 10), ("Tomato Sauce", 30)],
    "M-CMM": [("Chicken Keema", 100), ("Momo Wrap", 10), ("Tomato Sauce", 30)],

    # Round 28: each sandwich's "served with Ketchup 30ml" line was never
    # auto-deducted before -- owner confirmed deduct every listed condiment.
    "SD-MUS": [("Sandwich Bread", 2), ("Butter", 10), ("Mushroom", 70), ("White Sauce", 50), ("Cheese Slice", 1), ("Ketchup", 30)],
    "SD-GCS": [("Sandwich Bread", 2), ("Butter", 10), ("Cheese Slice", 2), ("Mozzarella Cheese Shredded", 20), ("Ketchup", 30)],
    "SD-CHS": [("Sandwich Bread", 2), ("Butter", 5), ("Tikka Marinated Mince", 70), ("Homemade Mayo", 45), ("Tikka Masala Paste", 5), ("Lime Juice", 2.5), ("Iceberg Lettuce", 30), ("Ketchup", 30)],

    # Round 28: revised Food SOP dropped Tomato Slices from every burger
    # (consistently absent across all 5, read as a deliberate removal) and
    # each burger's own "served with Mayonnaise" side-dip line -- previously
    # never auto-deducted -- is now added on top of the existing in-burger
    # mayo (owner confirmed: deduct every listed condiment).
    "B-CVB": [("Burger Bun", 1), ("Butter", 5), ("Potato Patty", 1), ("Cheese Slice", 2), ("Iceberg Lettuce", 20), ("Caramelised Onions", 30, "tbsp"), ("Ketchup", 15), ("Homemade Mayo", 40)],
    "B-CCB": [("Burger Bun", 1), ("Butter", 5), ("Frozen Chicken Patty", 1), ("Cheese Slice", 1), ("Iceberg Lettuce", 20), ("Caramelised Onions", 30, "tbsp"), ("Ketchup", 15), ("Homemade Mayo", 40)],
    # Round 21: SOP's Double Trouble Burger table no longer lists Pickled
    # Cucumber Slices -- removed rather than guessed as still-current.
    "B-DTB": [("Burger Bun", 1), ("Butter", 5), ("Frozen Chicken Patty", 2), ("Cheese Slice", 2), ("Iceberg Lettuce", 20), ("Caramelised Onions", 30, "tbsp"), ("Ketchup", 20), ("Homemade Mayo", 45)],
    # Round 21: SOP swapped Pickled Cabbage/Coleslaw for Caramelised Onions
    # (2 tbsp, same as every other burger); cucumber unchanged.
    # Round 28 (this round, 9/24): the owner edited the Food SOP to fix an
    # internal contradiction flagged after the first Round 28 pass -- the
    # "Served with: Mayonnaise 30ml" table line used to be directly
    # contradicted by the method text's "No additional mayo. Serve."; the
    # owner removed that contradicting method line, so this burger now gets
    # the same 30ml Homemade Mayo side-dip as the other four (added fresh --
    # this burger never had any Homemade Mayo link before).
    # Round 29 (9/24 third follow-up): "Fresh Cucumber Slices" (3 slices) ->
    # "Cucumber" (24g), see its RAW entry's comment for the g/slice estimate.
    "B-GCB": [("Burger Bun", 1), ("Butter", 5), ("Frozen Chicken Patty", 1), ("Gochujang Sauce", 15), ("Caramelised Onions", 30, "tbsp"), ("Cucumber", 24), ("Homemade Mayo", 30)],
    "B-SCB": [("Burger Bun", 1), ("Butter", 5), ("Frozen Chicken Patty", 1), ("Cheese Slice", 1), ("Iceberg Lettuce", 20), ("Caramelised Onions", 30, "tbsp"), ("Ketchup", 15), ("Homemade Mayo", 40), ("Chilli Oil", 15)],

    # Round 28 (9/24 second follow-up, tbsp/tsp audit): both dishes' Garlic
    # Powder row reads "1/4 tsp" in the SOP, tsp-only with no gram figure --
    # corrected 0.75g -> 1.25g (1/4 tsp x 5g/tsp, the standing conversion
    # rule; the old 0.75g predates this table row).
    "SP-AWS0": [("Spaghetti (Dry)", 90), ("White Sauce", 120), ("Mushroom", 75), ("Butter", 5), ("Garlic", 1), ("Garlic Powder", 1.25), ("Grated Parmesan Cheese", 10), ("Olive Oil", 5)],
    "SP-AWS1": [("Spaghetti (Dry)", 90), ("White Sauce", 120), ("Tikka Marinated Mince", 70), ("Butter", 5), ("Garlic", 1), ("Garlic Powder", 1.25), ("Green Chilli", 1), ("Grated Parmesan Cheese", 10), ("Olive Oil", 5)],

    # Round 28: revised Drinks SOP raised Black Tea Leaves 3g -> 5g on both,
    # and switched Fresh Lemon Juice -> Fresh Lime Juice (owner confirmed:
    # genuinely different stocked bottles, not the same product renamed).
    "T-GLT0": [("Black Tea Leaves", 5), ("Ginger", 3), ("Lime Juice", 20), ("Honey", 7.5)],
    "T-GLT1": [("Black Tea Leaves", 5), ("Ginger", 3), ("Lime Juice", 20), ("Sugar Syrup", 7.5)],
    # Round 28: revised table raised Black Tea Leaves 3g -> 5g.
    "T-BLT0": [("Black Tea Leaves", 5)],
    "T-BLT1": [("Black Tea Concentrate", 110)],
    # Round 21: SOP switched both Thai Milk Tea variants from Full-Fat
    # Milk/Evaporated Milk to the Base Milk primary (same volumes as before).
    # Round 28: revised table lowered Thai Tea Powder 18g -> 10g and raised
    # Base Milk to a matching 100ml on both variants.
    # Round 29 (9/24 third follow-up): both variants also separately list a
    # "Milk (for froth) 15ml" line on top of the 100ml Base Milk -- this was
    # never linked before (Base Milk alone was tracked). Now that Meiji
    # Milk/Full-Fat Milk are one consolidated ingredient (owner: "it's just
    # milk"), added as a straight Meiji Milk deduction.
    # Round 30: "Meiji Milk" -> plain "Milk" (see RAW entry's Round 30 comment).
    "T-TMT0": [("Thai Tea Powder", 10), ("Base Milk", 100), ("Milk", 15)],
    "T-TMT1": [("Thai Tea Powder", 10), ("Base Milk", 100), ("Milk", 15)],
    # Round 21: SOP switched Masala Tea (hot & cold) from Full-Fat Milk to
    # the Base Milk primary, same 75ml either way.
    # Round 28: revised table raised both tea leaves and masala powder.
    "T-MST0": [("Red Label Tea Leaves", 7.5), ("Red Label Masala Powder", 2.5), ("Ginger", 4.5), ("Base Milk", 75)],
    "T-MST1": [("Red Label Tea Leaves", 10), ("Red Label Masala Powder", 5), ("Ginger", 4.5), ("Base Milk", 75)],
    # Round 28: switched Fresh Lemon Juice -> Fresh Lime Juice (see T-GLT0
    # above -- same owner-confirmed genuinely-different-bottles decision).
    "T-BPT0": [("Dried Butterfly Pea Flowers", 9), ("Honey", 15), ("Lime Juice", 10)],
    "T-BPT1": [("Dried Butterfly Pea Flowers", 9), ("Sugar Syrup", 15), ("Lime Juice", 10)],

    # Round 28: revised Drinks SOP's table clearly calls for Instant Coffee
    # 8g -- previously deducting Ground Coffee 20g, an ingredient this SOP
    # never mentions at all (an ingredient-identity bug, not just a
    # quantity drift; Ground Coffee moved to UNLINKED_VISIBILITY_ONLY).
    "C-BLC0": [("Instant Coffee", 8)],
    "C-BLC1": [("Coffee Concentrate", 60)],
    # Reworked around the new Base Milk primary; Sugar Syrup is an optional
    # customer add-in per the SOP (8ml hot / 10ml cold), not included by
    # default -- same "on request" treatment used elsewhere (e.g. milk in
    # Black Tea). The old cocoa/cinnamon dusting garnish is no longer
    # mentioned in the SOP at all for this drink.
    # Round 29 (9/24 third follow-up): the hot version's table also lists a
    # separate "Milk (for froth) 15ml" line on top of its 85ml Base Milk --
    # never linked before, added now (see T-TMT0 above for the same fix and
    # its reasoning). The iced version has no equivalent separate line in
    # the SOP (its Base Milk is simply upsized to 100ml instead), so C-CPN1
    # is unchanged.
    "C-CPN0": [("Coffee Concentrate", 25), ("Base Milk", 85), ("Milk", 15)],
    "C-CPN1": [("Coffee Concentrate", 30), ("Base Milk", 100)],
    # Coffee Concentrate volume increased, milk stays Full-Fat Milk (not
    # switched to Base Milk like the other three), single quantity now
    # covers both hot and cold per the SOP.
    # Round 21: SOP's base table gives Hot 30ml Coffee Concentrate (60ml is
    # iced-only) -- previously both variants used 60ml.
    # Round 28: revised table raised Hot's Coffee Concentrate 30ml -> 45ml
    # and switched both variants' milk from Full-Fat Milk to Base Milk
    # (150ml each) -- the SOP now names Base Milk explicitly for both.
    "C-HZL0": [("Coffee Concentrate", 45), ("Hazelnut Syrup", 15), ("Base Milk", 150)],
    "C-HZL1": [("Coffee Concentrate", 60), ("Hazelnut Syrup", 15), ("Base Milk", 150)],
    # Chocolate Sauce + Cocoa Powder mixed-in replaced by the new Chocolate
    # Syrup primary; garnish (chocolate drizzle + instant coffee dusting) is
    # unquantified, not linked.
    "C-MCH0": [("Coffee Concentrate", 25), ("Chocolate Syrup", 25), ("Base Milk", 100)],
    "C-MCH1": [("Coffee Concentrate", 30), ("Chocolate Syrup", 30), ("Base Milk", 125)],
    # Cocoa Powder mixed-in replaced by Chocolate Syrup; cocoa powder is now
    # only an unquantified garnish dusting, not linked.
    "C-CCA0": [("Chocolate Syrup", 33), ("Base Milk", 125)],
    "C-CCA1": [("Chocolate Syrup", 50), ("Base Milk", 150)],

    # Round 21: SOP replaced the Black Tea Concentrate base entirely with a
    # dedicated Lemon Iced Tea Powder mix; lemon juice and sugar syrup
    # quantities both changed too.
    # Round 28: switched Fresh Lemon Juice -> Fresh Lime Juice on both iced
    # teas and all 5 sodas below (see T-GLT0 above for the same decision).
    "I-LIT": [("Lemon Iced Tea Powder", 22.5, "tbsp"), ("Lime Juice", 5), ("Sugar Syrup", 10), ("Lemon", 8)],
    # Round 21: same base swap; syrup is 1 tbsp mixed in + 1 tbsp garnish on
    # top per the SOP (2 tbsp / 30ml total, both drawn from stock).
    "I-PIT": [("Lemon Iced Tea Powder", 22.5, "tbsp"), ("Passionfruit Syrup", 30), ("Sugar Syrup", 10), ("Lime Juice", 5)],

    "SO-SLS": [("Strawberry Syrup", 35), ("Lime Juice", 15), ("Sugar Syrup", 10), ("Soda Water", 180), ("Lemon", 8)],
    "SO-MPS": [("Mango Syrup", 20), ("Passionfruit Syrup", 15), ("Lime Juice", 5), ("Soda Water", 180)],
    "SO-MBS": [("Mixed Berry Syrup", 35), ("Lime Juice", 10), ("Sugar Syrup", 2), ("Soda Water", 180)],
    "SO-LLS": [("Lychee Syrup", 35), ("Lime Juice", 15), ("Soda Water", 180), ("Lemon", 8)],
    "SO-BHS": [("Blue Curacao Syrup (Non-Alcoholic)", 20), ("Coconut Syrup", 15), ("Lime Juice", 10), ("Soda Water", 170), ("Lemon", 8)],
    # Round 28: revised table raised Pink Salt 0.75g -> 1.25g (1/4 tsp).
    "SO-CRC": [("Cola", 1), ("Lime Juice", 10), ("Pink Salt", 1.25), ("Lemon", 8)],
}

# No-recipe items -- deliberately zero mappings. Empty now that Momo has
# real recipes; kept as a set (not deleted) so the pattern is ready for the
# next item that ships without a recipe.
NO_RECIPE = set()

# sort_order overrides for items inserted into the MIDDLE of MENU_ITEMS after
# production has already been seeded once. The normal (index+1)*10 formula
# below recomputes every item's "logical" position from scratch each time
# this script runs, but on an already-seeded database `insert ... on conflict
# do nothing` only actually inserts the brand-new code -- every other row
# keeps whatever sort_order it was originally migrated with. Without this
# override, a mid-list insertion collides: e.g. adding SO-MBS between SO-MPS
# (already live at 430) and SO-LLS (already live at 440) would compute 440
# for SO-MBS too, tying it with SO-LLS instead of landing between them. List
# the exact value to use here instead of the formula's result; leave
# everything else alone. Safe for a brand-new database too -- it just makes
# that one item's gap to its neighbour uneven (15 instead of 10), which
# doesn't matter since only relative order is ever used.
SORT_ORDER_OVERRIDES = {
    "SO-MBS": 435,  # between SO-MPS (430) and SO-LLS (440)
}


# Round 22: explicit food/hot_drink/cold_drink classification per menu item,
# used for packaging-consumable deduction (see CONSUMABLES above). Computed
# here from category + the existing hot(0)/cold(1) code-suffix convention --
# the exact same rule schema.sql's Round 22 backfill applies to already-live
# rows -- so a brand-new database and a migrated one always agree. Owners can
# still reclassify any individual item later from /admin/menu; this is only
# the starting point.
def packaging_type_for(code, category):
    if category in ("Snacks", "Momo", "Sandwich", "Burger", "Spaghetti"):
        return "food"
    if category in ("Iced Tea", "Soda"):
        return "cold_drink"
    if category in ("Tea", "Coffee"):
        return "hot_drink" if code.endswith("0") else "cold_drink"
    raise ValueError(f"no packaging classification rule for category {category!r} (code {code})")


def sql_str(s):
    return "'" + s.replace("'", "''") + "'"


def num(n):
    if isinstance(n, int):
        return str(n)
    if float(n).is_integer():
        return str(int(n))
    return repr(float(n))


def main():
    out = []
    out.append("-- Cafe Tan90 -- real menu/ingredient/inventory seed data")
    out.append("-- Generated by scripts/gen_seed.py -- do not hand-edit the generated")
    out.append("-- INSERT blocks below; edit the data in that script and regenerate.")
    out.append("--")
    out.append("-- Starting current_stock / low_stock_threshold values are PLACEHOLDER")
    out.append("-- par levels for day one, not a real physical count -- correct them via")
    out.append("-- /admin/inventory once actual stock is counted.")
    out.append("--")
    out.append("-- The following are deliberately absent (no ingredient row at all) --")
    out.append("-- manual par stock, not digitally tracked: " + ", ".join(sorted(EXCLUDED_MANUAL_PAR_STOCK)) + ".")
    out.append("--")
    out.append("-- " + ", ".join(sorted(UNLINKED_VISIBILITY_ONLY)) + " has an ingredient row for")
    out.append("-- manual restock tracking, but is NOT linked to any menu item -- the SOP")
    out.append("-- gives no fixed per-order quantity (\"sufficient to submerge\"), so orders")
    out.append("-- never auto-deduct it. Restock/monitor it directly via /admin/inventory.")
    out.append("")

    out.append("-- Seats: 9 tables (T1-T9), 4 counter seats (S1-S4)")
    out.append("insert into seats (id, label, kind) values")
    out.append(",\n".join(f"  ({sql_str(i)}, {sql_str(l)}, {sql_str(k)})" for i, l, k in SEATS) + "\non conflict (id) do nothing;")
    out.append("")

    out.append("-- Ingredients (" + str(len(PRIMARIES)) + " batch-prep primaries + " + str(len(RAW)) + " raw/purchased ingredients + " + str(len(CONSUMABLES)) + " packaging consumables)")
    out.append("insert into ingredients (name, unit, current_stock, low_stock_threshold, kind) values")
    rows = []
    for name, (unit, stock, thresh) in PRIMARIES.items():
        rows.append(f"  ({sql_str(name)}, {sql_str(unit)}, {num(stock)}, {num(thresh)}, 'batch_prep')")
    for name, (unit, stock, thresh) in RAW.items():
        rows.append(f"  ({sql_str(name)}, {sql_str(unit)}, {num(stock)}, {num(thresh)}, 'raw')")
    for name, (unit, stock, thresh) in CONSUMABLES.items():
        rows.append(f"  ({sql_str(name)}, {sql_str(unit)}, {num(stock)}, {num(thresh)}, 'consumable')")
    out.append(",\n".join(rows) + "\non conflict (name) do nothing;")
    out.append("")

    out.append("-- Menu items (" + str(len(MENU_ITEMS)) + " total, matching the Menu tab item codes/prices).")
    out.append("-- sort_order starts at 10 (never 0 -- 0 is reserved as the 'not yet migrated'")
    out.append("-- sentinel the schema.sql backfill looks for) and steps by 10 in MENU_ITEMS'")
    out.append("-- own order, which is already the Menu PRD's category order (Snacks, Momo,")
    out.append("-- Sandwich, Burger, Spaghetti, Tea, Coffee, Iced Tea, Soda). packaging_type is")
    out.append("-- computed by packaging_type_for() -- see its comment for the rule.")
    out.append("insert into menu_items (code, name, category, price, active, sort_order, packaging_type) values")
    rows = []
    for i, (code, name, cat, price) in enumerate(MENU_ITEMS):
        sort_order = SORT_ORDER_OVERRIDES.get(code, (i + 1) * 10)
        packaging_type = packaging_type_for(code, cat)
        rows.append(f"  ({sql_str(code)}, {sql_str(name)}, {sql_str(cat)}, {num(price)}, true, {sort_order}, {sql_str(packaging_type)})")
    out.append(",\n".join(rows) + "\non conflict (code) do nothing;")
    out.append("")

    out.append("-- Menu item -> ingredient mappings")
    if NO_RECIPE:
        out.append("-- (" + ", ".join(sorted(NO_RECIPE)) + " intentionally have none -- no SOP recipe exists for them yet)")
    else:
        out.append("-- (every active menu item has a recipe as of this generation)")
    for code, _, _, _ in MENU_ITEMS:
        pairs = MAPPINGS.get(code)
        if not pairs:
            continue
        # A pair is (ingredient_name, qty) or, since Round 23, (ingredient_name,
        # qty, unit_label) when the recipe's real deduction unit differs from
        # what should show on screen (e.g. Caramelised Onions/Lemon Iced Tea
        # Powder deduct in g but display as "tbsp" -- see their comments above).
        out.append(f"insert into menu_item_ingredients (menu_item_code, ingredient_id, qty_per_order, unit_label)")
        selects = []
        for pair in pairs:
            iname, qty = pair[0], pair[1]
            unit_label = pair[2] if len(pair) > 2 else None
            label_sql = sql_str(unit_label) if unit_label is not None else "null"
            selects.append(f"select {sql_str(code)}, id, {num(qty)}, {label_sql} from ingredients where name = {sql_str(iname)}")
        out.append("\nunion all\n".join(selects) + "\non conflict (menu_item_code, ingredient_id) do nothing;")
        out.append("")

    out.append("-- Round 23: nested bill-of-materials -- primary -> its own raw-ingredient")
    out.append("-- recipe, scaled to a per-unit ratio (qty / reference batch size) so")
    out.append("-- prep_batch() in schema.sql can scale it to any batch size staff record.")
    for primary_name, (reference_qty, pairs) in PRIMARY_RECIPES.items():
        out.append(f"insert into primary_ingredients (primary_id, raw_ingredient_id, qty_per_unit)")
        selects = [
            f"select p.id, r.id, {num(qty)}::numeric / {num(reference_qty)}\n"
            f"from ingredients p, ingredients r\n"
            f"where p.name = {sql_str(primary_name)} and r.name = {sql_str(raw_name)}"
            for raw_name, qty in pairs
        ]
        out.append("\nunion all\n".join(selects) + "\non conflict (primary_id, raw_ingredient_id) do nothing;")
        out.append("")

    print("\n".join(out))


if __name__ == "__main__":
    # Sanity checks
    assert set(MENU_ITEMS) == set(MENU_ITEMS)
    codes = [c for c, *_ in MENU_ITEMS]
    assert len(codes) == len(set(codes)), "duplicate menu item code"
    for code in MAPPINGS:
        assert code in codes, f"mapping for unknown code {code}"
    for code, *_ in MENU_ITEMS:
        if code not in NO_RECIPE:
            assert code in MAPPINGS, f"missing mapping for {code}"
    for code in NO_RECIPE:
        assert code not in MAPPINGS, f"{code} marked no-recipe but has mappings"
    all_names = set(PRIMARIES) | set(RAW)
    for code, pairs in MAPPINGS.items():
        for pair in pairs:
            iname, qty = pair[0], pair[1]
            assert len(pair) in (2, 3), f"{code} / {iname} has an unexpected tuple shape {pair!r}"
            assert iname in all_names, f"{code} references unknown ingredient {iname!r}"
            assert qty > 0, f"{code} / {iname} has non-positive qty"
    for n in UNLINKED_VISIBILITY_ONLY:
        assert n in RAW, f"{n} not in RAW"
        for code, pairs in MAPPINGS.items():
            assert n not in [p[0] for p in pairs], f"{n} should be unlinked but is used by {code}"
    for code, pairs in MAPPINGS.items():
        for pair in pairs:
            iname = pair[0]
            assert iname not in CONSUMABLES, f"{code} links packaging consumable {iname!r} as a recipe ingredient -- packaging is deducted automatically, never via menu_item_ingredients"

    # Round 23: primary nested-BOM sanity checks.
    all_primary_and_raw_names = set(PRIMARIES) | set(RAW)
    for primary_name, (reference_qty, pairs) in PRIMARY_RECIPES.items():
        assert primary_name in PRIMARIES, f"PRIMARY_RECIPES has an entry for unknown primary {primary_name!r}"
        assert reference_qty > 0, f"{primary_name} has a non-positive reference batch qty"
        for raw_name, qty in pairs:
            assert raw_name in all_primary_and_raw_names, f"{primary_name} references unknown ingredient {raw_name!r}"
            assert raw_name not in CONSUMABLES, f"{primary_name} references packaging consumable {raw_name!r} as a recipe ingredient"
            assert raw_name != primary_name, f"{primary_name} references itself as its own ingredient"
            assert qty > 0, f"{primary_name} / {raw_name} has non-positive qty"
    for code, _name, cat, _price in MENU_ITEMS:
        packaging_type_for(code, cat)  # raises if a code/category has no classification rule
    main()
