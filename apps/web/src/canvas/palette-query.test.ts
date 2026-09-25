import { describe, expect, it } from "vitest";
import { parseQuery } from "./Palette";
import { categoryLabel, providerLabel, setToken } from "./palette-query";

describe("setToken", () => {
  it("appends a filter to what was typed", () => {
    expect(setToken("queue", "provider", "azure")).toBe("queue provider:azure");
    expect(setToken("", "category", "data")).toBe("category:data");
  });

  it("replaces an existing token, whatever its case, and every duplicate", () => {
    expect(setToken("provider:aws sql Provider:gcp", "provider", "azure")).toBe(
      "sql provider:azure",
    );
  });

  it("removes the token when the value is cleared, leaving the other filters", () => {
    expect(setToken("kind:queue provider:aws  bus", "provider", null)).toBe("kind:queue bus");
    expect(setToken("provider:aws", "provider", "")).toBe("");
  });

  it("round-trips through parseQuery", () => {
    const q = setToken(setToken("event hub", "provider", "azure"), "category", "messaging");
    expect(parseQuery(q)).toEqual({
      filters: { provider: "azure", category: "messaging" },
      words: ["event", "hub"],
    });
  });
});

describe("labels", () => {
  it("prefers the locale's provider name, capitalises an id it does not name", () => {
    const names = { aws: "AWS", k8s: "Kubernetes", default: "Generic" };
    expect(providerLabel("aws", names)).toBe("AWS");
    expect(providerLabel("k8s", names)).toBe("Kubernetes");
    expect(providerLabel("default", names)).toBe("Generic");
    expect(providerLabel("azure", names)).toBe("Azure");
    expect(providerLabel("azure")).toBe("Azure");
  });

  it("prefers the locale's category name", () => {
    expect(categoryLabel("ops", { ops: "Operations" })).toBe("Operations");
    expect(categoryLabel("data")).toBe("Data");
  });
});
