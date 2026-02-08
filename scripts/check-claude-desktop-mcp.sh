#!/bin/bash
# Check Claude Desktop MCP Configuration
# Helps users diagnose MCP schema issues in their Claude Desktop configuration

set -e

echo "🔍 Claude Desktop MCP Configuration Checker"
echo "==========================================="
echo ""

# Detect OS and set config path
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CONFIG_PATH="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    CONFIG_PATH="$HOME/.config/Claude/claude_desktop_config.json"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows (Git Bash or similar)
    CONFIG_PATH="$APPDATA/Claude/claude_desktop_config.json"
else
    echo "❌ Unsupported operating system: $OSTYPE"
    echo "Please manually check your Claude Desktop config file."
    exit 1
fi

echo "📁 Configuration file: $CONFIG_PATH"
echo ""

# Check if config file exists
if [ ! -f "$CONFIG_PATH" ]; then
    echo "⚠️  Claude Desktop configuration file not found."
    echo ""
    echo "Expected location: $CONFIG_PATH"
    echo ""
    echo "This could mean:"
    echo "  - Claude Desktop is not installed"
    echo "  - Configuration hasn't been created yet"
    echo "  - Configuration is in a different location"
    echo ""
    echo "To create a configuration, add an MCP server in Claude Desktop settings."
    exit 0
fi

echo "✅ Configuration file found"
echo ""

# Check if file is valid JSON
if ! jq empty "$CONFIG_PATH" 2>/dev/null; then
    echo "❌ Configuration file is not valid JSON"
    echo ""
    echo "Please check the file for syntax errors:"
    echo "  $CONFIG_PATH"
    exit 1
fi

echo "✅ Configuration is valid JSON"
echo ""

# Check for MCP servers
MCP_SERVERS=$(jq -r '.mcpServers // {} | keys | length' "$CONFIG_PATH")

if [ "$MCP_SERVERS" -eq 0 ]; then
    echo "ℹ️  No MCP servers configured"
    echo ""
    echo "To add MCP servers, edit:"
    echo "  $CONFIG_PATH"
    exit 0
fi

echo "📊 Found $MCP_SERVERS MCP server(s) configured:"
echo ""

# List configured servers
jq -r '.mcpServers // {} | keys[]' "$CONFIG_PATH" | while read -r server; do
    echo "  • $server"
done

echo ""
echo "🔍 Checking for common configuration issues..."
echo ""

# Check for Twilio
if jq -e '.mcpServers.twilio' "$CONFIG_PATH" >/dev/null 2>&1; then
    echo "📱 Twilio MCP server detected"
    echo ""
    echo "   If you're experiencing 400 errors, this is likely the cause."
    echo "   The Twilio MCP server may have schema issues."
    echo ""
    echo "   To fix:"
    echo "   1. Update the Twilio MCP server:"
    echo "      npm cache clean --force"
    echo "      npx @modelcontextprotocol/server-twilio"
    echo ""
    echo "   2. Or temporarily disable Twilio to test:"
    echo "      Edit $CONFIG_PATH"
    echo "      Remove or comment out the 'twilio' entry"
    echo ""
    echo "   3. See full troubleshooting guide:"
    echo "      docs/mcp-schema-troubleshooting.md"
    echo ""
fi

# Check for missing environment variables (common issue)
MISSING_VARS=0
jq -r '.mcpServers // {} | to_entries[] | select(.value.env) | .key + "|" + (.value.env | keys | join(","))' "$CONFIG_PATH" | while IFS='|' read -r server vars; do
    IFS=',' read -ra VAR_ARRAY <<< "$vars"
    for var in "${VAR_ARRAY[@]}"; do
        # Check if variable looks like it should be set (not a literal value)
        if [[ ! -v $var ]]; then
            if [ "$MISSING_VARS" -eq 0 ]; then
                echo "⚠️  Potentially missing environment variables:"
                echo ""
                MISSING_VARS=1
            fi
            echo "   $server requires: $var"
        fi
    done
done

if [ "$MISSING_VARS" -eq 1 ]; then
    echo ""
    echo "   Note: These variables may be set in the config or not required."
    echo "   Check your server documentation."
    echo ""
fi

echo "✅ Basic configuration check complete"
echo ""
echo "📚 For detailed troubleshooting, see:"
echo "   docs/mcp-schema-troubleshooting.md"
echo ""
echo "🔧 To validate tool schemas, you'll need access to the MCP server's"
echo "   tool definitions. Contact the server maintainer if issues persist."
