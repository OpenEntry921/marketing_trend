import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import {
  candidateCsv,
  expand,
  initialState,
  normalizeUrl,
  parseSeries,
  profit,
  saleResult,
  validateBackup,
} from "./domain";
import { load, save } from "./store";
describe("business calculations", () => {
  it("allocates shipment and selling costs while excluding recoverable VAT", () => {
    const f = {
      purchase: "10",
      exchange: "1300",
      quantity: "100",
      freight: "100000",
      insurance: "10000",
      customs: "20000",
      other: "20000",
      price: "25000",
      fee: "10",
      delivery: "3000",
      ads: "1000",
      returns: "500",
      recoverable: "900000",
    };
    expect(profit(f)).toMatchObject({ cost: 14500, selling: 7000, gain: 3500 });
    expect(profit(f)?.margin).toBeCloseTo(14);
    expect(profit({ ...f, quantity: "0" })).toBeNull();
    expect(profit({ ...f, ads: "" })).toBeNull();
    expect(profit({ ...f, fee: "101" })).toBeNull();
    expect(profit({ ...f, price: "0" })?.margin).toBeNull();
  });
  it("does not fabricate conversion or complete profit from missing values", () => {
    expect(saleResult({ visits: "0", orders: "2" })).toMatchObject({
      conversion: null,
      provisional: true,
    });
    expect(
      saleResult({
        visits: "100",
        orders: "5",
        revenue: "10000",
        adCost: "1000",
        refund: "0",
        otherCost: "500",
        goodsCost: "5000",
      }),
    ).toEqual({ conversion: 5, provisional: false, gain: 3500 });
  });
});
describe("data boundaries", () => {
  it("rejects malformed backups and orphaned records", () => {
    const s = initialState();
    expect(validateBackup(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(() => validateBackup({ ...s, version: 99 })).toThrow();
    expect(() =>
      validateBackup({
        ...s,
        contents: [{ ...s.contents[0], candidateId: "missing" }],
      }),
    ).toThrow();
    expect(() =>
      validateBackup({ ...s, candidates: [...s.candidates, s.candidates[0]] }),
    ).toThrow();
    expect(() =>
      validateBackup({ ...s, contents: [{ ...s.contents[0], mode: "user" }] }),
    ).toThrow();
  });
  it("parses only the documented CSV format", () => {
    expect(parseSeries("date,value\n2026-01-02,30\n2026-01-01,2")).toEqual([
      { date: "2026-01-01", value: 2 },
      { date: "2026-01-02", value: 30 },
    ]);
    for (const text of [
      "日,值\n2026-01-01,2",
      "date,value\n2026-02-30,3",
      "date,value\n2026-01-01,",
      "date,value\n2026-01-01,-1",
    ])
      expect(() => parseSeries(text)).toThrow();
  });
  it("normalizes tracking parameters, preserves meaningful IDs, rejects scripts", () => {
    expect(
      normalizeUrl("https://www.youtube.com/watch?v=abc&utm_source=x#top"),
    ).toBe(normalizeUrl("https://youtube.com/watch?v=abc"));
    expect(normalizeUrl("https://youtube.com/watch?v=abc")).not.toBe(
      normalizeUrl("https://youtube.com/watch?v=def"),
    );
    expect(normalizeUrl("javascript:alert(1)")).toBe("");
  });
  it("returns no unrelated dictionary expansion", () => {
    expect(expand("이름모를신제품")).toEqual([]);
    expect(expand("친환경 주방세제")).toContain("dish soap concentrate");
  });
  it("escapes CSV formulas and quotes", () => {
    const s = initialState();
    s.candidates[0].fields.name = "=1+1";
    expect(candidateCsv(s.candidates)).toContain('"\'=1+1"');
  });
  it("persists demo deletion and user work across loads", async () => {
    const s = initialState();
    s.candidates.push({
      id: "real",
      mode: "user",
      fields: { name: "실제 후보" },
    });
    s.candidates = s.candidates.filter((c) => c.mode === "user");
    s.contents = [];
    s.observations = [];
    s.demoDeleted = true;
    await save(s);
    expect(await load()).toEqual(s);
  });
});
