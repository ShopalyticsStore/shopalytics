/**
 * Compiles and signs both uTrace manifests for one Shopalytics release.
 *
 * The browser half is compiled from `utrace/utrace.annotations.json` by the
 * browser SDK's own toolchain, which fails closed on an unknown annotation
 * attribute or an attribute that names an undeclared definition. The server
 * half is `scripts/utrace/server-manifest.ts`. Both are then signed with a
 * development key, because uTrace holds the release keys: a manifest signed
 * here is usable only by a preview whose environment names this key as its
 * trust anchor.
 *
 * Usage: `npm run utrace:manifest`. Output lands in `build/utrace/`, which is
 * git-ignored; the prepared-preview environment supplies the real ones.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import { buildShopalyticsServerManifest } from "./server-manifest";

const require = createRequire(import.meta.url);
const repositoryRoot = resolve(import.meta.dirname, "../..");
const outputDirectory = resolve(repositoryRoot, "build/utrace");

/** Pinned so two runs of the same release produce the same manifest bytes. */
const RELEASE = {
  clientId: "0199a0c0-0000-7aaa-8000-00000000c101",
  manifestId: "0199a0c0-0000-7aaa-8000-00000000f001",
  clientReleaseId: "shopalytics-utrace-sdk-integration",
  manifestVersion: "2026.09.20-1",
} as const;

function sdkScript(packageName: string, file: string): string {
  const entry = require.resolve(`${packageName}/package.json`);
  return resolve(entry, "..", "scripts", file);
}

function run(command: string, args: readonly string[]): void {
  const result = spawnSync(command, [...args], { cwd: repositoryRoot, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${String(result.status)}`);
  }
}

function readApplicationVersion(): string {
  const manifest: unknown = JSON.parse(
    readFileSync(resolve(repositoryRoot, "package.json"), "utf8"),
  );
  if (
    manifest === null ||
    typeof manifest !== "object" ||
    !("version" in manifest) ||
    typeof manifest.version !== "string"
  ) {
    // The fixture is private and carries no version, so the release id is the
    // service version: it is what identifies this build's source.
    return RELEASE.clientReleaseId;
  }
  return manifest.version;
}

mkdirSync(outputDirectory, { recursive: true });

const browserKey = resolve(outputDirectory, "browser-signing-key.json");
if (!existsSync(browserKey)) {
  run("node", [
    sdkScript("@utrace/browser-sdk", "dev-generate-key.mjs"),
    "--key-id",
    "shopalytics-dev",
    "--out",
    browserKey,
  ]);
}

const browserManifest = resolve(outputDirectory, "annotation-manifest.json");
run("node", [
  sdkScript("@utrace/browser-sdk", "compile-manifest.mjs"),
  "--declarations",
  resolve(repositoryRoot, "utrace/utrace.annotations.json"),
  "--source",
  resolve(repositoryRoot, "src"),
  "--version",
  RELEASE.manifestVersion,
  "--release",
  RELEASE.clientReleaseId,
  "--out",
  browserManifest,
]);
run("node", [
  sdkScript("@utrace/browser-sdk", "dev-sign-manifest.mjs"),
  "--manifest",
  browserManifest,
  "--key",
  browserKey,
  "--out",
  resolve(outputDirectory, "annotation-manifest.signed.json"),
]);
// `verify-manifest.mjs` also validates the payload against the published
// annotation-manifest JSON Schema, which only exists inside the uTrace
// monorepo, so it is not part of a client install's pipeline. The runtime
// performs the same verification at activation, and refuses to activate a
// manifest it rejects.

const serverKey = resolve(outputDirectory, "server-signing-key.json");
if (!existsSync(serverKey)) {
  run("node", [
    sdkScript("@utrace/server-sdk", "dev-generate-key.mjs"),
    "--key-id",
    "shopalytics-dev",
    "--out",
    serverKey,
  ]);
}

const serverManifest = resolve(outputDirectory, "server-manifest.json");
writeFileSync(
  serverManifest,
  `${JSON.stringify(
    buildShopalyticsServerManifest({
      clientId: RELEASE.clientId,
      manifestId: RELEASE.manifestId,
      clientReleaseId: RELEASE.clientReleaseId,
      serviceVersion: readApplicationVersion(),
      repositoryRoot,
    }),
    null,
    2,
  )}\n`,
);
run("node", [
  sdkScript("@utrace/server-sdk", "dev-sign-manifest.mjs"),
  "--manifest",
  serverManifest,
  "--key",
  serverKey,
  "--out",
  resolve(outputDirectory, "server-manifest.signed.json"),
]);

process.stdout.write(`utrace:manifest: wrote both signed manifests into ${outputDirectory}\n`);
