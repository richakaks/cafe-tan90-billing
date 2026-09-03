import { describe, expect, it } from "vitest";
import { addDays, daysBetweenInclusive, enumerateDates, weekdayOf } from "./analyticsDates";

describe("addDays", () => {
  it("rolls over a month boundary", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
  });

  it("rolls over a year boundary", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("handles a leap day correctly", () => {
    // 2028 is a leap year.
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
  });

  it("goes backwards for a negative offset", () => {
    expect(addDays("2026-08-01", -1)).toBe("2026-07-31");
  });
});

describe("daysBetweenInclusive", () => {
  it("counts a single day as 1", () => {
    expect(daysBetweenInclusive("2026-07-01", "2026-07-01")).toBe(1);
  });

  it("counts a full month correctly", () => {
    expect(daysBetweenInclusive("2026-07-01", "2026-07-31")).toBe(31);
  });

  it("is negative when to is before from (caller's job to guard against)", () => {
    expect(daysBetweenInclusive("2026-07-10", "2026-07-01")).toBeLessThan(0);
  });
});

describe("weekdayOf", () => {
  it("matches known real dates", () => {
    // 2026-07-01 is a Wednesday.
    expect(weekdayOf("2026-07-01")).toBe(3);
    // 2026-08-31 is a Monday.
    expect(weekdayOf("2026-08-31")).toBe(1);
  });
});

describe("enumerateDates", () => {
  it("lists every date in a short range inclusive", () => {
    expect(enumerateDates("2026-07-01", "2026-07-03")).toEqual(["2026-07-01", "2026-07-02", "2026-07-03"]);
  });

  it("returns a single-element array for a same-day range", () => {
    expect(enumerateDates("2026-07-01", "2026-07-01")).toEqual(["2026-07-01"]);
  });

  it("returns [] for an inverted range", () => {
    expect(enumerateDates("2026-07-10", "2026-07-01")).toEqual([]);
  });

  it("returns [] once the range exceeds the 366-day cap", () => {
    expect(enumerateDates("2026-01-01", "2027-01-02")).toEqual([]); // 367 days
  });

  it("still enumerates a full 366-day range at the cap", () => {
    // 2028 is a leap year, so Jan 1 2028 - Jan 1 2029 is 367 days; use a
    // non-leap span that lands exactly on 366 instead.
    const dates = enumerateDates("2026-01-01", "2027-01-01");
    expect(dates.length).toBe(366);
    expect(dates[0]).toBe("2026-01-01");
    expect(dates[dates.length - 1]).toBe("2027-01-01");
  });
});
