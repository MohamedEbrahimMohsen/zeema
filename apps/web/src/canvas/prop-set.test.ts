import { describe, expect, it } from "vitest";
import { commonProps, type PropDef, propValue } from "./prop-set";

const queue: Record<string, PropDef> = {
  deadLetterQueue: { type: "boolean" },
  ordering: { type: "enum", values: ["fifo", "none"] },
  retentionDays: { type: "integer" },
};
const topic: Record<string, PropDef> = {
  deadLetterQueue: { type: "boolean" },
  ordering: { type: "enum", values: ["none", "fifo"] },
  retentionDays: { type: "string" },
  partitions: { type: "integer" },
};

describe("commonProps", () => {
  it("one kind: all of its properties, in order", () => {
    expect(commonProps([queue, queue]).map(([n]) => n)).toEqual(Object.keys(queue));
  });
  it("two kinds: only ids declared by both with the same type and enum value set", () => {
    expect(commonProps([queue, topic]).map(([n]) => n)).toEqual(["deadLetterQueue", "ordering"]);
  });
  it("an enum with a different value set is not common", () => {
    const other = { ...queue, ordering: { type: "enum", values: ["fifo", "none", "strict"] } };
    expect(commonProps([queue, other]).map(([n]) => n)).toEqual([
      "deadLetterQueue",
      "retentionDays",
    ]);
  });
  it("no overlap, or nothing given: empty", () => {
    expect(commonProps([queue, { size: { type: "integer" } }])).toEqual([]);
    expect(commonProps([])).toEqual([]);
  });
});

describe("propValue", () => {
  it("a shared value shows", () => {
    expect(propValue([true, true], [true, true])).toEqual({
      value: true,
      resolved: true,
      mixed: false,
    });
  });
  it("all unset with one default: unset, showing that default", () => {
    expect(propValue([undefined, undefined], [7, 7])).toEqual({
      value: undefined,
      resolved: 7,
      mixed: false,
    });
  });
  it("different own values, or different fallbacks: mixed", () => {
    expect(propValue([true, false], [true, false]).mixed).toBe(true);
    expect(propValue([true, undefined], [true, true]).mixed).toBe(true);
    expect(propValue([undefined, undefined], [1, 2])).toEqual({
      value: undefined,
      resolved: undefined,
      mixed: true,
    });
  });
});
