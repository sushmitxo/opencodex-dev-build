#!/usr/bin/env node
/**
 * patch-deepseek-reasoning.mjs
 *
 * Applied by the build workflow to the upstream `dev` checkout BEFORE packing.
 *
 * Backport of lidge-jun/opencodex PR #1205 / issue #1193 (via gdxnpy's verified
 * two-hunk workaround comment): when the bounded reasoning-replay cache
 * (`src/responses/reasoning-replay-cache.ts`, 64 entries / 256 KiB / 1h TTL)
 * misses on a long session, `src/adapters/openai-chat.ts` used to emit an
 * assistant `tool_call` continuation WITHOUT `reasoning_content`, which DeepSeek
 * thinking mode rejects with HTTP 400:
 *
 *   [invalid_request_error] The `reasoning_content` in the thinking mode must be
 *   passed back to the API.
 *
 * This patch injects a minimal placeholder (`" "`) in BOTH affected paths (main
 * assistant-history path and orphan-repair path) whenever the cache lookup is
 * empty, but ONLY for models in `preserveReasoningContentModels`. Verified A/B
 * upstream: same conversation shape missing `reasoning_content` -> 400, with
 * the placeholder -> 200.
 *
 * If upstream dev ever refactors either anchor, the build FAILS LOUDLY rather
 * than shipping an unpatched build. Update the anchors here and re-commit.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const target = "src/adapters/openai-chat.ts";

if (!existsSync(target)) {
  console.error(`PATCH FAILED: ${target} not found (wrong working directory?)`);
  process.exit(1);
}

const src = readFileSync(target, "utf8");

// --- Hunk 1: main assistant-history path, cache miss fallback ---
const hunk1Anchor = [
  `          if (cached.length > 0) {`,
  `            reasoningContent = [...new Set(cached)].join("\\n");`,
  `          }`,
].join("\n");

const hunk1Replacement = [
  `          if (cached.length > 0) {`,
  `            reasoningContent = [...new Set(cached)].join("\\n");`,
  `          } else {`,
  `            // Fallback (extends #950): the replay cache is bounded (64 entries /`,
  `            // 256KB / 1h TTL) and can always miss on long sessions, and some`,
  `            // tool rounds carry no recorded reasoning at all. DeepSeek thinking`,
  `            // mode 400s on ANY tool_call assistant message missing`,
  `            // reasoning_content, so inject a minimal placeholder rather than`,
  `            // emit a bare continuation that the upstream will reject.`,
  `            reasoningContent = " ";`,
  `          }`,
].join("\n");

// --- Hunk 2: orphan-repair path, cache miss fallback ---
const hunk2Anchor = [
  `          out.push({`,
  `            role: "assistant",`,
  `            content: emptyAssistantContent(provider),`,
  `            ...(cachedReasoning ? { reasoning_content: cachedReasoning } : {}),`,
].join("\n");

const hunk2Replacement = [
  `          // Same fallback as the main-assistant path: never emit a bare orphan`,
  `          // tool_call continuation on a thinking-mode provider — inject a`,
  `          // placeholder when the replay cache missed (bounded cache can always`,
  `          // miss on long sessions), or DeepSeek thinking mode 400s.`,
  `          const orphanReasoning =`,
  `            cachedReasoning`,
  `            ?? (modelInList(provider.preserveReasoningContentModels, parsed.modelId) ? " " : undefined);`,
  `          out.push({`,
  `            role: "assistant",`,
  `            content: emptyAssistantContent(provider),`,
  `            ...(orphanReasoning ? { reasoning_content: orphanReasoning } : {}),`,
].join("\n");

if (!src.includes(hunk1Anchor)) {
  console.error(
    `PATCH FAILED: hunk1 anchor not found in ${target}.` +
      `\nUpstream dev likely refactored the main assistant-history path. ` +
      `Fix patch-deepseek-reasoning.mjs before rebuilding.`
  );
  process.exit(1);
}

const afterHunk1 = src.replace(hunk1Anchor, hunk1Replacement);

if (!afterHunk1.includes(hunk2Anchor)) {
  console.error(
    `PATCH FAILED: hunk2 anchor not found in ${target}.` +
      `\nUpstream dev likely refactored the orphan-repair path. ` +
      `Fix patch-deepseek-reasoning.mjs before rebuilding.`
  );
  process.exit(1);
}

writeFileSync(target, afterHunk1.replace(hunk2Anchor, hunk2Replacement));
console.log(`DeepSeek reasoning placeholder backport applied to ${target}`);