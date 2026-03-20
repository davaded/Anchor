#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_BACKEND = "codex";
const VALID_COMMANDS = new Set(["doctor", "goal"]);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function fail(message) {
  console.error(message);
  process.exit(1);
}

function findRepoRoot(startDir) {
  let current = startDir;
  while (true) {
    const candidate = path.join(current, "package.json");
    if (fs.existsSync(candidate)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(candidate, "utf8"));
        if (pkg?.name === "anchor-runtime-workspace") {
          return current;
        }
      } catch {
        // Ignore invalid package.json files while walking up.
      }
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

function hasCommand(command) {
  if (process.platform === "win32") {
    const result = spawnSync("where", [command], {
      stdio: "ignore",
      shell: true
    });
    return result.status === 0;
  }

  const result = spawnSync("command", ["-v", command], {
    stdio: "ignore",
    shell: true
  });
  return result.status === 0;
}

function parseArgs(argv) {
  if (argv.length === 0) {
    fail("Command is required: doctor | goal");
  }

  const [command, ...rest] = argv;
  if (!VALID_COMMANDS.has(command)) {
    fail(`Unsupported command: ${command}`);
  }

  const options = {
    command,
    backend: DEFAULT_BACKEND,
    constraints: [],
    success: [],
    json: false,
    noAllowPartial: false
  };

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    switch (token) {
      case "-Backend":
      case "--backend":
        options.backend = rest[++index] ?? fail("Missing value for backend.");
        break;
      case "-Goal":
      case "--goal":
        options.goal = rest[++index] ?? fail("Missing value for goal.");
        break;
      case "-Cwd":
      case "--cwd":
        options.cwd = rest[++index] ?? fail("Missing value for cwd.");
        break;
      case "-Constraint":
      case "--constraint":
        options.constraints.push(rest[++index] ?? fail("Missing value for constraint."));
        break;
      case "-Success":
      case "--success":
        options.success.push(rest[++index] ?? fail("Missing value for success."));
        break;
      case "-MaxRounds":
      case "--max-rounds":
        options.maxRounds = rest[++index] ?? fail("Missing value for max-rounds.");
        break;
      case "-MaxSameFailure":
      case "--max-same-failure":
        options.maxSameFailure = rest[++index] ?? fail("Missing value for max-same-failure.");
        break;
      case "-NoAllowPartial":
      case "--no-allow-partial":
        options.noAllowPartial = true;
        break;
      case "-Json":
      case "--json":
        options.json = true;
        break;
      default:
        fail(`Unsupported argument: ${token}`);
    }
  }

  if (options.command === "goal" && !options.goal) {
    fail("Goal is required for goal.");
  }

  return options;
}

function buildAnchorArgs(options) {
  if (options.command === "doctor") {
    return ["adapters", "doctor"];
  }

  const args = ["goal", "--backend", options.backend, "--goal", options.goal];
  if (options.cwd) {
    args.push("--cwd", options.cwd);
  }
  for (const item of options.constraints) {
    args.push("--constraint", item);
  }
  for (const item of options.success) {
    args.push("--success", item);
  }
  if (options.maxRounds) {
    args.push("--max-rounds", options.maxRounds);
  }
  if (options.maxSameFailure) {
    args.push("--max-same-failure", options.maxSameFailure);
  }
  if (options.noAllowPartial) {
    args.push("--no-allow-partial");
  }
  return args;
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (typeof result.status === "number") {
    process.exit(result.status);
  }
  process.exit(1);
}

const options = parseArgs(process.argv.slice(2));
const anchorArgs = buildAnchorArgs(options);
if (options.json) {
  anchorArgs.push("--json");
}

if (hasCommand("anchor")) {
  run("anchor", anchorArgs);
}

const envRepoRoot = process.env.ANCHOR_REPO_ROOT;
const repoRoot = envRepoRoot ? path.resolve(envRepoRoot) : findRepoRoot(path.resolve(scriptDir, "..", "..", "..", "..", ".."));

if (repoRoot && hasCommand("pnpm")) {
  run("pnpm", ["anchor", ...anchorArgs], repoRoot);
}

fail("Unable to locate an Anchor runtime. Install the anchor CLI on PATH or set ANCHOR_REPO_ROOT to an Anchor workspace.");
