#!/usr/bin/env python3
"""
Session Symlink Fix Hook
Resolves the working directory to its canonical path for session resume.

This hook ensures that sessions can be resumed correctly when the working 
directory is accessed via symlinks or Windows junction points by storing 
the canonical (real) path.
"""

import sys
import os
import json
from pathlib import Path


def resolve_canonical_path(cwd):
    """
    Resolve a directory path to its canonical form.
    
    Handles:
    - Symlinks (Linux/macOS)
    - Junction points (Windows)
    - Relative paths
    - Path normalization
    
    Args:
        cwd: Current working directory path
        
    Returns:
        Canonical absolute path
    """
    try:
        # Convert to Path object for cross-platform handling
        path = Path(cwd)
        
        # Resolve symlinks and make absolute
        # .resolve() follows symlinks and normalizes the path
        canonical = path.resolve(strict=True)
        
        return str(canonical)
    except (OSError, RuntimeError) as e:
        # If path doesn't exist or can't be resolved, return original
        # This maintains backward compatibility
        print(f"Warning: Could not resolve canonical path for {cwd}: {e}", file=sys.stderr)
        return cwd


def main():
    """
    Main hook entry point.
    
    Reads SessionStart hook input, resolves the working directory to its
    canonical path, and outputs metadata for Claude Code to use in session
    tracking.
    """
    try:
        # Read hook input from stdin
        hook_input = sys.stdin.read()
        
        if not hook_input:
            print("Error: No input received", file=sys.stderr)
            sys.exit(1)
        
        # Parse JSON input
        try:
            data = json.loads(hook_input)
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
            sys.exit(1)
        
        # Extract current working directory
        # SessionStart hooks receive session metadata
        cwd = data.get('cwd') or os.getcwd()
        
        # Resolve to canonical path
        canonical_cwd = resolve_canonical_path(cwd)
        
        # Output the canonical path as metadata
        # This allows Claude Code to use the resolved path for session matching
        output = {
            "canonical_cwd": canonical_cwd,
            "original_cwd": cwd,
            "resolved_symlink": canonical_cwd != cwd
        }
        
        # Print to stdout for Claude Code to capture
        print(json.dumps(output, indent=2))
        
        # Log to stderr for debugging (visible in logs)
        if canonical_cwd != cwd:
            print(f"Resolved symlink: {cwd} -> {canonical_cwd}", file=sys.stderr)
        
        sys.exit(0)
        
    except Exception as e:
        print(f"Error in session symlink fix hook: {e}", file=sys.stderr)
        # Exit 0 to not block session start on hook failure
        sys.exit(0)


if __name__ == "__main__":
    main()
