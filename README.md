# RepoSnap

_A snapshot of your repo — clean, AI-friendly, and shareable._

---

RepoSnap is a tiny **Node.js CLI + VS Code extension** that generates a clean snapshot of your repository structure.  
Output formats include **ASCII tree, Markdown, and JSON**.  

With a single click or command, you can:  
-  Copy the snapshot to your clipboard  
-  Upload it as a GitHub Gist (perfect for ChatGPT, Cursor, or Slack)  
-  Use filters to control depth, extensions, and exclusions  
-  Show file **sizes**, **line counts (LOC)**, and **counts by type**  
-  Limit snapshot size with `--max-file-size`  
-  Get quick **samples** of your repo with `--sample`  

Use it **standalone via CLI** or as a **VS Code extension**.

---

## 🚀 Quickstart — RepoSnap in 30s

Clone → Debug → Snap. That’s it.

### 1️⃣ Clone this repo
```bash
git clone https://github.com/anglerfishlyy/RepoSnap.git
cd RepoSnap/extension/reposnap-vscode
```
2️⃣ Launch the extension

Open the folder in VS Code

Hit F5 (or go to Run and Debug → Run Extension)

A new VS Code window pops up with RepoSnap loaded

3️⃣ Snap your repo

In the new window, open the project you want to snapshot

Press Ctrl + Shift + P (Cmd + Shift + P on Mac)

Search for RepoSnap: Snap Repo → Enter

✅ Boom! Your folder tree appears in a new tab.

⚡ CLI Usage

Prefer the terminal? Run RepoSnap with npx — no install required.

npx reposnap --depth 2 --extensions js,ts --exclude node_modules,dist --format markdown

Common Flags

--depth <n> → limit how deep the tree goes

--extensions js,ts → only include certain file types

--exclude node_modules,dist → skip noisy folders

--format markdown → wrap output in a Markdown code block

--size → show file sizes

--loc → show line counts (LOC)

--counts → show number of files per extension

--max-file-size <bytes> → skip files larger than given size

--sample <n> → sample random files for quick inspection

⭐ Star & Contribute

If RepoSnap saves you time, please star the repo on GitHub and share it 🚀

-- actively building this in the open.

👉 Try it, file issues, suggest features, or send a PR!

Contribute & give Feedback....Thanks