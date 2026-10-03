/**
 * Re-packs the uTrace SDK tarballs into `vendor/`.
 *
 * The demo's distribution shortcut: a template image build of this repository has no
 * access to the uTrace monorepo, so the two SDKs and the contract package are
 * committed here as `npm pack` tarballs and installed with `file:`
 * dependencies. A real client installs published packages instead, which is why
 * nothing else in this repository knows where the monorepo is.
 *
 * Usage: `npm run utrace:vendor -- --monorepo /path/to/uTrace`
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PACKAGES: readonly string[] = [
  "packages/utrace-browser-sdk",
  "packages/utrace-server-sdk",
  "packages/utrace-contracts/typescript",
];

function readMonorepoRoot(argv: readonly string[]): string {
  const flag = argv.indexOf("--monorepo");
  const value = flag === -1 ? undefined : argv[flag + 1];
  if (value === undefined) {
    throw new Error(
      "usage: npm run utrace:vendor -- --monorepo /path/to/uTrace (the uTrace checkout to pack from)",
    );
  }
  const root = resolve(value);
  if (!existsSync(resolve(root, "packages/utrace-browser-sdk/package.json"))) {
    throw new Error(`${root} is not a uTrace checkout: packages/utrace-browser-sdk is missing.`);
  }
  return root;
}

function run(command: string, args: readonly string[], cwd: string): void {
  const result = spawnSync(command, [...args], { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed in ${cwd} with status ${String(result.status)}`,
    );
  }
}

const monorepo = readMonorepoRoot(process.argv.slice(2));
const destination = resolve(import.meta.dirname, "../../vendor");

for (const relative of PACKAGES) {
  const directory = resolve(monorepo, relative);
  // The tarballs carry built output, so each package builds before it is packed.
  if (relative !== "packages/utrace-contracts/typescript") {
    run("npm", ["run", "build"], directory);
  }
  run("npm", ["pack", "--pack-destination", destination], directory);
}

process.stdout.write(`utrace:vendor: packed ${String(PACKAGES.length)} package(s) into vendor/\n`);
