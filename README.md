<p align="right">
   <strong>EN</strong> | <a href="./README.zh-CN.md">简</a> | <a href="./README.zh-TW.md">繁</a> | <a href="./README.ko.md">KO</a> | <a href="./README.ja.md">JA</a>
</p>
<div align="center">
    <img src=".github/assets/app.png" alt="Router x Token Monitor logo" width="120">
    <h1>Router x Token Monitor</h1>
</div>

<p align="center">
    <em>One live dashboard for every AI coding tool, customized for power users with advanced limit tracking.</em>
</p>

<p align="center">
    <a href="https://github.com/celestialgeeks/router-x-token-monitor/releases"><img src="https://img.shields.io/github/v/release/celestialgeeks/router-x-token-monitor?include_prereleases&style=flat-square&label=release&color=22c55e" alt="Latest release" /></a>
    <img src="https://img.shields.io/badge/Windows-10%2B-0078D4?style=flat-square" alt="Windows 10 or later" />
    <img src="https://img.shields.io/badge/macOS-14%2B-0A84FF?style=flat-square&logo=apple&logoColor=white" alt="macOS 14 or later" />
    <img src="https://img.shields.io/badge/Linux-x64-64748b?style=flat-square&logo=linux&logoColor=white" alt="Linux x64" />
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-A855F7?style=flat-square" alt="License: MIT" /></a>
</p>

## What is Router x Token Monitor?

**Router x Token Monitor** is an advanced fork of the Token Monitor widget, extensively modified and customized to serve as a robust tracking platform for heavy AI API users. Built with Electron, Vanilla JS, and CSS, it shows live token usage and AI Tool Limits across 28+ AI coding tools — Claude Code, Codex, Cursor, GitHub Copilot, and more — with real-time multi-device sync, historical usage trends, and breakdowns by tool, device, model, session, or project.

### 🌟 Exclusive Custom Features

This repository showcases several major engineering improvements tailored for power users:

- **Intelligent Active-Account Prioritization:** When configuring multiple accounts for the same provider (e.g., FreeLLM Ollama rotations), the system automatically detects which account is currently streaming tokens and instantly elevates it to the primary slot on the Home Screen and Menu Bar Tray. No more staring at a depleted quota!
- **Logarithmic Activity Heatmap:** Standard linear heatmaps fail when dealing with massive Token usage outliers (e.g. processing 16M tokens in a single day squashes all other days into visually "dull" squares). This monitor features a custom, mathematically robust logarithmic scaling algorithm for the contribution calendar, ensuring visual clarity across all magnitudes of usage.
- **Enhanced Multi-Account Handling:** Built from the ground up to support seamless API key and account rotation without losing track of combined limits and historical data.

## Showcase

<table>
<tr>
<td width="290" align="center"><img src=".github/assets/home-view.png" width="250" alt="Home View"><br><sub>Customizable dashboard — actively streaming accounts automatically take priority in your limits view</sub></td>
<td width="290" align="center"><img src=".github/assets/limits-view.png" width="250" alt="Limits View"><br><sub>Multiple accounts side by side, one-click switch of the active account</sub></td>
<td width="290" align="center"><img src=".github/assets/tools-view.png" width="250" alt="Tools View"><br><sub>Click any tool to expand input / output and cache-hit detail</sub></td>
</tr>
<tr>
<td width="290" align="center"><img src=".github/assets/sessions-view.png" width="250" alt="Session View"><br><sub>Open a single session to break each prompt into tokens and tools used</sub></td>
<td width="290" align="center"><img src=".github/assets/models-view.png" width="250" alt="Models View"><br><sub>Every model's usage and cost, aggregated across tools</sub></td>
<td width="290" align="center"><img src=".github/assets/devices-view.png" width="250" alt="Devices View"><br><sub>Each device's usage, cost, and sync status — expand for per-machine detail</sub></td>
</tr>
</table>

<table>
<tr>
<td width="435" align="center"><img src=".github/assets/dashboard-overview.png" width="400" alt="Usage Dashboard Overview"><br><sub>A year of activity heatmap, utilizing custom logarithmic intensity scaling to gracefully handle massive outliers.</sub></td>
<td width="435" align="center"><img src=".github/assets/dashboard-trends.png" width="400" alt="Usage Dashboard Trends"><br><sub>A year of daily trends, stacked by tool / model, with K-line</sub></td>
</tr>
</table>

## Core Architecture

Router x Token Monitor is built around a highly optimized, local-first architecture:
- **Frontend:** Pure, framework-less Vanilla JS and CSS for absolute maximum performance and minimal memory footprint.
- **Desktop Runtime:** Electron, seamlessly integrating into the macOS Menu Bar and Windows System Tray.
- **Sync Engine:** Node.js backend utilizing Server-Sent Events (SSE) for instantaneous, cross-device multi-agent telemetry synchronization.

## Installation

Download the latest version from [GitHub Releases](https://github.com/celestialgeeks/router-x-token-monitor/releases).

- **macOS (Apple Silicon)** — `.dmg` (Unsigned Local Build)
- **macOS (Intel)** — x64 `.dmg` (Unsigned Local Build)
- **Windows 10/11** — setup and portable `.exe`
- **Linux x64** — `.AppImage`

> **Note for macOS Users:** Because this is a custom fork, the releases are unsigned. To install, manually download the `.dmg`, drag the app to Applications, and control-click (right-click) the `.app` -> "Open" to bypass Gatekeeper. Background auto-updates are disabled for unsigned apps by macOS security policies, so you will need to manually download new releases.

## Build from source

To build your own installer, use Node.js 22.13+ on the **target** OS.

```bash
npm install
npm run dist:mac:unsigned # macOS arm64 .dmg (Local, unsigned)
npm run dist:mac:x64      # macOS Intel x64 .dmg
npm run dist:win          # Windows x64 installer .exe
npm run dist:linux        # Linux x64 AppImage
```

## Contributing

Issues and PRs are welcome. Project conventions, architecture notes, and the command reference live in [AGENTS.md](AGENTS.md) — written for coding agents, but it doubles as the contributor guide.

## Acknowledgments

- **Token Monitor** (Original Project Base) by [Javis](https://github.com/Javis603)
- [tokscale](https://github.com/junhoyeo/tokscale) for log parsing and token accounting.
- [CodexBar](https://github.com/steipete/CodexBar) for AI Tool Limits research.

## License

[MIT](LICENSE) © [@celestialgeeks](https://github.com/celestialgeeks)
