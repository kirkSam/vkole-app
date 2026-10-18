import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  ZPD_INFO_PATH,
  ZPD_INFO_SOURCE,
  ZPD_RETURN_FLAG,
  markZpdReturn,
  takeZpdReturn,
  zpdInfo,
  zpdInfoText,
  zpdReturnPlan,
} from "./zpd-info.ts";

function memoryStore() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.has(key) ? values.get(key)! : null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

describe("in-app zone of proximal development page", () => {
  it("registers the route the Vygotsky ZPD link opens", () => {
    const route = readFileSync(new URL("../routes/zpd.tsx", import.meta.url), "utf8");
    const shell = readFileSync(new URL("../components/shell.tsx", import.meta.url), "utf8");
    assert.equal(ZPD_INFO_PATH, "/zpd");
    assert.equal(ZPD_INFO_SOURCE, "https://www.dotheimpossible.ai/zpd");
    assert.match(route, /createFileRoute\("\/zpd"\)/);
    assert.match(route, /className="zpd-return"/);
    assert.match(route, /\bReturn\b/);
    assert.doesNotMatch(route, /dotheimpossible\.ai/);
    assert.doesNotMatch(route, /Online School Menu/);
    assert.match(shell, /to="\/zpd"/);
    assert.match(shell, /Vygotsky ZPD/);
    assert.match(shell, /Zone of Proximal Development/);
    assert.doesNotMatch(shell, /dotheimpossible\.ai\/zpd/);
  });

  it("shows the app document, not the website shelves", () => {
    const text = zpdInfoText();
    assert.equal(
      zpdInfo.title,
      "Vygotsky's Zone of Proximal Development: Amplified by VKOLE/ZPD - Space XSI Integrated Learning Engine.",
    );
    assert.match(text, /From that starting point the VKOLE ZPD Online Learning Engine, in conjunction with Space XSI super-intelligence calibrates/);
    assert.match(text, /measured against demonstrated grade levels on the Common Core Curriculum/);
    assert.match(text, /integral to all learning and is the key to measurable learning growth/);
    assert.doesNotMatch(text, /Baseline\/Growth Test/);
    assert.doesNotMatch(text, /Put the cookies within reach/);
    assert.doesNotMatch(text, /How this academy uses the zone/);
    assert.doesNotMatch(text, /Online School Menu/);
  });

  it("returns through app history, and home when the page was opened directly", () => {
    assert.equal(zpdReturnPlan({ canGoBack: () => true }), "back");
    assert.equal(zpdReturnPlan({ canGoBack: () => false }), "home");
    assert.equal(zpdReturnPlan({}), "home");
  });

  it("remembers a return to the home screen only", () => {
    const storage = memoryStore();
    markZpdReturn("/session/1", storage);
    assert.equal(storage.getItem(ZPD_RETURN_FLAG), null);
    markZpdReturn("/", storage);
    assert.equal(takeZpdReturn(storage), true);
    assert.equal(takeZpdReturn(storage), false);
  });
});
