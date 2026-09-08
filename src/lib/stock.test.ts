import { describe, expect, it } from "vitest";
import { computeAvailability } from "./stock";
import type { Ingredient, MenuItemIngredientLink } from "./types";

function ingredient(overrides: Partial<Ingredient> & { id: string }): Ingredient {
  return {
    name: overrides.id,
    brand: null,
    unit: "g",
    currentStock: 0,
    lowStockThreshold: 0,
    kind: "raw",
    ...overrides,
  };
}

// unitLabel is a Round 22 display-only field computeAvailability never reads
// -- defaulted to null here so every test fixture below doesn't need to spell
// it out.
function link(overrides: Omit<MenuItemIngredientLink, "unitLabel">): MenuItemIngredientLink {
  return { unitLabel: null, ...overrides };
}

describe("computeAvailability", () => {
  it("is in_stock when there are no linked ingredients", () => {
    expect(computeAvailability("CT999", [], new Map())).toBe("in_stock");
  });

  it("is in_stock when every linked ingredient has plenty of stock", () => {
    const links: MenuItemIngredientLink[] = [link({ menuItemCode: "CT001", ingredientId: "beans", qtyPerOrder: 18 })];
    const byId = new Map([["beans", ingredient({ id: "beans", currentStock: 2000, lowStockThreshold: 300 })]]);
    expect(computeAvailability("CT001", links, byId)).toBe("in_stock");
  });

  it("is low_stock when an ingredient is below its threshold but still makeable", () => {
    const links: MenuItemIngredientLink[] = [link({ menuItemCode: "CT004", ingredientId: "dough", qtyPerOrder: 1 })];
    const byId = new Map([["dough", ingredient({ id: "dough", currentStock: 4, lowStockThreshold: 5 })]]);
    expect(computeAvailability("CT004", links, byId)).toBe("low_stock");
  });

  it("is out_of_stock when makeable count is zero for any ingredient", () => {
    const links: MenuItemIngredientLink[] = [
      link({ menuItemCode: "CT002", ingredientId: "beans", qtyPerOrder: 18 }),
      link({ menuItemCode: "CT002", ingredientId: "milk", qtyPerOrder: 150 }),
    ];
    const byId = new Map([
      ["beans", ingredient({ id: "beans", currentStock: 2000, lowStockThreshold: 300 })],
      ["milk", ingredient({ id: "milk", currentStock: 100, lowStockThreshold: 500 })], // < 150 needed
    ]);
    expect(computeAvailability("CT002", links, byId)).toBe("out_of_stock");
  });

  it("takes the most constrained ingredient across multiple links", () => {
    const links: MenuItemIngredientLink[] = [
      link({ menuItemCode: "CT005", ingredientId: "bread", qtyPerOrder: 2 }),
      link({ menuItemCode: "CT005", ingredientId: "ham", qtyPerOrder: 60 }),
    ];
    const byId = new Map([
      ["bread", ingredient({ id: "bread", currentStock: 30, lowStockThreshold: 6 })], // makeable 15
      ["ham", ingredient({ id: "ham", currentStock: 120, lowStockThreshold: 200 })], // makeable 2, and low
    ]);
    // Ham constrains makeable count to 2 (>0) and is below its threshold -> low_stock, not out.
    expect(computeAvailability("CT005", links, byId)).toBe("low_stock");
  });

  it("ignores dangling ingredient links (missing from the ingredients map)", () => {
    const links: MenuItemIngredientLink[] = [link({ menuItemCode: "CT001", ingredientId: "ghost", qtyPerOrder: 1 })];
    expect(computeAvailability("CT001", links, new Map())).toBe("in_stock");
  });
});
