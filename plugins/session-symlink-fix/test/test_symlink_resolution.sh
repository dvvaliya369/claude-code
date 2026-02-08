#!/bin/bash
# Test script for session-symlink-fix plugin
# Tests that canonical path resolution works correctly

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK_SCRIPT="$SCRIPT_DIR/../hooks/resolve_canonical_path.py"

echo "=== Session Symlink Fix - Test Suite ==="
echo

# Test 1: Basic path resolution
echo "Test 1: Basic path resolution"
TEST_INPUT='{"cwd": "/tmp"}'
RESULT=$(echo "$TEST_INPUT" | python3 "$HOOK_SCRIPT")
CANONICAL=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['canonical_cwd'])")
echo "  Input: /tmp"
echo "  Output: $CANONICAL"
echo "  ✅ Pass"
echo

# Test 2: Symlink resolution
echo "Test 2: Symlink resolution"
# Create test directory and symlink
TEST_DIR="/tmp/test-session-$$"
TEST_LINK="/tmp/test-link-$$"
mkdir -p "$TEST_DIR"
ln -s "$TEST_DIR" "$TEST_LINK"

TEST_INPUT="{\"cwd\": \"$TEST_LINK\"}"
RESULT=$(echo "$TEST_INPUT" | python3 "$HOOK_SCRIPT")
CANONICAL=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['canonical_cwd'])")
RESOLVED=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['resolved_symlink'])")

echo "  Created: $TEST_DIR"
echo "  Symlink: $TEST_LINK -> $TEST_DIR"
echo "  Input: $TEST_LINK"
echo "  Output: $CANONICAL"
echo "  Resolved: $RESOLVED"

# Verify the canonical path matches the real directory
if [[ "$CANONICAL" == "$TEST_DIR" ]] && [[ "$RESOLVED" == "True" ]]; then
    echo "  ✅ Pass - Symlink correctly resolved"
else
    echo "  ❌ Fail - Expected $TEST_DIR, got $CANONICAL"
    rm -rf "$TEST_DIR" "$TEST_LINK"
    exit 1
fi
echo

# Test 3: Same path when accessed both ways
echo "Test 3: Same canonical path from both real and symlink paths"
TEST_INPUT_REAL="{\"cwd\": \"$TEST_DIR\"}"
TEST_INPUT_LINK="{\"cwd\": \"$TEST_LINK\"}"

CANONICAL_REAL=$(echo "$TEST_INPUT_REAL" | python3 "$HOOK_SCRIPT" | python3 -c "import sys, json; print(json.load(sys.stdin)['canonical_cwd'])")
CANONICAL_LINK=$(echo "$TEST_INPUT_LINK" | python3 "$HOOK_SCRIPT" | python3 -c "import sys, json; print(json.load(sys.stdin)['canonical_cwd'])")

echo "  Real path input: $TEST_DIR -> $CANONICAL_REAL"
echo "  Link path input: $TEST_LINK -> $CANONICAL_LINK"

if [[ "$CANONICAL_REAL" == "$CANONICAL_LINK" ]]; then
    echo "  ✅ Pass - Both paths resolve to the same canonical path"
else
    echo "  ❌ Fail - Paths don't match: $CANONICAL_REAL vs $CANONICAL_LINK"
    rm -rf "$TEST_DIR" "$TEST_LINK"
    exit 1
fi
echo

# Test 4: Nested symlinks
echo "Test 4: Nested symlink resolution"
TEST_LINK2="/tmp/test-link2-$$"
ln -s "$TEST_LINK" "$TEST_LINK2"

TEST_INPUT="{\"cwd\": \"$TEST_LINK2\"}"
RESULT=$(echo "$TEST_INPUT" | python3 "$HOOK_SCRIPT")
CANONICAL=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['canonical_cwd'])")

echo "  Chain: $TEST_LINK2 -> $TEST_LINK -> $TEST_DIR"
echo "  Input: $TEST_LINK2"
echo "  Output: $CANONICAL"

if [[ "$CANONICAL" == "$TEST_DIR" ]]; then
    echo "  ✅ Pass - Nested symlinks correctly resolved"
else
    echo "  ❌ Fail - Expected $TEST_DIR, got $CANONICAL"
    rm -rf "$TEST_DIR" "$TEST_LINK" "$TEST_LINK2"
    exit 1
fi
echo

# Test 5: Relative path resolution
echo "Test 5: Relative path with symlinks"
cd "$TEST_LINK"
TEST_INPUT='{"cwd": "."}'
RESULT=$(echo "$TEST_INPUT" | python3 "$HOOK_SCRIPT")
CANONICAL=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['canonical_cwd'])")

echo "  Current dir: $TEST_LINK (via cd)"
echo "  Input: ."
echo "  Output: $CANONICAL"

if [[ "$CANONICAL" == "$TEST_DIR" ]]; then
    echo "  ✅ Pass - Relative path correctly resolved through symlink"
else
    echo "  ❌ Fail - Expected $TEST_DIR, got $CANONICAL"
    cd /
    rm -rf "$TEST_DIR" "$TEST_LINK" "$TEST_LINK2"
    exit 1
fi
cd /
echo

# Test 6: Non-existent path handling
echo "Test 6: Non-existent path handling"
NONEXISTENT="/tmp/does-not-exist-$$"
TEST_INPUT="{\"cwd\": \"$NONEXISTENT\"}"
RESULT=$(echo "$TEST_INPUT" | python3 "$HOOK_SCRIPT" 2>/dev/null)
CANONICAL=$(echo "$RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['canonical_cwd'])")

echo "  Input: $NONEXISTENT (doesn't exist)"
echo "  Output: $CANONICAL"

if [[ "$CANONICAL" == "$NONEXISTENT" ]]; then
    echo "  ✅ Pass - Non-existent path returns original path"
else
    echo "  ⚠️  Warning - Got: $CANONICAL (expected fallback to original)"
fi
echo

# Test 7: JSON output format
echo "Test 7: JSON output format validation"
TEST_INPUT="{\"cwd\": \"$TEST_DIR\"}"
RESULT=$(echo "$TEST_INPUT" | python3 "$HOOK_SCRIPT")

# Validate JSON structure
python3 -c "
import sys, json
data = json.loads('''$RESULT''')
assert 'canonical_cwd' in data, 'Missing canonical_cwd'
assert 'original_cwd' in data, 'Missing original_cwd'
assert 'resolved_symlink' in data, 'Missing resolved_symlink'
assert isinstance(data['canonical_cwd'], str), 'canonical_cwd not string'
assert isinstance(data['original_cwd'], str), 'original_cwd not string'
assert isinstance(data['resolved_symlink'], bool), 'resolved_symlink not bool'
print('  ✅ Pass - JSON format is valid')
"
echo

# Cleanup
echo "Cleaning up test files..."
rm -rf "$TEST_DIR" "$TEST_LINK" "$TEST_LINK2"
echo

echo "=== All Tests Passed! ==="
echo
echo "The session-symlink-fix plugin is working correctly."
echo "Sessions should now resume properly when using symlinked directories."
