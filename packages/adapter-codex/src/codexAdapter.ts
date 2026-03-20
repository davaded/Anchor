import { spawn } from "node:child_process";
import { createEventId, nowIso, serializeRoundInput } from "@anchor/core";
import type { AdapterDoctorResult, ArtifactStore, BackendAdapter, BackendResult, RoundInput } from "@anchor/core";

export interface ProcessRunResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  startedAt: string;
  finishedAt: string;
}

export type ProcessRunner = (command: string, args: string[], cwd?: string) => Promise<ProcessRunResult>;

function defaultRunner(command: string, args: string[], cwd?: string): Promise<ProcessRunResult> {
  const startedAt = nowIso();
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === "win32"
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({
        exitCode,
        stdout,
        stderr,
        startedAt,
        finishedAt: nowIso()
      });
    });
  });
}

export interface CodexAdapterOptions {
  binary?: string;
  artifactStore?: ArtifactStore;
  runner?: ProcessRunner;
}

export class CodexAdapter implements BackendAdapter {
  private readonly binary: string;
  private readonly artifactStore?: ArtifactStore;
  private readonly runner: ProcessRunner;

  public constructor(options: CodexAdapterOptions = {}) {
    this.binary = options.binary ?? "codex";
    this.artifactStore = options.artifactStore;
    this.runner = options.runner ?? defaultRunner;
  }

  public describe() {
    return {
      backend_id: "codex",
      backend_label: "Codex CLI",
      adapter_version: "0.1.0",
      execution_mode: "subprocess-cli",
      capabilities: {
        read_files: true,
        write_files: true,
        run_commands: true,
        use_tools: true,
        structured_patch_output: false,
        supports_interruption: false,
        supports_stream_events: true
      }
    };
  }

  public async doctor(): Promise<AdapterDoctorResult> {
    try {
      const result = await this.runner(this.binary, ["--version"]);
      return {
        backend_id: "codex",
        available: result.exitCode === 0,
        version: result.stdout.trim() || undefined,
        details: result.exitCode === 0 ? "codex CLI is available." : result.stderr.trim() || "codex CLI returned a non-zero exit code."
      };
    } catch (error) {
      return {
        backend_id: "codex",
        available: false,
        details: error instanceof Error ? error.message : "Failed to execute codex --version."
      };
    }
  }

  public async execute(input: RoundInput): Promise<BackendResult> {
    const prompt = serializeRoundInput(input);
    try {
      const result = await this.runner(
        this.binary,
        ["exec", "--skip-git-repo-check", "--json", prompt],
        input.cwd
      );

      const transcriptArtifact = await this.persistArtifact(input, "transcript", `${result.stdout}\n${result.stderr}`);
      const commandArtifact = await this.persistArtifact(input, "command-log", JSON.stringify({
        command: this.binary,
        args: ["exec", "--skip-git-repo-check", "--json"],
        exitCode: result.exitCode
      }, null, 2), "json");

      const artifacts: BackendResult["artifacts"] = [];
      if (transcriptArtifact) artifacts.push(transcriptArtifact);
      if (commandArtifact) artifacts.push(commandArtifact);

      return {
        task_id: input.task_id,
        goal_id: input.goal_id,
        round_id: input.round_id,
        backend: {
          ...this.describe(),
          backend_version: (await this.doctor()).version
        },
        status: result.exitCode === 0 ? "completed" : "failed",
        trusted: {
          process_exit_code: result.exitCode,
          started_at: result.startedAt,
          finished_at: result.finishedAt,
          duration_ms: Date.parse(result.finishedAt) - Date.parse(result.startedAt),
          execution_confirmed: true,
          binary_path: this.binary
        },
        derived: {
          files: [],
          commands: [
            {
              command: `${this.binary} exec --skip-git-repo-check --json`,
              exit_code: result.exitCode ?? undefined,
              duration_ms: Date.parse(result.finishedAt) - Date.parse(result.startedAt),
              status: result.exitCode === 0 ? "completed" : "failed",
              trust_tier: "trusted"
            }
          ],
          blockers: [],
          constraint_violations: []
        },
        self_reported: {
          summary: result.stdout.trim().split(/\r?\n/).slice(-1)[0] ?? "",
          notes: result.stderr.trim() ? [result.stderr.trim()] : [],
          claims: []
        },
        artifacts,
        raw_ref: transcriptArtifact?.ref
      };
    } catch (error) {
      return {
        task_id: input.task_id,
        goal_id: input.goal_id,
        round_id: input.round_id,
        backend: this.describe(),
        status: "blocked",
        trusted: {
          process_exit_code: null,
          started_at: nowIso(),
          finished_at: nowIso(),
          duration_ms: 0,
          execution_confirmed: false,
          binary_path: this.binary
        },
        derived: {
          files: [],
          commands: [],
          blockers: [
            {
              code: "CLI_NOT_AVAILABLE",
              detail: error instanceof Error ? error.message : "Failed to invoke codex CLI.",
              retryable: false,
              trust_tier: "trusted"
            }
          ],
          constraint_violations: []
        },
        self_reported: {
          summary: "Codex CLI invocation failed.",
          notes: [],
          claims: []
        },
        artifacts: []
      };
    }
  }

  private async persistArtifact(input: RoundInput, type: "transcript" | "command-log", content: string, extension = "txt") {
    if (!this.artifactStore) {
      return undefined;
    }
    const metadata = await this.artifactStore.putArtifact({
      task_id: input.task_id,
      round_id: input.round_id,
      event_id: createEventId(),
      type,
      producer: "adapter-codex",
      extension,
      content
    });
    return {
      type,
      ref: `artifact://${metadata.artifact_id}`
    } as const;
  }
}
