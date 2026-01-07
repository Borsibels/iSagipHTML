# GitHub Push/Pull Guide for iSagipHTML-Midterms-2.0

## Prerequisites: Installing Git on Windows

### Step 1: Download Git
1. Go to: **https://git-scm.com/download/win**
2. The download should start automatically (it will download the latest 64-bit version)
3. If it doesn't, click the download button manually

### Step 2: Install Git
1. Run the downloaded installer (e.g., `Git-2.x.x-64-bit.exe`)
2. **Important Installation Options:**
   - ✅ Keep default options (they're usually fine)
   - ✅ Make sure "Git from the command line and also from 3rd-party software" is selected
   - ✅ Choose "Use bundled OpenSSH"
   - ✅ Choose "Use the OpenSSL library"
   - ✅ Choose "Checkout Windows-style, commit Unix-style line endings"
   - ✅ Choose "Use Windows' default console window"
   - ✅ Choose "Enable file system caching" and "Enable Git Credential Manager"

### Step 3: Verify Installation
After installation, **close and reopen your terminal/PowerShell**, then run:
```bash
git --version
```

If you see a version number (e.g., `git version 2.42.0`), Git is installed correctly!

### Step 4: Configure Git (First Time Setup)
Set your name and email (this will be used for your commits):
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

**Note:** After installing Git, you may need to restart your terminal/IDE for the changes to take effect.

## Initial Setup (First Time Only)

### 1. Initialize Git Repository (if not already done)
```bash
cd iSagipHTML-Midterms-2.0
git init
```

### 2. Add Your GitHub Remote Repository
Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual GitHub username and repository name:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
```

Or if using SSH:
```bash
git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO_NAME.git
```

### 3. Check Your Remote (verify it's set up correctly)
```bash
git remote -v
```

## Daily Workflow: Push and Pull

### Pull Changes from GitHub (get latest updates)
```bash
git pull origin main
```
Or if your default branch is `master`:
```bash
git pull origin master
```

### Push Changes to GitHub (upload your changes)

#### Step 1: Check what files have changed
```bash
git status
```

#### Step 2: Add files to staging
Add all changed files:
```bash
git add .
```

Or add specific files:
```bash
git add filename.html
```

#### Step 3: Commit your changes
```bash
git commit -m "Your commit message describing the changes"
```

#### Step 4: Push to GitHub
```bash
git push origin main
```
Or if your default branch is `master`:
```bash
git push origin master
```

## Common Commands Reference

### View current status
```bash
git status
```

### View commit history
```bash
git log
```

### Check which branch you're on
```bash
git branch
```

### Create a new branch
```bash
git checkout -b branch-name
```

### Switch branches
```bash
git checkout branch-name
```

### Update remote URL (if you need to change it)
```bash
git remote set-url origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
```

## Troubleshooting

### If you get "fatal: not a git repository"
Run `git init` first to initialize the repository.

### If you get authentication errors
- Make sure you're logged into GitHub
- Use a Personal Access Token instead of password (GitHub no longer accepts passwords)
- Or set up SSH keys for authentication

### If you get "remote origin already exists"
Remove it first, then add again:
```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
```

### If you need to force push (use with caution!)
```bash
git push origin main --force
```
⚠️ **Warning**: Only use force push if you're sure, as it overwrites remote history.

