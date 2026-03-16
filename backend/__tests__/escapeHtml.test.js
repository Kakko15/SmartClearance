const { escapeHtml } = require("../utils/escapeHtml");

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  it("escapes less-than sign", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes greater-than sign", () => {
    expect(escapeHtml("a > b")).toBe("a &gt; b");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("escapes all special characters together", () => {
    expect(escapeHtml(`<div class="a">'&'</div>`)).toBe(
      "&lt;div class=&quot;a&quot;&gt;&#39;&amp;&#39;&lt;/div&gt;",
    );
  });

  it("returns empty string for non-string input", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(123)).toBe("");
    expect(escapeHtml({})).toBe("");
  });

  it("returns unchanged string when no special characters", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });
});
