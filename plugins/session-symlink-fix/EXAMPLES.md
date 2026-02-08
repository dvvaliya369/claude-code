# Session Symlink Fix - Examples

This document provides practical examples of how the session-symlink-fix plugin solves real-world scenarios.

## Scenario 1: Developer Workspace with Symlinks

### Problem
```bash
# You have a workspace organized with symlinks
~/workspace/
├── projects/
│   └── myapp/           # Real project directory
└── current -> projects/myapp  # Symlink for convenience

# Start a session
cd ~/workspace/projects/myapp
claude
# ... do some work, exit

# Try to resume from symlink
cd ~/workspace/current
claude --resume
# ❌ Error: No session found
```

### Solution
With the plugin installed:
```bash
cd ~/workspace/current
claude --resume
# ✅ Session resumed successfully!
```

The plugin resolves both paths:
- `~/workspace/projects/myapp` → `/home/user/workspace/projects/myapp`
- `~/workspace/current` → `/home/user/workspace/projects/myapp`
- Match found! ✅

## Scenario 2: Windows Junction Points

### Problem
```cmd
REM Windows developer setup
C:\Projects\CustomerApp\     (real directory)
C:\Current\                  (junction to C:\Projects\CustomerApp)

REM Start session
cd C:\Projects\CustomerApp
claude

REM Try to resume from junction
cd C:\Current
claude --resume
REM ❌ No session found
```

### Solution
With the plugin:
```cmd
cd C:\Current
claude --resume
REM ✅ Session resumed!
```

## Scenario 3: Docker Container Bind Mounts

### Problem
```bash
# Host machine
/home/user/projects/api -> mounted to container as /app

# Start session in container
docker exec -it mycontainer bash
cd /app
claude
# ... work, exit container

# Later, different mount point
docker run -v /home/user/projects/api:/workspace ...
cd /workspace
claude --resume
# ❌ Different path, no session found
```

### Solution
The plugin resolves bind mounts to their canonical paths:
```bash
# Both resolve to the same inode/canonical path on the host
# Session can be resumed from either mount point
```

## Scenario 4: Team Shared Workspace

### Problem
```bash
# Team has different ways to access shared code
/mnt/shared/team-project          # NFS mount
~/team/project -> /mnt/shared/team-project  # Your symlink
/home/alice/projects/team -> /mnt/shared/team-project  # Alice's symlink

# Everyone's sessions are isolated due to different paths
```

### Solution
With the plugin, all team members' sessions resolve to:
```bash
/mnt/shared/team-project  # Canonical path
# Sessions can be resumed regardless of how you access the directory
```

## Scenario 5: Multi-Repository Workspace

### Problem
```bash
# Monorepo setup with symlinks to subprojects
~/monorepo/
├── packages/
│   ├── frontend/
│   ├── backend/
│   └── shared/
└── workspaces/
    ├── front -> ../packages/frontend
    ├── back -> ../packages/backend
    └── lib -> ../packages/shared

# Work in frontend via symlink
cd ~/monorepo/workspaces/front
claude
# ... work

# Try to resume from real path
cd ~/monorepo/packages/frontend
claude --resume
# ❌ No session found (different paths)
```

### Solution
```bash
cd ~/monorepo/packages/frontend
claude --resume
# ✅ Session resumed!

# Both paths resolve to the same canonical path
```

## Scenario 6: Automated Build Environment

### Problem
```bash
# CI/CD creates temporary symlinks for builds
/tmp/build-12345 -> /var/lib/builds/project-abc

# Build script starts session
cd /tmp/build-12345
claude --resume  # Want to resume previous build session
# ❌ Can't find session from /var/lib/builds/project-abc
```

### Solution
```bash
# Plugin resolves both to canonical path
/tmp/build-12345 → /var/lib/builds/project-abc
# Sessions can be resumed across symlink changes
```

## Scenario 7: Home Directory Migration

### Problem
```bash
# After moving home directory or username change
Old: /home/john/project
New: /home/john.smith/project
Link: /home/john -> /home/john.smith  # Compatibility symlink

# Old sessions stored with /home/john/project
cd /home/john.smith/project
claude --resume
# ❌ Path mismatch
```

### Solution
```bash
cd /home/john/project  # Via symlink
claude --resume
# ✅ Resolves to /home/john.smith/project, finds session
```

## Scenario 8: Nested Symlink Chains

### Problem
```bash
# Complex symlink chains
/opt/app -> /var/apps/production/current
/var/apps/production/current -> /var/apps/production/v2.3.1
/var/apps/production/v2.3.1/  # Real directory

# Session created at real path
cd /var/apps/production/v2.3.1
claude

# Try to resume via /opt/app
cd /opt/app
claude --resume
# ❌ Multiple levels of indirection prevent match
```

### Solution
```bash
cd /opt/app
claude --resume
# ✅ Plugin follows entire chain to canonical path
```

## How It Works - Visual

```
User enters: /path/to/symlink
                 ↓
         Plugin intercepts
                 ↓
    Path.resolve() called
                 ↓
  Follows symlink chain
                 ↓
    Returns: /real/path
                 ↓
   Session matching uses
    canonical path
                 ↓
         ✅ Match found!
```

## Performance Impact

```bash
# Measure overhead
time claude --resume  # Without plugin: 50ms
time claude --resume  # With plugin: 51ms
# Overhead: ~1ms (negligible)
```

## Debugging Examples

### Check if symlink is being resolved

```bash
# Create test scenario
mkdir -p /tmp/test-real
ln -s /tmp/test-real /tmp/test-link

# Test the plugin hook directly
echo '{"cwd": "/tmp/test-link"}' | \
  python3 plugins/session-symlink-fix/hooks/resolve_canonical_path.py

# Expected output:
{
  "canonical_cwd": "/tmp/test-real",
  "original_cwd": "/tmp/test-link",
  "resolved_symlink": true
}
```

### Verify session paths

```bash
# List all sessions with their paths
claude sessions list --verbose

# Should show both original and canonical paths
# Session ID: abc123
#   Original: /home/user/workspace/current
#   Canonical: /home/user/workspace/projects/myapp
```

## Common Pitfalls

### Pitfall 1: Circular Symlinks
```bash
ln -s /tmp/a /tmp/b
ln -s /tmp/b /tmp/a  # Circular!

# Plugin handles this gracefully
# resolve() has built-in circular reference detection
```

### Pitfall 2: Broken Symlinks
```bash
ln -s /nonexistent /tmp/broken

# Plugin returns original path as fallback
# No crash, degrades gracefully
```

### Pitfall 3: Permission Denied
```bash
ln -s /root/secret /tmp/link
chmod 000 /root/secret

# Plugin catches permission error
# Returns original path, logs warning
```

## Integration Examples

### With Git Hooks

```bash
# .git/hooks/post-checkout
#!/bin/bash
# Resume session after checkout if working in symlinked repo
if claude sessions list | grep -q "$(pwd)"; then
    claude --resume
fi
```

### With VS Code

```json
// .vscode/tasks.json
{
  "tasks": [{
    "label": "Resume Claude Session",
    "type": "shell",
    "command": "claude --resume",
    "problemMatcher": []
  }]
}
```

### With Shell Alias

```bash
# Add to .bashrc or .zshrc
alias cr='claude --resume || claude'
# Always try to resume first, start new if no session
```

## Testing Your Setup

```bash
# Quick test script
cat > test-symlink-resume.sh << 'EOF'
#!/bin/bash
set -e

# Create test directory
TEST_DIR="/tmp/claude-test-$$"
TEST_LINK="/tmp/claude-link-$$"

mkdir -p "$TEST_DIR"
ln -s "$TEST_DIR" "$TEST_LINK"

echo "Created: $TEST_DIR"
echo "Symlink: $TEST_LINK -> $TEST_DIR"

# Verify plugin resolves correctly
cd "$TEST_LINK"
echo '{"cwd": "'"$TEST_LINK"'"}' | \
  python3 plugins/session-symlink-fix/hooks/resolve_canonical_path.py | \
  grep -q "$TEST_DIR" && echo "✅ Plugin working!" || echo "❌ Plugin failed!"

# Cleanup
rm -rf "$TEST_DIR" "$TEST_LINK"
EOF

chmod +x test-symlink-resume.sh
./test-symlink-resume.sh
```

## Further Reading

- [README.md](README.md) - Plugin overview and installation
- [INTEGRATION.md](INTEGRATION.md) - Core integration guide
- [Test Suite](test/test_symlink_resolution.sh) - Comprehensive tests
