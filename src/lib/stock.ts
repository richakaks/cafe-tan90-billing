import type { AvailabilityStatus, Ingredient, MenuItemIngredientLink } from "./types";

/**
 * Pure, unit-testable stock logic — no database access.
 *
 * For a given menu item, "makeable count" is the largest number of that item
 * you could sell right now, given every linked ingredient's current stock:
 * the minimum, across its ingredients, of floor(stock / qty needed per order).
 *
 *  - makeable count 0            -> "out_of_stock" (blocked on the menu)
 *  - makeable count > 0 but any
 *    linked ingredient is below
 *    its own low-stock threshold -> "low_stock" (still orderable, badged)
 *  - otherwise                   -> "in_stock"
 *
 * An item with no tracked ingredients is always "in_stock" (nothing to run out of).
 */
export function computeAvailability(
  menuItemCode: string,
  links: MenuItemIngredientLink[],
  ingredientsById: Map<string, Ingredient>
): AvailabilityStatus {
  const itemLinks = links.filter((link) => link.menuItemCode === menuItemCode);
  if (itemLinks.length === 0) return "in_stock";

  let makeable = Infinity;
  let anyLow = false;

  for (const link of itemLinks) {
    const ingredient = ingredientsById.get(link.ingredientId);
    if (!ingredient) continue; // dangling mapping — ignore rather than block the item

    const possible = Math.floor(ingredient.currentStock / link.qtyPerOrder);
    makeable = Math.min(makeable, possible);

    if (ingredient.currentStock < ingredient.lowStockThreshold) {
      anyLow = true;
    }
  }

  if (makeable === Infinity) return "in_stock";
  if (makeable < 1) return "out_of_stock";
  return anyLow ? "low_stock" : "in_stock";
}

/**
 * Ingredient-level (not menu-item-level) status, used by the inventory admin
 * table, the low-stock banner, and the staff-wide alert popup — kept as one
 * pure function so all three agree on what counts as "low"/"out".
 */
export function ingredientAlertStatus(
  ingredient: Pick<Ingredient, "currentStock" | "lowStockThreshold">
): "out_of_stock" | "low_stock" | null {
  if (ingredient.currentStock <= 0) return "out_of_stock";
  if (ingredient.currentStock < ingredient.lowStockThreshold) return "low_stock";
  return null;
}
