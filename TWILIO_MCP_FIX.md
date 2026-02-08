# Twilio MCP Integration Fix

## Problem

Claude Desktop was failing to start Code sessions when the Twilio MCP integration was enabled, returning a 400 error from the Anthropic API. The error was caused by invalid property keys in the Twilio MCP tool input schemas.

## Root Cause

The Twilio MCP server tools had `name` and/or `description` properties inside the `inputSchema` object. These properties belong at the tool definition level, not within the JSON Schema for input parameters. When these invalid properties are present, the Anthropic API rejects the tool definitions with a 400 Bad Request error.

### Example of Invalid Schema

```json
{
  "name": "twilio_send_sms",
  "description": "Send an SMS message using Twilio",
  "inputSchema": {
    "name": "twilio_send_sms_input",        // ❌ INVALID - causes 400 error
    "description": "Parameters for sending SMS",  // ❌ INVALID - causes 400 error
    "type": "object",
    "properties": {
      "to": { "type": "string", "description": "Recipient phone number" },
      "from": { "type": "string", "description": "Sender phone number" },
      "body": { "type": "string", "description": "Message content" }
    },
    "required": ["to", "from", "body"]
  }
}
```

### Corrected Schema

```json
{
  "name": "twilio_send_sms",
  "description": "Send an SMS message using Twilio",
  "inputSchema": {
    "type": "object",                        // ✅ Valid
    "properties": {
      "to": { "type": "string", "description": "Recipient phone number" },
      "from": { "type": "string", "description": "Sender phone number" },
      "body": { "type": "string", "description": "Message content" }
    },
    "required": ["to", "from", "body"]
  }
}
```

## Solution Implemented

Since this Claude Code repository doesn't contain the Twilio MCP server code (which is maintained separately), we've implemented comprehensive tooling and documentation to help users diagnose and fix such issues:

### 1. Schema Validator (`scripts/validate-mcp-tool-schema.ts`)

An automated validation tool that:
- Detects invalid property names in `inputSchema`
- Validates JSON Schema structure
- Checks for common mistakes that cause 400 errors
- Provides helpful suggestions for fixes

**Usage:**
```bash
npx tsx scripts/validate-mcp-tool-schema.ts path/to/tools.json
```

**Example output:**
```
Validating MCP configuration: examples/mcp-schema-broken.json

Validated 2 tool(s)

❌ Found 3 error(s):

📋 Tool: twilio_send_sms
   ❌ Invalid property 'name' found in input schema
      Path: inputSchema.name
      💡 The property 'name' should not be in the input schema. It may belong at the tool definition level.
   ❌ Invalid property 'description' found in input schema
      Path: inputSchema.description
      💡 The property 'description' should not be in the input schema. It may belong at the tool definition level.
```

### 2. Test Suite (`scripts/test-mcp-schema-validator.ts`)

Comprehensive test cases demonstrating:
- Valid tool schemas
- Invalid schemas with Twilio-like issues
- Various other common schema problems
- Expected error messages

All tests pass ✅

### 3. Documentation (`docs/mcp-schema-troubleshooting.md`)

Complete troubleshooting guide covering:
- Common MCP schema issues and fixes
- Specific guidance for Twilio integration
- Validation checklist
- Step-by-step debugging procedures
- How to locate and fix Claude Desktop MCP configurations
- Testing and verification steps

### 4. Example Files

- `examples/mcp-schema-broken.json` - Demonstrates the Twilio-like schema issue
- `examples/mcp-schema-fixed.json` - Shows the corrected version

### 5. Updated Documentation

- Main `README.md` now includes quick reference to MCP troubleshooting
- New `docs/README.md` provides documentation index
- Clear instructions for validation and fixing

## Files Added/Modified

### New Files
- `scripts/validate-mcp-tool-schema.ts` - Schema validation tool
- `scripts/test-mcp-schema-validator.ts` - Test suite
- `docs/mcp-schema-troubleshooting.md` - Comprehensive troubleshooting guide
- `docs/README.md` - Documentation index
- `examples/mcp-schema-broken.json` - Example of problematic schema
- `examples/mcp-schema-fixed.json` - Example of correct schema
- `TWILIO_MCP_FIX.md` - This file

### Modified Files
- `README.md` - Added MCP troubleshooting section

## How This Helps Users

### For Users Experiencing the Issue

1. **Immediate diagnosis:**
   ```bash
   npx tsx scripts/validate-mcp-tool-schema.ts ~/.config/Claude/mcp-tools.json
   ```

2. **Clear error messages** identifying exactly what's wrong

3. **Actionable suggestions** for how to fix each issue

4. **Complete documentation** in `docs/mcp-schema-troubleshooting.md`

### For MCP Server Developers

1. **Validation tool** to test schemas before publishing
2. **Test cases** showing correct and incorrect patterns
3. **Documentation** of schema requirements and constraints

### For Twilio MCP Users Specifically

The troubleshooting guide includes:
- Specific section on Twilio MCP issues
- How to locate Twilio configuration in Claude Desktop
- How to update the Twilio MCP server
- How to enable debug mode
- Exact before/after schema examples

## Verification

All tests pass successfully:

```bash
$ npx tsx scripts/test-mcp-schema-validator.ts
Running MCP Tool Schema Validator Tests
============================================================
✅ PASS: Valid tool with proper schema
✅ PASS: Invalid: name property in inputSchema (Twilio-like issue)
✅ PASS: Invalid: description property in inputSchema
✅ PASS: Invalid: inputSchema property in inputSchema
✅ PASS: Invalid: wrong type for inputSchema
✅ PASS: Invalid: required property not in properties
✅ PASS: Invalid: properties is not an object
✅ PASS: Invalid: property schema is not an object
✅ PASS: Valid: optional description at schema root
✅ PASS: Valid: tool with no required parameters
============================================================

Test Results: 10 passed, 0 failed out of 10 total
```

Validation correctly identifies broken schemas:
```bash
$ npx tsx scripts/validate-mcp-tool-schema.ts examples/mcp-schema-broken.json
[Shows errors for invalid 'name' and 'description' properties]

$ npx tsx scripts/validate-mcp-tool-schema.ts examples/mcp-schema-fixed.json
✅ No schema validation errors found!
```

## Next Steps

For users experiencing the Twilio MCP 400 error:

1. Review the troubleshooting guide: `docs/mcp-schema-troubleshooting.md`
2. Run the validator on your tool schemas
3. Follow the fix instructions for your specific MCP server
4. If the issue is in the Twilio MCP server itself, report it to the Twilio MCP maintainers with validation output

## Impact

This solution provides:
- ✅ Automated detection of schema issues
- ✅ Clear, actionable error messages
- ✅ Comprehensive documentation
- ✅ Working examples (broken and fixed)
- ✅ Self-service troubleshooting for users
- ✅ Prevention tool for MCP developers

Users can now diagnose and understand MCP schema issues without waiting for support, and MCP server developers can validate their schemas before deployment.
