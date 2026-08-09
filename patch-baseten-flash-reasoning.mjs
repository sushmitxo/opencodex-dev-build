#!/usr/bin/env node
/**
 * patch-baseten-flash-reasoning.mjs
 *
 * Applied by the build workflow to the upstream `dev` checkout BEFORE packing.
 *
 * Upstream gap: the Baseten registry preset (`src/providers/registry.ts`)
 * lists reasoning efforts for `deepseek-ai/DeepSeek-V4-Pro` and other models,
 * but NOT for `deepseek-ai/DeepSeek-V4-Flash-0731`. Baseten's official docs
 * (https://docs.baseten.co/inference/model-apis/reasoning) list
 * `deepseek-ai/DeepSeek-V4-Flash-0731` as reasoning-enabled by default with the
 * same depth ladder, so the model inherits the empty provider ladder
 * (`reasoningEfforts: []`) and Codex shows no effort selector for it.
 *
 * This patch adds the flash model to the preset's reasoning-effort maps using
 * the exact same values as DeepSeek-V4-Pro (full ladder low..max) plus the
 * documented default `high`.
 *
 * Anchors are deliberately tiny and specific; if upstream refactors them the
 * build FAILS LOUDLY instead of shipping an unpatched build.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const target = "src/providers/registry.ts";

if (!existsSync(target)) {
  console.error(`PATCH FAILED: ${target} not found (wrong working directory?)`);
  process.exit(1);
}

const src = readFileSync(target, "utf8");

const hunks = [
  {
    name: "BASETEN_MODEL_REASONING_EFFORTS",
    old: `  "deepseek-ai/DeepSeek-V4-Pro": BASETEN_FULL_REASONING_EFFORTS,`,
    new: `  "deepseek-ai/DeepSeek-V4-Pro": BASETEN_FULL_REASONING_EFFORTS,\n  "deepseek-ai/DeepSeek-V4-Flash-0731": BASETEN_FULL_REASONING_EFFORTS,`,
  },
  {
    name: "BASETEN_MODEL_REASONING_EFFORT_MAP",
    old: `  "deepseek-ai/DeepSeek-V4-Pro": { none: "none", minimal: "minimal" },`,
    new: `  "deepseek-ai/DeepSeek-V4-Pro": { none: "none", minimal: "minimal" },\n  "deepseek-ai/DeepSeek-V4-Flash-0731": { none: "none", minimal: "minimal" },`,
  },
  {
    name: "BASETEN_MODEL_DEFAULT_REASONING_EFFORTS",
    old: `  "deepseek-ai/DeepSeek-V4-Pro": "medium",`,
    new: `  "deepseek-ai/DeepSeek-V4-Pro": "medium",\n  "deepseek-ai/DeepSeek-V4-Flash-0731": "high",`,
  },
];

let out = src;
for (const hunk of hunks) {
  if (!out.includes(hunk.old)) {
    console.error(
      `PATCH FAILED: ${hunk.name} anchor not found in ${target}.` +
        `\nUpstream dev likely refactored the Baseten preset. ` +
        `Fix patch-baseten-flash-reasoning.mjs before rebuilding.`
    );
    process.exit(1);
  }
  out = out.replace(hunk.old, hunk.new);
}

writeFileSync(target, out);
console.log(`Baseten DeepSeek-V4-Flash-0731 reasoning effort patch applied to ${target}`);