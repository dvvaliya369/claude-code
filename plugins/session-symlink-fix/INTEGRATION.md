# Integration Guide for Session Symlink Fix

This document explains how to integrate the session-symlink-fix plugin functionality into Claude Code's core session management.

## Current Issue

Claude Code performs strict string comparison on directory paths when resuming sessions. This fails when:

- The same directory is accessed via different paths (symlinks)
- Windows junction points are used
- Network mounts have multiple path representations
- Docker/container bind mounts expose different paths

## Plugin Implementation

The current plugin solution uses a `SessionStart` hook to resolve paths, but this is a workaround. The proper fix should be in the core session management code.

## Recommended Core Integration

### 1. Session Identifier Resolution

**Location**: Session creation/lookup code (likely in Rust core)

**Current behavior**:
```rust
// Pseudo-code - current implementation
fn get_session_id(cwd: &Path) -> String {
    // Uses path directly as string
    format!("session_{}", cwd.display())
}
```

**Fixed behavior**:
```rust
use std::fs;

fn get_session_id(cwd: &Path) -> String {
    // Resolve to canonical path first
    let canonical = resolve_canonical_path(cwd);
    format!("session_{}", canonical.display())
}

fn resolve_canonical_path(path: &Path) -> PathBuf {
    match fs::canonicalize(path) {
        Ok(canonical) => canonical,
        Err(_) => {
            // Fallback to original path if canonicalize fails
            // This handles non-existent paths gracefully
            path.to_path_buf()
        }
    }
}
```

### 2. Session Resume Logic

**Location**: Session resume/lookup code

**Current behavior**:
```rust
// Pseudo-code - current implementation
fn find_session(cwd: &Path, sessions: &[Session]) -> Option<&Session> {
    sessions.iter().find(|s| s.working_dir == cwd)
}
```

**Fixed behavior**:
```rust
fn find_session(cwd: &Path, sessions: &[Session]) -> Option<&Session> {
    let canonical_cwd = resolve_canonical_path(cwd);
    
    sessions.iter().find(|s| {
        let session_canonical = resolve_canonical_path(&s.working_dir);
        session_canonical == canonical_cwd
    })
}
```

### 3. Session Metadata Storage

**Current**: Store only the original path

**Recommended**: Store both original and canonical paths

```rust
struct SessionMetadata {
    original_cwd: PathBuf,
    canonical_cwd: PathBuf,
    created_at: SystemTime,
    // ... other fields
}

impl SessionMetadata {
    fn new(cwd: &Path) -> Self {
        Self {
            original_cwd: cwd.to_path_buf(),
            canonical_cwd: resolve_canonical_path(cwd),
            created_at: SystemTime::now(),
        }
    }
    
    fn matches_directory(&self, cwd: &Path) -> bool {
        let canonical_cwd = resolve_canonical_path(cwd);
        self.canonical_cwd == canonical_cwd
    }
}
```

## Cross-Platform Considerations

### Linux/macOS
- Use `std::fs::canonicalize()` which follows symlinks
- Handles regular symlinks and hard links
- Returns absolute path with all symbolic links resolved

### Windows
- `std::fs::canonicalize()` also works for:
  - Symbolic links (requires admin or dev mode)
  - Junction points (doesn't require admin)
  - Hard links
- Returns UNC path on Windows (`\\?\C:\...`)
- May need to strip UNC prefix for display

### Edge Cases

```rust
fn resolve_canonical_path_cross_platform(path: &Path) -> PathBuf {
    match fs::canonicalize(path) {
        Ok(canonical) => {
            #[cfg(windows)]
            {
                // Strip Windows UNC prefix if present
                // \\?\C:\path -> C:\path
                strip_unc_prefix(&canonical)
            }
            
            #[cfg(not(windows))]
            canonical
        }
        Err(_) => {
            // If canonicalize fails (e.g., path doesn't exist),
            // fall back to absolute path without resolving symlinks
            path.canonicalize().unwrap_or_else(|_| {
                std::env::current_dir()
                    .unwrap_or_default()
                    .join(path)
            })
        }
    }
}

#[cfg(windows)]
fn strip_unc_prefix(path: &Path) -> PathBuf {
    path.to_string_lossy()
        .strip_prefix(r"\\?\")
        .map(PathBuf::from)
        .unwrap_or_else(|| path.to_path_buf())
}
```

## Performance Impact

- `fs::canonicalize()` is a syscall but very fast (< 1ms typically)
- Only called during session start/resume (not hot path)
- Can cache canonical paths in session metadata
- Negligible impact on overall session startup time

## Testing Strategy

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    
    #[test]
    fn test_symlink_resolution() {
        let temp_dir = tempdir().unwrap();
        let real_path = temp_dir.path().join("real");
        let link_path = temp_dir.path().join("link");
        
        fs::create_dir(&real_path).unwrap();
        
        #[cfg(unix)]
        std::os::unix::fs::symlink(&real_path, &link_path).unwrap();
        
        #[cfg(windows)]
        std::os::windows::fs::symlink_dir(&real_path, &link_path).unwrap();
        
        let canonical_real = resolve_canonical_path(&real_path);
        let canonical_link = resolve_canonical_path(&link_path);
        
        assert_eq!(canonical_real, canonical_link);
    }
    
    #[test]
    fn test_nonexistent_path() {
        let path = PathBuf::from("/nonexistent/path");
        let canonical = resolve_canonical_path(&path);
        // Should not panic, returns fallback path
        assert!(!canonical.to_string_lossy().is_empty());
    }
    
    #[test]
    fn test_nested_symlinks() {
        let temp_dir = tempdir().unwrap();
        let real_path = temp_dir.path().join("real");
        let link1 = temp_dir.path().join("link1");
        let link2 = temp_dir.path().join("link2");
        
        fs::create_dir(&real_path).unwrap();
        
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(&real_path, &link1).unwrap();
            std::os::unix::fs::symlink(&link1, &link2).unwrap();
        }
        
        let canonical = resolve_canonical_path(&link2);
        assert_eq!(canonical, fs::canonicalize(&real_path).unwrap());
    }
}
```

### Integration Tests

1. Create session from real path, resume from symlink
2. Create session from symlink, resume from real path
3. Multiple symlinks to same directory all resolve to same session
4. Junction points on Windows work correctly
5. Relative paths through symlinks resolve correctly

## Migration Strategy

### Phase 1: Add Canonical Path Resolution (Non-Breaking)
- Add `canonical_cwd` to session metadata
- Keep using `original_cwd` for matching (backward compatible)
- Log when paths differ for monitoring

### Phase 2: Use Canonical Path for Matching
- Switch session matching to use `canonical_cwd`
- Keep `original_cwd` for display purposes
- Old sessions without `canonical_cwd` compute it on-demand

### Phase 3: Deprecate Plugin
- Once core fix is released, mark plugin as deprecated
- Plugin becomes no-op for new versions
- Remove after 2-3 version cycles

## Related Code Locations

Based on the CHANGELOG analysis, session logic likely touches:

1. **Session creation/start** - Where `SessionStart` hooks fire
2. **Session resume** - Command-line argument parsing for `--resume`
3. **Session picker** - UI for selecting sessions to resume
4. **Session storage** - File-based or database storage of session metadata
5. **VSCode integration** - Remote session resume functionality

## Benefits of Core Integration

1. **Performance**: No hook overhead, direct path resolution
2. **Reliability**: Works even if plugin system has issues
3. **Simplicity**: No external dependencies or configuration needed
4. **Consistency**: All session operations use same path resolution
5. **Future-proof**: Foundation for other path-related improvements

## Alternative: Hybrid Approach

If core changes are not feasible immediately:

1. Keep the plugin as a workaround
2. Add core path normalization in parallel
3. Gradually migrate to core implementation
4. Plugin detects core support and disables itself

## References

- Rust `std::fs::canonicalize`: https://doc.rust-lang.org/std/fs/fn.canonicalize.html
- Python `Path.resolve()`: https://docs.python.org/3/library/pathlib.html#pathlib.Path.resolve
- Windows junction points: https://docs.microsoft.com/en-us/windows/win32/fileio/hard-links-and-junctions
