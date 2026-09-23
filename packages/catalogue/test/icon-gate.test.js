// The markup gate every inlined icon passes (components, kinds and provider marks alike).
import { describe, expect, it } from "vitest";
import { UNSAFE_SVG } from "../src/validate.js";

describe("icon markup gate", () => {
  it.each([
    "<svg><script>alert(1)</script></svg>",
    '<svg><g onload="fetch(1)"/></svg>',
    '<svg><g onclick = "x()"/></svg>',
    '<svg><a href="https://evil.example"><path/></a></svg>',
    '<svg><use xlink:href="#x"/></svg>',
    '<svg><image src="x"/></svg>',
    "<svg><foreignObject><div/></foreignObject></svg>",
    '<svg><path fill="url(data:image/svg+xml;base64,AAAA)"/></svg>',
    '<svg><a target="javascript:alert(1)"/></svg>',
  ])("refuses %s", (svg) => {
    expect(UNSAFE_SVG.test(svg)).toBe(true);
  });

  it("accepts plain shapes", () => {
    expect(
      UNSAFE_SVG.test(
        '<svg viewBox="0 0 24 24"><path d="M1 1h22" stroke="currentColor"/><circle cx="12" cy="12" r="3"/></svg>',
      ),
    ).toBe(false);
  });
});
