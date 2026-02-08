# Claude Code Documentation

This directory contains additional documentation for Claude Code development and troubleshooting.

## Available Guides

### [MCP Schema Troubleshooting](./mcp-schema-troubleshooting.md)

Comprehensive guide for diagnosing and fixing MCP tool schema issues that cause 400 errors when starting Claude Desktop or Claude Code sessions.

**Covers:**
- Common schema validation errors
- Invalid property names in tool definitions
- JSON Schema best practices for MCP tools
- Specific fixes for Twilio and other MCP integrations
- Validation checklist
- Testing procedures

**Related Tools:**
- `scripts/validate-mcp-tool-schema.ts` - Automated schema validator
- `scripts/test-mcp-schema-validator.ts` - Test suite for validator
- `examples/mcp-schema-broken.json` - Example of problematic schema
- `examples/mcp-schema-fixed.json` - Corrected version

## Quick Start: Fixing MCP Schema Issues

If you're experiencing 400 errors with an MCP integration:

1. **Check your Claude Desktop configuration:**
   ```bash
   bash scripts/check-claude-desktop-mcp.sh
   ```

2. **Validate your MCP server's tool schemas:**
   ```bash
   npx tsx scripts/validate-mcp-tool-schema.ts path/to/your/tools.json
   ```

3. **Check for common issues:**
   - `name` property inside `inputSchema` (should only be at tool level)
   - `description` inside `inputSchema` (usually should be at tool level)
   - `inputSchema.type` not set to `"object"`
   - Missing or invalid `properties` definitions

4. **See the troubleshooting guide:**
   - [MCP Schema Troubleshooting Guide](./mcp-schema-troubleshooting.md)

## Available Tools

- **`scripts/check-claude-desktop-mcp.sh`** - Checks Claude Desktop MCP configuration
- **`scripts/validate-mcp-tool-schema.ts`** - Validates MCP tool schemas
- **`scripts/test-mcp-schema-validator.ts`** - Test suite for the validator

## Example: Twilio MCP Schema Fix

**Problem:** Claude Desktop fails to start Code sessions with Twilio integration enabled, returning 400 error.

**Root Cause:** Twilio MCP tools had `name` and `description` properties inside `inputSchema`, which are invalid at that level.

**Before (broken):**
```json
{
  "name": "twilio_send_sms",
  "description": "Send SMS",
  "inputSchema": {
    "name": "twilio_send_sms_input",  // ❌ INVALID
    "description": "SMS parameters",   // ❌ INVALID
    "type": "object",
    "properties": { ... }
  }
}
```

**After (fixed):**
```json
{
  "name": "twilio_send_sms",
  "description": "Send SMS",
  "inputSchema": {
    "type": "object",                 // ✅ Valid
    "properties": { ... }
  }
}
```

See complete examples in:
- `examples/mcp-schema-broken.json` - Demonstrates the issue
- `examples/mcp-schema-fixed.json` - Shows the fix

## Contributing

When adding new documentation:
1. Create a descriptive markdown file in this directory
2. Update this README with a link and summary
3. Add any supporting scripts to `scripts/`
4. Add examples to `examples/` if applicable
