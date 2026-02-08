# Quick Fix Guide: Twilio MCP 400 Error

> **TL;DR:** The Twilio MCP server has invalid schema properties. Use our tools to diagnose and fix.

## 🚨 Symptoms

- Claude Desktop fails to start Code sessions
- 400 Bad Request error from API
- Twilio MCP integration is enabled

## 🔧 Quick Fix (5 minutes)

### Option 1: Check Your Configuration

```bash
bash scripts/check-claude-desktop-mcp.sh
```

This will:
- Find your Claude Desktop config
- Identify if Twilio is the problem
- Suggest fixes

### Option 2: Validate Tool Schemas

If you have access to tool definitions:

```bash
npx tsx scripts/validate-mcp-tool-schema.ts path/to/tools.json
```

### Option 3: Temporary Workaround

Disable Twilio temporarily:

**macOS/Linux:**
```bash
# Edit: ~/Library/Application Support/Claude/claude_desktop_config.json
# or: ~/.config/Claude/claude_desktop_config.json
```

**Windows:**
```powershell
# Edit: %APPDATA%\Claude\claude_desktop_config.json
```

Remove or comment out the `twilio` entry:
```json
{
  "mcpServers": {
    // "twilio": { ... }  // Disabled temporarily
  }
}
```

## 🎯 The Problem

The Twilio MCP tools have this **invalid** schema:

```json
{
  "name": "twilio_send_sms",
  "inputSchema": {
    "name": "twilio_send_sms_input",  // ❌ WRONG: causes 400 error
    "type": "object",
    "properties": { ... }
  }
}
```

Should be this **valid** schema:

```json
{
  "name": "twilio_send_sms",
  "inputSchema": {
    "type": "object",                 // ✅ CORRECT
    "properties": { ... }
  }
}
```

## 📚 Full Documentation

- **Comprehensive Guide:** [docs/mcp-schema-troubleshooting.md](./docs/mcp-schema-troubleshooting.md)
- **Technical Details:** [TWILIO_MCP_FIX.md](./TWILIO_MCP_FIX.md)
- **Implementation:** [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)

## 🛠️ Available Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| **Config Checker** | Find MCP config issues | `bash scripts/check-claude-desktop-mcp.sh` |
| **Schema Validator** | Validate tool schemas | `npx tsx scripts/validate-mcp-tool-schema.ts tools.json` |
| **Test Suite** | Verify validator works | `npx tsx scripts/test-mcp-schema-validator.ts` |

## ✅ Expected Results

**Broken schema detected:**
```
❌ Found 3 error(s):
📋 Tool: twilio_send_sms
   ❌ Invalid property 'name' found in input schema
      💡 The property 'name' should not be in the input schema.
```

**Fixed schema validated:**
```
✅ No schema validation errors found!
```

## 🎓 Examples

- **Broken:** [examples/mcp-schema-broken.json](./examples/mcp-schema-broken.json)
- **Fixed:** [examples/mcp-schema-fixed.json](./examples/mcp-schema-fixed.json)

## 🆘 Still Having Issues?

1. Read the [full troubleshooting guide](./docs/mcp-schema-troubleshooting.md)
2. Check if your Twilio MCP server is up to date
3. Enable debug mode: Add `"MCP_DEBUG": "true"` to env in config
4. Report to Twilio MCP server maintainers with validation output

## 💡 Prevention

MCP server developers: Validate your schemas before publishing!

```bash
npx tsx scripts/validate-mcp-tool-schema.ts your-tools.json
```

---

**Quick Links:**
- [Troubleshooting Guide](./docs/mcp-schema-troubleshooting.md)
- [Technical Fix Details](./TWILIO_MCP_FIX.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
