param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("doctor", "goal")]
  [string]$Command,

  [string]$Backend = "codex",
  [string]$Goal,
  [string]$Cwd,
  [string[]]$Constraint = @(),
  [string[]]$Success = @(),
  [int]$MaxRounds = 6,
  [int]$MaxSameFailure = 2,
  [switch]$NoAllowPartial,
  [switch]$Json
)

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..\..")).Path
$args = @("anchor")

switch ($Command) {
  "doctor" {
    $args += @("adapters", "doctor")
  }
  "goal" {
    if (-not $Goal) {
      throw "Goal is required for goal."
    }
    $args += @("goal", "--backend", $Backend, "--goal", $Goal)
    if ($Cwd) { $args += @("--cwd", $Cwd) }
    foreach ($item in $Constraint) { $args += @("--constraint", $item) }
    foreach ($item in $Success) { $args += @("--success", $item) }
    $args += @("--max-rounds", "$MaxRounds", "--max-same-failure", "$MaxSameFailure")
    if ($NoAllowPartial) { $args += "--no-allow-partial" }
  }
}

if ($Json) {
  $args += "--json"
}

Push-Location $repoRoot
try {
  & pnpm @args
} finally {
  Pop-Location
}
