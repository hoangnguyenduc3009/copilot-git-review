import * as vscode from 'vscode';
import * as cp from 'child_process';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('mcp.getGitDiff', async () => {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      vscode.window.showErrorMessage('No workspace folder open.');
      return;
    }

    try {
  // 1. Get current branch
      const currentBranch = await getCurrentBranch(workspaceRoot);
      if (!currentBranch) {
        vscode.window.showWarningMessage('Not in a git repository.');
        return;
      }

  // 2. Determine the main branch: prefer configuration, otherwise ask the user on first run
      const mainBranch = await getOrAskForMainBranch(workspaceRoot);
      if (!mainBranch) {
        vscode.window.showWarningMessage('Could not determine a main branch.');
        return;
      }

  // 3. Get diff
      const diff = await getGitDiff(workspaceRoot, currentBranch, mainBranch);
      if (!diff) {
        vscode.window.showInformationMessage('No changes to diff.');
        return;
      }

  // 4. Ask the user to enter ticket/requirement (optional)
          const specInfo = await vscode.window.showInputBox({
            prompt: 'Enter spec (optional)',
            placeHolder: 'e.g., feature description or acceptance criteria',
            ignoreFocusOut: true
          });

  // 5. Ask the user: preview first or send directly?
      const choice = await vscode.window.showQuickPick(
        ['Send to Copilot Chat', 'Preview Diff First', 'Cancel'],
        { placeHolder: 'What would you like to do with the diff?' }
      );

      if (choice === 'Send to Copilot Chat') {
            await sendToCopilotChat(diff, mainBranch, currentBranch, specInfo);
      } else if (choice === 'Preview Diff First') {
        await showDiffPreview(diff, currentBranch, mainBranch);
  // After previewing, ask whether to send
        const sendAfter = await vscode.window.showInformationMessage(
          'Send this diff to Copilot Chat?',
          'Yes', 'No'
        );
        if (sendAfter === 'Yes') {
              await sendToCopilotChat(diff, mainBranch, currentBranch, specInfo);
        }
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(`Error: ${err.message}`);
    }
  });

  context.subscriptions.push(disposable);

  // Command: allow user to re-select the main branch any time
  const selectMainBranchCmd = vscode.commands.registerCommand('mcp.selectMainBranch', async () => {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      vscode.window.showErrorMessage('No workspace folder open.');
      return;
    }
    const picked = await promptSelectMainBranch(workspaceRoot);
    if (picked) {
      await saveMainBranch(picked);
      vscode.window.showInformationMessage(`Main branch set to: ${picked}`);
    }
  });

  context.subscriptions.push(selectMainBranchCmd);
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

async function listAllBranches(root: string): Promise<string[]> {
  return new Promise((resolve) => {
    const cmd = `git for-each-ref --format="%(refname:short)" refs/heads refs/remotes`;
    cp.exec(cmd, { cwd: root, maxBuffer: 2 * 1024 * 1024 }, (err, stdout) => {
      if (err || !stdout) return resolve([]);
      const lines = stdout
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        // Filter out HEAD pointers like 'origin/HEAD'
        .filter((b) => !/\/HEAD$/.test(b));
      // De-duplicate
      const seen = new Set<string>();
      const out: string[] = [];
      for (const b of lines) {
        if (!seen.has(b)) {
          seen.add(b);
          out.push(b);
        }
      }
      resolve(out);
    });
  });
}

async function branchExists(root: string, branch: string): Promise<boolean> {
  // If contains a slash, try as remote ref first (refs/remotes/<branch>)
  const tries = [
    `refs/heads/${branch}`,
    `refs/remotes/${branch}`
  ];
  for (const ref of tries) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await new Promise<boolean>((resolve) => {
      cp.exec(`git show-ref --verify --quiet ${ref}`, { cwd: root }, (err) => resolve(!err));
    });
    if (ok) return true;
  }
  return false;
}

async function promptSelectMainBranch(root: string): Promise<string | null> {
  const branches = await listAllBranches(root);
  if (!branches.length) return null;

  // Prefer showing likely main branches at top
  const priority = (b: string) => (/(^|\/)main$/.test(b) ? 0 : /(^|\/)master$/.test(b) ? 1 : 2);
  const sorted = branches.sort((a, b) => priority(a) - priority(b) || a.localeCompare(b));

  const items: vscode.QuickPickItem[] = sorted.map((b) => ({ label: b }));
  items.unshift({ label: '$(pencil) Enter branch manually…', description: 'Type another branch name' } as any);

  const pick = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select the main/base branch (e.g., main, master, or origin/main)'
  });
  if (!pick) return null;

  if (pick.label.includes('Enter branch')) {
    const manual = await vscode.window.showInputBox({
      prompt: 'Enter branch name to use as main/base (e.g., main, master, origin/main)',
      placeHolder: 'main',
      ignoreFocusOut: true
    });
    if (!manual) return null;
    return manual.trim();
  }
  return pick.label.trim();
}

async function getOrAskForMainBranch(root: string): Promise<string | null> {
  const config = vscode.workspace.getConfiguration('copilotGitReview');
  let main = (config.get<string>('mainBranch') || '').trim();

  if (!main) {
    // First run: ask the user
    const picked = await promptSelectMainBranch(root);
    if (picked) {
      await saveMainBranch(picked);
      main = picked;
    } else {
      // As a fallback, try to resolve automatically
      main = (await resolveMainBranch(root)) || '';
    }
  }

  if (!main) return null;

  // Validate branch exists; if not, offer to reselect
  const exists = await branchExists(root, main);
  if (!exists) {
    const choice = await vscode.window.showWarningMessage(
      `Configured main branch '${main}' was not found in this repository. Select another?`,
      'Select',
      'Cancel'
    );
    if (choice === 'Select') {
      const picked = await promptSelectMainBranch(root);
      if (picked) {
        await saveMainBranch(picked);
        return picked;
      }
    }
    return null;
  }
  return main;
}

async function saveMainBranch(value: string): Promise<void> {
  const config = vscode.workspace.getConfiguration('copilotGitReview');
  // Store at workspace level so each workspace can have its own main/base branch
  await config.update('mainBranch', value, vscode.ConfigurationTarget.Workspace);
}

function getGitDiff(root: string, current: string, main: string): Promise<string | null> {
  return new Promise((resolve) => {
    // Exclude log files, lock files, and other unnecessary files
    const excludePatterns = [
      '*.log',
      '*.lock',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'bun.lockb',
      '*.min.js',
      '*.min.css',
      '*.map',
      'dist/*',
      'build/*',
      'out/*',
      '.vscode/*',
      '.idea/*',
      'node_modules/*',
      '*.tmp',
      '*.temp',
      '*.cache'
    ];
    
    const excludeArgs = excludePatterns.map(p => `':(exclude)${p}'`).join(' ');
    const cmd = `git diff ${main}...${current} --unified=3 -- . ${excludeArgs}`;
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

async function sendToCopilotChat(diff: string, baseRef: string, currentBranch: string | null, specInfo?: string) {
  let userText = `Here is the git diff between my current branch (${currentBranch ?? 'unknown'}) and ${baseRef}:`;

  if (specInfo && specInfo.trim()) {
    userText += `\n\n**Spec:** ${specInfo.trim()}`;
  }

  userText += `\n\n\`\`\`diff\n${diff}\n\`\`\`\n\nPlease review and suggest improvements.`;

  // Preferred: Open the built-in Chat UI with the query prefilled and sent.
  try {
    // This command is available in recent VS Code builds and will open the Chat view,
    // focus the input, and (when a full query is provided) submit it.
    await vscode.commands.executeCommand('workbench.action.chat.open', {
      query: userText,
      // If set, VS Code can wait until the response is complete before returning.
      // We don't block here to keep UX snappy.
      blockOnResponse: false
    });
    vscode.window.showInformationMessage('Opened Copilot Chat with your diff.');
    return;
  } catch (err) {
    // Fall through to next strategy
    console.error('Opening chat with query failed:', err);
  }

  // Fallback: focus the Copilot Chat view and copy the text for manual paste.
  try {
    await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
  } catch {
    // ignore
  }
  await vscode.env.clipboard.writeText(userText);
  vscode.window.showWarningMessage(
    'Could not send directly. I opened Copilot Chat and copied the message to your clipboard — paste to send.'
  );
}

export function deactivate() {}