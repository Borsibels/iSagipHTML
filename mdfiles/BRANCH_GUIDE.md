# Creating and Working with Branches in Git

## Creating a New Branch

### Method 1: Create and Switch to New Branch (Recommended)
```bash
git checkout -b branch-name
```
This creates a new branch called `branch-name` and switches to it immediately.

### Method 2: Create Branch First, Then Switch
```bash
git branch branch-name        # Create the branch
git checkout branch-name      # Switch to the branch
```

### Method 3: Using `git switch` (Modern Git versions)
```bash
git switch -c branch-name     # Create and switch to new branch
```

## Pushing Your New Branch to GitHub

After creating a branch and making some changes:

### Step 1: Add and commit your changes
```bash
git add .
git commit -m "Your commit message"
```

### Step 2: Push the branch to GitHub (first time)
```bash
git push -u origin branch-name
```
The `-u` flag sets up tracking, so future pushes can just use `git push`.

### Step 3: Future pushes (after setting up tracking)
```bash
git push
```

## Common Branch Operations

### View all branches
```bash
git branch                    # Local branches only
git branch -a                 # All branches (local + remote)
```

### Switch to an existing branch
```bash
git checkout branch-name
# OR (modern way)
git switch branch-name
```

### Switch back to main/master
```bash
git checkout main
# OR
git checkout master
```

### Delete a local branch
```bash
git branch -d branch-name     # Safe delete (only if merged)
git branch -D branch-name     # Force delete (even if not merged)
```

### Delete a remote branch on GitHub
```bash
git push origin --delete branch-name
```

### Rename current branch
```bash
git branch -m new-branch-name
```

## Typical Workflow with Branches

### Example: Working on a new feature

1. **Start from main branch:**
   ```bash
   git checkout main
   git pull origin main        # Get latest changes
   ```

2. **Create feature branch:**
   ```bash
   git checkout -b feature/new-dashboard
   ```

3. **Make your changes** (edit files, etc.)

4. **Commit your changes:**
   ```bash
   git add .
   git commit -m "Add new dashboard feature"
   ```

5. **Push to GitHub:**
   ```bash
   git push -u origin feature/new-dashboard
   ```

6. **Continue working:**
   - Make more changes
   - Commit: `git add .` then `git commit -m "message"`
   - Push: `git push`

7. **When done, merge back to main:**
   ```bash
   git checkout main
   git pull origin main
   git merge feature/new-dashboard
   git push origin main
   ```

## Branch Naming Conventions

Common naming patterns:
- `feature/description` - New features (e.g., `feature/user-authentication`)
- `bugfix/description` - Bug fixes (e.g., `bugfix/login-error`)
- `hotfix/description` - Urgent fixes (e.g., `hotfix/security-patch`)
- `refactor/description` - Code refactoring
- `test/description` - Testing branches

## Viewing Branch Differences

### See what's different between branches
```bash
git diff main..branch-name     # Compare main with your branch
```

### See commits in your branch that aren't in main
```bash
git log main..branch-name
```

## Merging Branches

### Merge a branch into main
```bash
git checkout main
git pull origin main           # Get latest
git merge branch-name          # Merge your branch
git push origin main           # Push merged changes
```

## Creating Branch from GitHub Web Interface

You can also create branches directly on GitHub:
1. Go to your repository on GitHub
2. Click the branch dropdown (usually says "main" or "master")
3. Type a new branch name
4. Click "Create branch: branch-name from main"
5. Then pull it locally:
   ```bash
   git fetch origin
   git checkout branch-name
   ```

