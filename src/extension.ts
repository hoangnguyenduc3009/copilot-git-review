import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('mcp.getGitDiff', async () => {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      vscode.window.showErrorMessage('No workspace folder open.');
      return;
    }

    try {
      // 1. Lấy branch hiện tại
      const currentBranch = await getCurrentBranch(workspaceRoot);
      if (!currentBranch) {
        vscode.window.showWarningMessage('Not in a git repository.');
        return;
      }

      // 2. Kiểm tra branch main/master
      const mainBranch = await resolveMainBranch(workspaceRoot);
      if (!mainBranch) {
        vscode.window.showWarningMessage('Could not find main or master branch.');
        return;
      }

      // 3. Lấy diff
      const diff = await getGitDiff(workspaceRoot, currentBranch, mainBranch);
      if (!diff) {
        vscode.window.showInformationMessage('No changes to diff.');
        return;
      }

      // 4. Hỏi người dùng: xem trước hay gửi luôn?
      const choice = await vscode.window.showQuickPick(
        ['Send to Copilot Chat', 'Preview Diff First', 'Cancel'],
        { placeHolder: 'What would you like to do with the diff?' }
      );

      if (choice === 'Send to Copilot Chat') {
        await sendToCopilotChat(diff, mainBranch, currentBranch);
      } else if (choice === 'Preview Diff First') {
        await showDiffPreview(diff, currentBranch, mainBranch);
        // Sau khi xem, hỏi gửi không
        const sendAfter = await vscode.window.showInformationMessage(
          'Send this diff to Copilot Chat?',
          'Yes', 'No'
        );
        if (sendAfter === 'Yes') {
          await sendToCopilotChat(diff, mainBranch, currentBranch);
        }
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(`Error: ${err.message}`);
    }
  });

  context.subscriptions.push(disposable);
}

function getCurrentBranch(root: string): Promise<string | null> {
  return new Promise((resolve) => {
    cp.exec('git rev-parse --abbrev-ref HEAD', { cwd: root }, (err, stdout) => {
      if (err || !stdout.trim()) resolve(null);
      else resolve(stdout.trim());
    });
  });
}

async function resolveMainBranch(root: string): Promise<string | null> {
  // Prefer local branches if present
  const localCandidates = ['main', 'master'];
  for (const branch of localCandidates) {
    const exists = await new Promise<boolean>((resolve) => {
      cp.exec(`git show-ref --verify --quiet refs/heads/${branch}`,
        { cwd: root },
        (err) => resolve(!err)
      );
    });
    if (exists) return branch;
  }

  // Try remote default branch: symbolic ref origin/HEAD -> e.g. origin/main
  const remoteHead = await new Promise<string | null>((resolve) => {
    cp.exec(
      'git symbolic-ref --quiet --short refs/remotes/origin/HEAD',
      { cwd: root },
      (err, stdout) => {
        const ref = stdout?.trim();
        if (err || !ref) return resolve(null);
        resolve(ref); // e.g., 'origin/main'
      }
    );
  });
  if (remoteHead) return remoteHead;

  // Fallback: parse 'git remote show origin' for 'HEAD branch: <name>'
  const parsed = await new Promise<string | null>((resolve) => {
    cp.exec('git remote show origin', { cwd: root }, (err, stdout) => {
      if (err || !stdout) return resolve(null);
      const match = stdout.split(/\r?\n/).find((l) => /HEAD branch:/i.test(l));
      const name = match?.split(':')[1]?.trim();
      if (name) return resolve(`origin/${name}`);
      resolve(null);
    });
  });
  return parsed;
}

function getGitDiff(root: string, current: string, main: string): Promise<string | null> {
  return new Promise((resolve) => {
    const cmd = `git diff ${main}...${current} --unified=3`;
    cp.exec(cmd, { cwd: root, maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err || !stdout.trim()) resolve(null);
      else resolve(stdout);
    });
  });
}

async function showDiffPreview(diff: string, current: string, main: string) {
  const doc = await vscode.workspace.openTextDocument({
    content: diff,
    language: 'diff'
  });
  await vscode.window.showTextDocument(doc, {
    preview: false,
    viewColumn: vscode.ViewColumn.Beside
  });
  vscode.window.showInformationMessage(
    `Diff between ${current} and ${main} opened in editor.`
  );
}

async function sendToCopilotChat(diff: string, baseRef: string, currentBranch: string | null) {
  // Try to use the experimental LM API if available. The API may not be
  // present in the @types in this environment, so cast to any to avoid
  // TypeScript errors while still attempting the direct send at runtime.
  const lmApi: any = (vscode as any).lm;
  if (lmApi && typeof lmApi.requestChatCompletion === 'function') {
    try {
      const userText = `Here is the git diff between my current branch (${currentBranch ?? 'unknown'}) and ${baseRef}:\n\n\`\`\`diff\n${diff}\n\`\`\`\n\nPlease review and suggest improvements.`;
      const chatReq = lmApi.requestChatCompletion({
        model: 'copilot',
        messages: [
          {
            // ChatMessageRole may not exist on the declared types here; use the
            // string role value to avoid a type reference. The runtime API
            // accepts a role string like 'user'.
            role: 'user',
            content: [
              {
                type: 'text',
                text: userText
              }
            ]
          }
        ]
      });
      await chatReq;
      vscode.window.showInformationMessage('Git diff sent to Copilot Chat!');
      return;
    } catch (err: any) {
      // fall through to fallback below
      console.error('LM API send failed:', err);
    }
  }

  // Fallback: copy to clipboard and prompt user to paste into Copilot Chat.
  await vscode.env.clipboard.writeText(diff);
  vscode.window.showWarningMessage(
    'Could not send directly. Diff copied to clipboard. Paste into Copilot Chat.'
  );
  // Try to focus the Copilot Chat pane if available.
  try {
    vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
  } catch (e) {
    // ignore
  }
}

export function deactivate() {}