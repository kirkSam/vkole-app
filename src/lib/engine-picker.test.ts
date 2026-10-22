import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { SUBJECTS } from "./climb-rules.ts";
import {
  ENGINE_PICKER_ROUTE,
  isEnginePickerSearch,
  openEnginePicker,
  takeHeldSitting,
} from "./engine-picker.ts";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("engine picker", () => {
  it("opens /?open=1 and keeps the sitting so no parent email is sent", () => {
    assert.equal(takeHeldSitting(), false);
    const urls: string[] = [];
    openEnginePicker((url) => urls.push(url));
    assert.deepEqual(urls, ["/?open=1"]);
    assert.equal(ENGINE_PICKER_ROUTE, "/?open=1");
    assert.equal(takeHeldSitting(), true);
    assert.equal(takeHeldSitting(), false);
    assert.equal(isEnginePickerSearch("?open=1"), true);
    assert.equal(isEnginePickerSearch(""), false);
    assert.equal(isEnginePickerSearch("?new=1"), false);
    const picker = source("./engine-picker.ts");
    assert.equal(picker.includes("endChildSession"), false);
    assert.equal(picker.includes("parentProgressMail"), false);
  });

  it("uses one Other engines control and one Finished control for all eight engines", () => {
    assert.deepEqual(
      SUBJECTS.map((subject) => subject.id),
      ["m", "ela", "ss", "gen", "sg", "sw", "sp", "pa"],
    );
    const session = source("../routes/session.$id.tsx");
    assert.equal(session.split("Other engines").length - 1, 2);
    assert.equal(session.split("openEnginePicker()").length - 1, 2);
    assert.equal(session.includes('onClick={() => finishRef.current("finished")}'), true);
    assert.equal(session.includes('finishRef.current("logout", true)'), true);
    assert.equal(session.includes('void navigate({ to: "/" })'), true);
    const guard = session.indexOf("if (closing.current || takeHeldSitting()) return;");
    const timer = session.indexOf('window.setTimeout(() => finish("logout"), 500)');
    assert.equal(guard > 0 && guard < timer, true);
    const finishedAt = session.indexOf('onClick={() => finishRef.current("finished")}');
    const otherAt = session.indexOf("onClick={() => openEnginePicker()}", finishedAt);
    assert.equal(finishedAt > 0 && otherAt > finishedAt, true);
    const beside = session.slice(finishedAt, otherAt);
    assert.equal(beside.includes("endChildSession"), false);
    assert.equal(beside.includes('finish("logout")'), false);
    for (const path of [
      "../components/phonemic-stage.tsx",
      "../components/sight-word-stage.tsx",
      "../components/spelling-stage.tsx",
    ]) {
      assert.equal(source(path).includes("Other engines"), false, path);
      assert.equal(source(path).includes("openEnginePicker"), false, path);
    }
  });

  it("shows the engine list for that query and keeps a bare home visit on the splash", () => {
    const home = source("../routes/index.tsx");
    assert.equal(home.includes('useState<"splash" | "teletype" | "app" | "trial">("splash")'), true);
    assert.equal(home.includes("isEnginePickerSearch(window.location.search)"), true);
    assert.equal(home.includes('setStage("app")'), true);
    assert.equal(home.includes("<EnginePicks />"), true);
    const login = source("../components/parent-login.tsx");
    assert.equal(login.includes("window.location.assign(ENGINE_PICKER_ROUTE)"), true);
    assert.equal(login.includes('"/?open=1"'), false);
  });
});
