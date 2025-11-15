```markdown
# Copilot Git Review — Details

![Copilot Git Review Demo](./demo.gif)

This document provides detailed information about the Copilot Git Review VS Code extension: its purpose, how it works, available commands, configuration options, troubleshooting tips, and privacy notes.

## Purpose

- Help developers quickly send the current repository git diff to Copilot Chat for review or suggestions.
- Input: a git repository opened in VS Code (local changes are supported).
- Output: the extension formats and sends a diff prompt to Copilot Chat; the user receives review and suggestions inside Copilot Chat.

## How it works

1. The user triggers the command `MCP: Send Git Diff to Copilot Chat` (via Command Palette, context menu, or keybinding).
2. The extension collects the git diff relative to the configured main branch (`copilotGitReview.mainBranch`).
3. The diff is packaged and sent to Copilot Chat using the editor's Copilot Chat integration.
4. The review or suggestions appear in Copilot Chat and the user can interact with them.

## Commands

- `MCP: Send Git Diff to Copilot Chat` — Collect the git diff and send it to Copilot Chat.
- `MCP: Select Main Branch` — Choose the main branch to diff against (e.g., `main`, `master`, or `origin/main`).

## Configuration

- `copilotGitReview.mainBranch` (string): Default main/base branch to diff against. If left empty, the extension will prompt on first use.

## Keybindings

- macOS: `Cmd+Shift+D`
- Windows/Linux: `Ctrl+Alt+D`

## Privacy & Security

- The extension only collects the git diff from the current repository. It does not upload other files automatically.
- Avoid committing or leaving sensitive data in your diffs if you do not want it sent to Copilot Chat.

## Example usage

1. Open a VS Code workspace containing a git repository with local changes.
2. Press `Cmd+Shift+D` (macOS) or run `MCP: Send Git Diff to Copilot Chat` from the Command Palette.
3. Open Copilot Chat to view suggestions and feedback.

## Troubleshooting

- Repository not detected: ensure `git` is available on your PATH and that the workspace is a git repository.
- Empty diff: make sure there are local changes or the `copilotGitReview.mainBranch` is set correctly.
- No response from Copilot Chat: check network connectivity and Copilot Chat availability/permissions in VS Code.

## Tips

- Include example screenshots or GIFs (for example, `images/demo.gif`) in the README or marketplace listing to help users understand the workflow.
- To silence linter warnings about relative image URLs, add a `repository` field with an HTTPS URL to `package.json`.

## Contributing

- Contributions are welcome. Please open a PR at: https://github.com/hoangnguyenduc3009/copilot-git-review

---

If you want, I can also:
- create an English/translated `README` or `DETAILS_EN.md`,
- add inline screenshots with captions, or
- update `package.json` with the `repository` field to avoid linter warnings.
```
