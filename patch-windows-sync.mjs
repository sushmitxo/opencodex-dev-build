#!/usr/bin/env node
/**
 * patch-windows-sync.mjs
 *
 * Applied by the build workflow to the upstream `dev` checkout BEFORE packing.
 *
 * Author: sushmitxo/opencodex-dev-build
 *
 * Why: on Windows, `src/codex/admission.ts` refuse Codex model-catalog sync
 * because the service-manager ownership probe in
 * `src/service-manager-probe.ts` (`inspectWindows`) is still an unimplemented
 * stub that reports `unknown` ("the Windows definition chain is not inspected
 * yet"). A normally-installed Windows scheduler service with a valid
 * `service-state.json` naming the current homes therefore can never pass the
 * gate, so `ocx sync` always fails on Windows.
 *
 * This patch narrows the relaxation: on Windows, when there is AT LEAST ONE
 * valid service-state file that already names the current homes (foreign /
 * malformed / disagreeing state is rejected earlier), it treats the install as
 * owned. Everywhere else, and whenever state is missing/invalid, it still
 * fails closed.
 *
 * If upstream dev ever refactors this block, the anchor below will not match
 * and the build will FAIL LOUDLY (never silently ship an unpatched build).
 * Update the anchor + replacement here and re-commit.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const target = "src/integrations/native/ownership-preflight.ts";

if (!existsSync(target)) {
  console.error(`PATCH FAILED: ${target} not found (wrong working directory?)`);
  process.exit(1);
}

const src = readFileSync(target, "utf8");

const anchor = [
  `  const manager = inspectServiceManagerInstallation(deps);`,
  `  if (manager.kind === "unknown") {`,
  `    return { ownership: "unknown", reason: manager.reason };`,
  `  }`,
].join("\n");

const replacement = [
  `  const manager = inspectServiceManagerInstallation(deps);`,
  `  if (manager.kind === "unknown") {`,
  `    // Windows's service-manager definition-chain walk is not implemented yet`,
  `    // (service-manager-probe.ts \`inspectWindows\`), so a normally-installed`,
  `    // scheduler service reports \`unknown\` here. A VALID service-state file that`,
  `    // already names these homes (any foreign/malformed/disagreeing state refused`,
  `    // above) is sufficient local-ownership evidence for that install; without`,
  `    // one we still fail closed, because a home with no service state cannot be`,
  `    // matched against a manager claim.`,
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