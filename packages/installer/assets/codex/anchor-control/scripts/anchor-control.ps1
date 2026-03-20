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

function Write-Fail {
  param([string]$Message)

  [Console]::Error.WriteLine($Message)
  exit 1
}

function Test-CommandAvailable {
  param([string]$Name)

  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Test-AnchorWorkspace {
  param([string]$Dir)

  $packagePath = Join-Path $Dir "package.json"
  if (-not (Test-Path -LiteralPath $packagePath)) {
    return $false
  }

  try {
    $package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
    return $package.name -eq "anchor-runtime-workspace"
  } catch {
    return $false
  }
}

function Find-RepoRoot {
  param([string]$StartDir)

  $resolved = Resolve-Path -LiteralPath $StartDir -ErrorAction SilentlyContinue
  if ($null -eq $resolved) {
    return $null
  }

  $current = $resolved.Path
  while ($true) {
    if (Test-AnchorWorkspace $current) {
      return $current
    }

    $parent = [System.IO.Directory]::GetParent($current)
    if ($null -eq $parent) {
      return $null
    }

    $current = $parent.FullName
  }
}

function Resolve-RepoRootOverride {
  param(
    [string]$SourceName,
    [string]$StartDir
  )

  $repoRoot = Find-RepoRoot $StartDir
  if ($null -eq $repoRoot) {
    Write-Fail "$SourceName does not point to an Anchor workspace: $StartDir"
  }

  return $repoRoot
}

function Read-ConfiguredRepoRoot {
  $configPath = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")).Path "anchor-runtime.json"
  if (-not (Test-Path -LiteralPath $configPath)) {
    return $null
  }

  try {
    $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
  } catch {
    Write-Fail "Invalid Anchor runtime config at ${configPath}: $($_.Exception.Message)"
  }

  if ($null -eq $config.repoRoot -or [string]::IsNullOrWhiteSpace([string]$config.repoRoot)) {
    Write-Fail "Invalid Anchor runtime config at ${configPath}: missing repoRoot."
  }

  return Resolve-RepoRootOverride "Anchor runtime config" ([string]$config.repoRoot)
}

$anchorArgs = @()

switch ($Command) {
  "doctor" {
    $anchorArgs += @("adapters", "doctor")
  }
  "goal" {
    if (-not $Goal) {
      throw "Goal is required for goal."
    }
    $anchorArgs += @("goal", "--backend", $Backend, "--goal", $Goal)
    if ($Cwd) { $anchorArgs += @("--cwd", $Cwd) }
    foreach ($item in $Constraint) { $anchorArgs += @("--constraint", $item) }
    foreach ($item in $Success) { $anchorArgs += @("--success", $item) }
    $anchorArgs += @("--max-rounds", "$MaxRounds", "--max-same-failure", "$MaxSameFailure")
    if ($NoAllowPartial) { $anchorArgs += "--no-allow-partial" }
  }
}

if ($Json) {
  $anchorArgs += "--json"
}

if (Test-CommandAvailable "anchor") {
  & anchor @anchorArgs
  exit $LASTEXITCODE
}

$repoRoot = $null
if (-not [string]::IsNullOrWhiteSpace($env:ANCHOR_REPO_ROOT)) {
  $repoRoot = Resolve-RepoRootOverride "ANCHOR_REPO_ROOT" $env:ANCHOR_REPO_ROOT
}

if ($null -eq $repoRoot) {
  $repoRoot = Read-ConfiguredRepoRoot
}

if ($null -eq $repoRoot) {
  $repoRoot = Find-RepoRoot (Join-Path $PSScriptRoot "..\..\..\..\..")
}

if ($null -eq $repoRoot) {
  Write-Fail "Unable to locate an Anchor runtime. Install the anchor CLI on PATH, reinstall the skill from an Anchor workspace, or set ANCHOR_REPO_ROOT to an Anchor workspace."
}

if (-not (Test-CommandAvailable "pnpm")) {
  Write-Fail "pnpm is required to run Anchor from a linked workspace."
}

Push-Location $repoRoot
try {
  & pnpm anchor @anchorArgs
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
