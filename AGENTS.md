# Agent Instructions

This project uses **GitHub Issues** for issue tracking. Use `gh` CLI for all issue operations.

## Quick Reference

```bash
gh issue list                          # Find available work
gh issue view <number>                 # View issue details
gh issue edit <number> --add-assignee @me  # Claim work
gh issue close <number>                # Complete work
```

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** with file operations to avoid hanging on confirmation prompts.

Shell commands like `cp`, `mv`, and `rm` may be aliased to include `-i` (interactive) mode on some systems, causing the agent to hang indefinitely waiting for y/n input.

**Use these forms instead:**
```bash
# Force overwrite without prompting
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file

# For recursive operations
rm -rf directory            # NOT: rm -r directory
cp -rf source dest          # NOT: cp -r source dest
```

**Other commands that may prompt:**
- `scp` - use `-o BatchMode=yes` for non-interactive
- `ssh` - use `-o BatchMode=yes` to fail instead of prompting
- `apt-get` - use `-y` flag
- `brew` - use `HOMEBREW_NO_AUTO_UPDATE=1` env var

## Issue Tracking with GitHub Issues

**IMPORTANT**: This project uses **GitHub Issues** for ALL issue tracking. Use `gh` CLI for programmatic access.

### Workflow for AI Agents

1. **Check available work**: `gh issue list --assignee @me` or `gh issue list --label "ready"`
2. **Claim a task**: `gh issue edit <number> --add-assignee @me`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create a linked issue:
   ```bash
   gh issue create --title "Found bug" --body "Details about what was found" --label bug
   ```
5. **Complete**: `gh issue close <number> --reason completed`

### Labels

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `chore` - Maintenance (dependencies, tooling)
- `P0-critical` / `P1-high` / `P2-medium` / `P3-low` - Priority levels

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
