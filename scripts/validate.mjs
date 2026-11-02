#!/usr/bin/env node
/**
 * Pre-publish checks for dsh-window-size.
 *
 * DSH loads a plugin bundle straight from the published package: the patch file,
 * both halves, the locale dictionaries and the icon must all survive `npm pack`.
 * These checks fail the publish (`prepublishOnly`) when the manifest and the
 * packed file list drift apart.
 *
 * Set SKIP_PACK_CHECK=1 to skip the `npm pack --dry-run` step (offline runs).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const MAX_ICON_BYTES = 256 * 1024;

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};
const read = (path) => {
  try {
    return readFileSync(join(root, path), "utf8");
  } catch (error) {
    failures.push(`${path}: cannot be read (${error.message})`);
    return "";
  }
};
const readJson = (path) => {
  try {
    return JSON.parse(read(path));
  } catch (error) {
    failures.push(`${path}: invalid JSON (${error.message})`);
    return undefined;
  }
};
const pathExists = (path) => existsSync(join(root, path));

const pkg = readJson("package.json");
if (pkg === undefined) {
  console.error("validate: package.json is unreadable");
  process.exit(1);
}

/* ---------------------------------------------------------------- manifest */

check(pkg.name === "dsh-window-size", `package.json: name is ${JSON.stringify(pkg.name)}, expected "dsh-window-size"`);
check(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(String(pkg.version)), `package.json: version ${JSON.stringify(pkg.version)} is not a plain SemVer`);
check(pkg.type === "module", "package.json: type must be \"module\" (Host half is ESM)");
check(typeof pkg.engines?.dsh === "string", "package.json: engines.dsh is required so installs reject unsupported runtimes");
check(pkg.publishConfig?.access === "public", "package.json: publishConfig.access must be \"public\"");
check(typeof pkg.repository?.url === "string" && pkg.repository.url.includes("github.com/jue5hen/dsh-window-size"), "package.json: repository must point at github.com/jue5hen/dsh-window-size");

const patch = pkg.dsh?.bundle?.patch;
const patchFiles = typeof patch === "string" ? [patch] : Array.isArray(patch) ? patch : [];
check(patchFiles.length > 0, "package.json: dsh.bundle.patch must be a path or a list of paths");
for (const file of patchFiles) check(typeof file === "string" && pathExists(file), `package.json: dsh.bundle.patch entry ${JSON.stringify(file)} is missing`);
check(pkg.dsh?.client?.platform === "web", "package.json: dsh.client.platform must be \"web\"");
check(Array.isArray(pkg.dsh?.client?.inject), "package.json: dsh.client.inject must be an array");

/* ----------------------------------------------------------------- exports */

const requiredExports = {
  ".": "./index.js",
  "./client": "./client.js",
  "./cordis.patch.yml": "./cordis.patch.yml",
  "./locale/*.json": "./locale/*.json",
  "./icon": "./icon.svg",
  "./package.json": "./package.json",
};
for (const [key, target] of Object.entries(requiredExports)) {
  check(pkg.exports?.[key] === target, `package.json: exports[${JSON.stringify(key)}] must be ${JSON.stringify(target)}`);
}

/* ------------------------------------------------------------------- files */

const files = Array.isArray(pkg.files) ? pkg.files : [];
const requiredFiles = ["index.js", "client.js", "cordis.patch.yml", "locale/*.json", "icon.svg", "README.md"];
for (const entry of requiredFiles) check(files.includes(entry), `package.json: files must list ${JSON.stringify(entry)}`);

/* ------------------------------------------------------------------- syntax */

for (const file of ["index.js", "client.js"]) {
  try {
    execFileSync(process.execPath, ["--check", join(root, file)], { stdio: "pipe" });
  } catch (error) {
    failures.push(`${file}: syntax check failed\n${String(error.stderr ?? error.message).trim()}`);
  }
}

// client.js is shipped as a prebuilt CommonJS factory registered with the host loader.
const client = read("client.js");
check(client.includes("window.__ModuleLoader__.load"), "client.js: missing window.__ModuleLoader__.load(...) registration");
check(client.includes('"dsh-window-size"') || client.includes("'dsh-window-size'"), "client.js: loader registration must use the package id \"dsh-window-size\"");

// Host half must export apply() and stay inert.
const host = read("index.js");
check(/export\s+function\s+apply\s*\(/.test(host), "index.js: must export apply(ctx)");

for (const patchFile of patchFiles) {
  if (typeof patchFile !== "string" || !pathExists(patchFile)) continue;
  const text = read(patchFile);
  check(text.includes("id: dsh-window-size"), `${patchFile}: does not insert the dsh-window-size row`);
  check(text.includes("name: 'dsh-window-size'"), `${patchFile}: does not reference the dsh-window-size package`);
}

/* ------------------------------------------------------------------ locale */

const localeDir = join(root, "locale");
const localeFiles = existsSync(localeDir) ? readdirSync(localeDir).filter((name) => name.endsWith(".json")) : [];
check(existsSync(localeDir), "locale/ directory is missing");
check(localeFiles.includes("en.json"), "locale/en.json is required (DSH reads it for plugin metadata)");
for (const name of localeFiles) {
  const dictionary = readJson(join("locale", name));
  if (dictionary === undefined) continue;
  check(typeof dictionary.meta?.title === "string" && dictionary.meta.title.length > 0, `locale/${name}: meta.title is required`);
  check(typeof dictionary.meta?.description === "string" && dictionary.meta.description.length > 0, `locale/${name}: meta.description is required`);
}

/* -------------------------------------------------------------------- icon */

if (!pathExists("icon.svg")) {
  failures.push("icon.svg is missing");
} else {
  const icon = readFileSync(join(root, "icon.svg"));
  check(icon.length <= MAX_ICON_BYTES, `icon.svg is ${icon.length} bytes, over the ${MAX_ICON_BYTES}-byte plugin icon limit`);
  check(/^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/.test(icon.toString("utf8")), "icon.svg does not start with an <svg> element");
  check(!/^\s*<svg[^>]*\b(href|xlink:href)\s*=/.test(icon.toString("utf8")), "icon.svg must not reference external resources at the root element");
}

/* ---------------------------------------------------------------- changelog */

const changelog = read("CHANGELOG.md");
check(changelog.includes(`## ${pkg.version} `) || changelog.includes(`## ${pkg.version}\n`), `CHANGELOG.md: missing an entry for ${pkg.version}`);

/* --------------------------------------------------------- packed tarball */

if (process.env.SKIP_PACK_CHECK !== "1") {
  try {
    // `npm pack` is a script here: reuse the CLI that launched us so Windows never
    // has to resolve a .cmd shim (which Node refuses to spawn without a shell).
    const npmArgs = ["pack", "--dry-run", "--json"];
    const npmCli = process.env.npm_execpath;
    const output = npmCli
      ? execFileSync(process.execPath, [npmCli, ...npmArgs], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 })
      : execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", npmArgs, { cwd: root, shell: process.platform === "win32", encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 });
    const start = output.indexOf("[");
    const end = output.lastIndexOf("]");
    const packed = JSON.parse(output.slice(start, end + 1))?.[0]?.files?.map((entry) => entry.path) ?? [];
    const requiredPacked = ["package.json", "index.js", "client.js", "cordis.patch.yml", "icon.svg", "locale/en.json", "locale/zh.json", "README.md"];
    for (const entry of requiredPacked) check(packed.includes(entry), `npm pack: ${entry} is missing from the published tarball`);
    for (const entry of ["MEMORY.md", "screenshots.json", "docs/screenshot.png", "assets/icon-180.png"]) {
      check(!packed.includes(entry), `npm pack: ${entry} must stay out of the published tarball`);
    }
    check(!packed.some((entry) => entry.startsWith("scripts/")), "npm pack: scripts/ must stay out of the published tarball");
    check(!packed.some((entry) => entry.startsWith(".github/")), "npm pack: .github/ must stay out of the published tarball");
  } catch (error) {
    failures.push(`npm pack --dry-run failed: ${String(error.stderr ?? error.message).trim()}`);
  }
}

/* ------------------------------------------------------------------- report */

if (failures.length > 0) {
  console.error(`validate: ${failures.length} problem(s) in ${pkg.name}@${pkg.version}`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`validate: ${pkg.name}@${pkg.version} ok${process.env.SKIP_PACK_CHECK === "1" ? " (pack check skipped)" : ""}`);
