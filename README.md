<div align="center">

# Wails Build Windows

A GitHub Action to build Wails applications on Windows with NSIS installer

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

## Usage

### Basic

```yaml
name: Build

on: push

jobs:
    build:
        runs-on: windows-2025
        steps:
            - uses: actions/checkout@v6
            - uses: ovftank/wails-build-windows@v1.0.0
```

### With Release

```yaml
name: Release

on:
    push:
        tags:
            - 'v*'

jobs:
    build:
        runs-on: windows-latest
        permissions:
            contents: write

        steps:
            - uses: actions/checkout@v6

            - id: build
              uses: ovftank/wails-build-windows@v1.0.0

            - uses: softprops/action-gh-release@v2
              with:
                  tag_name: ${{ github.ref_name }}
                  name: Release ${{ github.ref_name }}
                  draft: false
                  prerelease: false
                  files: |
                      ${{ steps.build.outputs.installer-path }}
                      ${{ steps.build.outputs.binary-path }}
                  body: |
                      ## Changes in ${{ github.ref_name }}

                      - Built from commit: ${{ github.sha }}
                      - Build date: ${{ github.run_number }}
                      - Workflow: ${{ github.workflow }}

                      ### Download
                      - `${{ steps.build.outputs.binary-path }}` - Application executable
                      - `${{ steps.build.outputs.installer-path }}` - NSIS installer
```

## Outputs

| Output           | Description                               |
| ---------------- | ----------------------------------------- |
| `installer-path` | Path to the NSIS installer (.exe)         |
| `binary-path`    | Path to the application executable (.exe) |

## What It Does

1. Installs NSIS (via Chocolatey)
2. Installs Wails CLI (latest)
3. Runs `pnpm install`
4. Runs `wails build -nsis -clean`

## Build Output

-   `<app-name>.exe` - Application executable
-   `<app-name>-amd64-installer.exe` - NSIS installer

## License

MIT

