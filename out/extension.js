"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const cp = __importStar(require("child_process"));
function activate(context) {
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
            const choice = await vscode.window.showQuickPick(['Send to Copilot Chat', 'Preview Diff First', 'Cancel'], { placeHolder: 'What would you like to do with the diff?' });
            if (choice === 'Send to Copilot Chat') {
                await sendToCopilotChat(diff, mainBranch, currentBranch);
            }
            else if (choice === 'Preview Diff First') {
                await showDiffPreview(diff, currentBranch, mainBranch);
                // Sau khi xem, hỏi gửi không
                const sendAfter = await vscode.window.showInformationMessage('Send this diff to Copilot Chat?', 'Yes', 'No');
                if (sendAfter === 'Yes') {
                    await sendToCopilotChat(diff, mainBranch, currentBranch);
                }
            }
        }
        catch (err) {
            vscode.window.showErrorMessage(`Error: ${err.message}`);
        }
    });
    context.subscriptions.push(disposable);
}
function getCurrentBranch(root) {
    return new Promise((resolve) => {
        cp.exec('git rev-parse --abbrev-ref HEAD', { cwd: root }, (err, stdout) => {
            if (err || !stdout.trim())
                resolve(null);
            else
                resolve(stdout.trim());
        });
    });
}
async function resolveMainBranch(root) {
    // Prefer local branches if present
    const localCandidates = ['main', 'master'];
    for (const branch of localCandidates) {
        const exists = await new Promise((resolve) => {
            cp.exec(`git show-ref --verify --quiet refs/heads/${branch}`, { cwd: root }, (err) => resolve(!err));
        });
        if (exists)
            return branch;
    }
    // Try remote default branch: symbolic ref origin/HEAD -> e.g. origin/main
    const remoteHead = await new Promise((resolve) => {
        cp.exec('git symbolic-ref --quiet --short refs/remotes/origin/HEAD', { cwd: root }, (err, stdout) => {
            const ref = stdout?.trim();
            if (err || !ref)
                return resolve(null);
            resolve(ref); // e.g., 'origin/main'
        });
    });
    if (remoteHead)
        return remoteHead;
    // Fallback: parse 'git remote show origin' for 'HEAD branch: <name>'
    const parsed = await new Promise((resolve) => {
        cp.exec('git remote show origin', { cwd: root }, (err, stdout) => {
            if (err || !stdout)
                return resolve(null);
            const match = stdout.split(/\r?\n/).find((l) => /HEAD branch:/i.test(l));
            const name = match?.split(':')[1]?.trim();
            if (name)
                return resolve(`origin/${name}`);
            resolve(null);
        });
    });
    return parsed;
}
function getGitDiff(root, current, main) {
    return new Promise((resolve) => {
        const cmd = `git diff ${main}...${current} --unified=3`;
        cp.exec(cmd, { cwd: root, maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
            if (err || !stdout.trim())
                resolve(null);
            else
                resolve(stdout);
        });
    });
}
async function showDiffPreview(diff, current, main) {
    const doc = await vscode.workspace.openTextDocument({
        content: diff,
        language: 'diff'
    });
    await vscode.window.showTextDocument(doc, {
        preview: false,
        viewColumn: vscode.ViewColumn.Beside
    });
    vscode.window.showInformationMessage(`Diff between ${current} and ${main} opened in editor.`);
}
async function sendToCopilotChat(diff, baseRef, currentBranch) {
    const userText = `Here is the git diff between my current branch (${currentBranch ?? 'unknown'}) and ${baseRef}:\n\n\`\`\`diff\n${diff}\n\`\`\`\n\nPlease review and suggest improvements.`;
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
    }
    catch (err) {
        // Fall through to next strategy
        console.error('Opening chat with query failed:', err);
    }
    // Fallback: focus the Copilot Chat view and copy the text for manual paste.
    try {
        await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
    }
    catch {
        // ignore
    }
    await vscode.env.clipboard.writeText(userText);
    vscode.window.showWarningMessage('Could not send directly. I opened Copilot Chat and copied the message to your clipboard — paste to send.');
}
function deactivate() { }
//# sourceMappingURL=extension.js.map