# Copilot Git Review

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/harrus.copilot-git-review.svg)](https://marketplace.visualstudio.com/items?itemName=harrus.copilot-git-review)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A VS Code extension that helps developers quickly send their git diff to Copilot Chat for code review and suggestions.

## Quick Start

1. **Install** the extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=harrus.copilot-git-review)
2. **Open** a git repository in VS Code with local changes
3. **Press** `Cmd+Shift+D` (macOS) or `Ctrl+Alt+D` (Windows/Linux) to send your diff to Copilot Chat
4. **Review** suggestions from Copilot Chat

## Demo

![Copilot Git Review Demo](./demo.gif)

## Features

- 🚀 **One-click code review**: Send your git diff to Copilot Chat instantly
- 🎯 **Smart branch detection**: Automatically finds your main branch or let you customize it
- 📋 **Optional spec input**: Add context or acceptance criteria for more relevant suggestions
- 👀 **Preview option**: Review your diff before sending to Copilot Chat
- ⚙️ **Configurable**: Set your preferred base branch in VS Code settings

## Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| `MCP: Send Git Diff to Copilot Chat` | `Cmd+Shift+D` (macOS)<br>`Ctrl+Alt+D` (Windows/Linux) | Send your current diff to Copilot Chat |
| `MCP: Select Main Branch` | — | Choose the main branch to diff against |

## Configuration

Configure the extension via VS Code settings:

```json
{
  "copilotGitReview.mainBranch": "main"
}
```

- **`copilotGitReview.mainBranch`** (string): The default base branch to diff against (e.g., `main`, `master`, or `origin/main`). Leave empty to be prompted on first use.

## How It Works

1. Collects the git diff relative to your main branch
2. Allows you to add optional context (spec/requirements)
3. Optionally previews the diff before sending
4. Sends the formatted diff to Copilot Chat
5. Receive code review feedback directly in the Chat interface

## Requirements

- VS Code 1.85.0 or later
- Copilot Chat extension installed
- Git repository with local changes
- Git CLI available on your PATH

## Privacy & Security

- The extension only collects the git diff from your repository
- No other files are automatically uploaded
- Avoid including sensitive data in your diffs

## Documentation

For detailed information, troubleshooting, and advanced usage, see [DETAILS.md](DETAILS.md).

## Contributing

Contributions are welcome! Please open a PR or issue on [GitHub](https://github.com/hoangnguyenduc3009/copilot-git-review).

## License

MIT © 2024 [harrus](https://github.com/hoangnguyenduc3009)

---

**Tip:** For the best experience, ensure Copilot Chat is installed and enabled in your VS Code workspace.
