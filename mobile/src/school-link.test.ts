import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSchoolLink, schoolHref } from "./school-link.ts";

describe("school links", () => {
  it("keeps https links on the school hosts", () => {
    const www = parseSchoolLink("https://www.dotheimpossible.ai/home?from=app#office");
    assert.equal(www?.href, "https://www.dotheimpossible.ai/home?from=app#office");
    const apex = parseSchoolLink("https://dotheimpossible.ai/parents");
    assert.equal(apex?.href, "https://www.dotheimpossible.ai/parents");
  });

  it("accepts the app scheme only for the school host", () => {
    const link = parseSchoolLink("vkole://www.dotheimpossible.ai/s/sample-student/");
    assert.equal(link?.path, "/s/sample-student/");
  });

  it("rejects other sites, http, and scheme tricks", () => {
    assert.equal(parseSchoolLink("https://example.com/home"), null);
    assert.equal(parseSchoolLink("http://www.dotheimpossible.ai/home"), null);
    assert.equal(parseSchoolLink("https://www.dotheimpossible.ai.evil.test/home"), null);
    assert.equal(parseSchoolLink("vkole://evil.test/home"), null);
    assert.equal(parseSchoolLink("javascript:alert(1)"), null);
    assert.equal(schoolHref("//evil.test"), null);
  });
});
