#!/usr/bin/env node
/**
 * patch-windows-sync.mjs
 *
 * Applied by the build workflow to the upstream `dev` checkout BEFORE packing.
 *
 * Author: sushmitxo/opencodex-dev-build
 *
 * Why: on Windows, the Codex model-catalog sync write (`ocx sync` / GUI) is
 * gated by a service-home ownership probe. If the probe cannot prove the
 * install is locally owned it returns `unknown` and the write is REFUSED
 * ("ownership could not be proven"). Historically `inspectWindows()`
 * (`src/service-manager-probe.ts`) was an unimplemented stub, so sync always
 * failed on Windows. Upstream has since implemented a real Windows definition
 * chain walk, but a probe that still returns `unknown` (older installed
 * scheduler wrapper, a backend it cannot read, an interrupted reinstall) would
 * silently block sync again.
 *
 * This patch is a narrow, fail-closed safety net for that residual case: on
 * Windows, when there is AT LEAST ONE valid service-state file that already
 * names the current homes (foreign / malformed / disagreeing state is rejected
 * earlier), it treats the install as owned. Everywhere else, and whenever state
 * is missing/invalid, it still refuses.
 *
 * The anchor targets ONLY the stable `if (manager.kind === "unknown")` block
 * (not the `const manager = inspectServiceManagerInstallation(...)` call above
 * it, which upstream keeps reshaping). If even this block is refactored the
 * build FAILS LOUDLY rather than shipping an unpatched build.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const target = "src/integrations/native/ownership-preflight.ts";

if (!existsSync(target)) {
  console.error(`PATCH FAILED: ${target} not found (wrong working directory?)`);
  process.exit(1);
}

const src = readFileSync(target, "utf8");

const anchor = [
  `  if (manager.kind === "unknown") {`,
  `    return { ownership: "unknown", reason: manager.reason };`,
  `  }`,
].join("\n");

const replacement = [
  `  if (manager.kind === "unknown") {`,
  `    // Windows safety net: the service-manager probe may still report`,
  `    // \`unknown\` (an older installed scheduler wrapper its chain walk cannot`,
  `    // read, a backend it cannot inspect, or an interrupted reinstall). A`,
  `    // VALID service-state file that already names these homes (any foreign /`,
  `    // malformed / disagreeing state refused above) is sufficient local-`,
  `    // ownership evidence for a scheduler install; without one we still fail`,
  `    // closed, because a home with no service state cannot be matched against`,
  `    // a manager claim.`,
  `    if ((deps.platform ?? process.platform) === "win32" && valid.length > 0) {`,
  `      return {`,
  `        ownership: "owned",`,
  `        reason: "the service state names these homes (Windows scheduler install)",`,
  `      };`,
  `    }`,
  `    return { ownership: "unknown", reason: manager.reason };`,
  `  }`,
].join("\n");

if (!src.includes(anchor)) {
  console.error(
    `PATCH FAILED: anchor block not found in ${target}.` +
      `\nUpstream dev likely refactored this code. ` +
      `Fix patch-windows-sync.mjs before rebuilding.`
  );
  process.exit(1);
}

writeFileSync(target, src.replace(anchor, replacement));
console.log(`Windows sync ownership patch applied to ${target}`);