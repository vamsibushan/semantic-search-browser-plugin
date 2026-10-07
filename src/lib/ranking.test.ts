import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cosineSimilarity,
  weightedScore,
  recencyBoost,
  FIELD_WEIGHTS,
} from "./ranking.ts";

test("cosineSimilarity of identical vectors is 1", () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
});

test("cosineSimilarity of orthogonal vectors is 0", () => {
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
});

test("cosineSimilarity handles different lengths", () => {
  assert.equal(cosineSimilarity([1, 0, 0], [1, 0]), 1);
});

test("field weights sum to 1", () => {
  const { title, url, content } = FIELD_WEIGHTS;
  assert.ok(Math.abs(title + url + content - 1) < 1e-9);
});

test("weightedScore favors the title field", () => {
  const q = [1, 0];
  const fields = { title: [1, 0], url: [0, 1], content: [0, 1] };
  assert.equal(weightedScore(q, fields), FIELD_WEIGHTS.title);
});

test("weightedScore blends all fields", () => {
  const q = [1, 0];
  const fields = { title: [1, 0], url: [1, 0], content: [1, 0] };
  assert.equal(weightedScore(q, fields), 1);
});

test("recencyBoost decays with age", () => {
  const now = 1_000_000;
  assert.equal(recencyBoost(now - 60_000, now), 0.08);
  assert.equal(recencyBoost(now - 30 * 60_000, now), 0.04);
  assert.equal(recencyBoost(now - 2 * 60 * 60_000, now), 0);
});

test("recencyBoost is 0 for tabs never activated", () => {
  const now = Date.now();
  assert.equal(recencyBoost(0, now), 0);
});
