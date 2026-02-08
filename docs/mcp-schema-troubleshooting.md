# MCP Tool Schema Troubleshooting Guide

## Overview

When Claude Desktop or Claude Code fails to start with an MCP integration enabled and returns a 400 error, it's often due to invalid property keys or malformed schemas in the MCP tool definitions.

## Common Issues

### 1. Invalid Property Names in Input Schema

**Problem:** Tool input schemas contain reserved or misplaced property names.

**Example of INVALID schema:**

```json
{
  "name": "send_sms",
  "description": "Send an SMS message",
  "inputSchema": {
    "name": "send_sms_params",          // ❌ INVALID: 'name' shouldn't be here
    "description": "Parameters for SMS", // ⚠️ Usually OK, but can cause issues
    "type": "object",
    "properties": {
      "to": {
        "type": "string",
        "description": "Phone number"
      },
      "message": {
        "type": "string"
      }
    },
    "required": ["to", "message"]
  }
}
```

**Why it fails:**
- The `name` property inside `inputSchema` is invalid. Tool name belongs at the top level, not in the schema.
- This creates ambiguity in the API schema and causes validation to fail with a 400 error.

**Correct schema:**

```json
{
  "name": "send_sms",
  "description": "Send an SMS message",
  "inputSchema": {
    "type": "object",
    "properties": {
      "to": {
        "type": "string",
        "description": "Phone number"
      },
      "message": {
        "type": "string",
        "description": "Message content"
      }
    },
    "required": ["to", "message"]
  }
}
```

### 2. Reserved JSON Schema Keywords

**Properties that should NEVER appear in `inputSchema` root:**
- `name` - belongs at tool level
- `description` - OK at schema root for schema description, but often confused
- `inputSchema` - self-reference creates circular structure
- `outputSchema` - belongs at tool level, not in input schema

**Standard JSON Schema keywords that ARE valid:**
- `type` - should be "object" for tool input
- `properties` - defines parameter structure
- `required` - array of required parameter names
- `additionalProperties` - whether to allow extra properties
- `$schema`, `$id`, `$ref`, `$defs` - standard JSON Schema features

### 3. Type Mismatch

**Problem:** Input schema has wrong type.

**Invalid:**
```json
{
  "inputSchema": {
    "type": "string"  // ❌ Tool inputs must be objects
  }
}
```

**Valid:**
```json
{
  "inputSchema": {
    "type": "object",  // ✅ Always use 'object' for tool parameters
    "properties": {
      // ... parameter definitions
    }
  }
}
```

### 4. Malformed Properties

**Problem:** Properties is not an object or contains invalid values.

**Invalid:**
```json
{
  "inputSchema": {
    "type": "object",
    "properties": "invalid"  // ❌ Must be an object
  }
}
```

**Invalid:**
```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "param1": "string"  // ❌ Must be a schema object
    }
  }
}
```

**Valid:**
```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "param1": {         // ✅ Each property is a schema object
        "type": "string",
        "description": "Parameter description"
      }
    }
  }
}
```

### 5. Required Array Issues

**Problem:** Required references non-existent properties.

**Invalid:**
```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "foo": { "type": "string" }
    },
    "required": ["foo", "bar"]  // ❌ 'bar' not in properties
  }
}
```

**Valid:**
```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "foo": { "type": "string" },
      "bar": { "type": "string" }
    },
    "required": ["foo", "bar"]  // ✅ Both exist in properties
  }
}
```

## Specific Case: Twilio MCP Integration

The Twilio MCP server may have tool definitions with schema issues. Common problems:

1. **Tool name in schema**: Early versions might have included `name` in `inputSchema`
2. **Nested references**: Complex schemas with `$ref` that aren't properly resolved
3. **Additional metadata**: Extra fields that aren't valid JSON Schema

### How to Fix Twilio MCP Issues

1. **Locate the Twilio MCP server configuration:**
   - macOS/Linux: `~/.config/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. **Find the Twilio MCP server entry:**
   ```json
   {
     "mcpServers": {
       "twilio": {
         "command": "npx",
         "args": ["-y", "@modelcontextprotocol/server-twilio"],
         "env": {
           "TWILIO_ACCOUNT_SID": "...",
           "TWILIO_AUTH_TOKEN": "..."
         }
       }
     }
   }
   ```

3. **Check the server version:**
   - Run: `npx @modelcontextprotocol/server-twilio --version`
   - Update if outdated: `npm cache clean --force && npx @modelcontextprotocol/server-twilio`

4. **Enable debug mode:**
   ```json
   {
     "mcpServers": {
       "twilio": {
         "command": "npx",
         "args": ["-y", "@modelcontextprotocol/server-twilio"],
         "env": {
           "TWILIO_ACCOUNT_SID": "...",
           "TWILIO_AUTH_TOKEN": "...",
           "MCP_DEBUG": "true"
         }
       }
     }
   }
   ```

5. **Test with validation script:**
   ```bash
   # If you have access to the tool definitions
   npx tsx scripts/validate-mcp-tool-schema.ts tools.json
   ```

## Validation Checklist

Use this checklist when creating or debugging MCP tool schemas:

- [ ] Tool has `name` property at top level (not in inputSchema)
- [ ] Tool has `description` property at top level
- [ ] `inputSchema.type` is set to `"object"`
- [ ] `inputSchema.properties` is an object with parameter definitions
- [ ] Each property in `properties` is a valid JSON Schema object
- [ ] `inputSchema.required` is an array (if present)
- [ ] All items in `required` array exist in `properties`
- [ ] No reserved keywords appear incorrectly (like `name`, `inputSchema` inside inputSchema)
- [ ] No typos in standard keywords (`properties`, `required`, `type`)

## Quick Configuration Check

Run the configuration checker to diagnose common issues:

```bash
bash scripts/check-claude-desktop-mcp.sh
```

This script will:
- Locate your Claude Desktop configuration file
- Verify it's valid JSON
- List configured MCP servers
- Detect common issues (like Twilio)
- Suggest fixes

## Testing Your MCP Server

1. **Isolate the server:**
   ```bash
   # Test just the Twilio server
   claude --mcp-config twilio-only.json
   ```

2. **Use debug mode:**
   ```bash
   claude --mcp-debug
   ```

3. **Check tool listings:**
   ```bash
   # Start Claude and run:
   /mcp
   ```

4. **Inspect tool schemas:**
   Look for any tools from the problematic server and check their schemas in the `/mcp` output.

## Common Error Messages

### "400 Bad Request"
- Usually indicates invalid schema structure
- Check for reserved keywords in wrong places
- Verify JSON Schema format

### "Tool names must be unique"
- MCP server is exposing duplicate tool names
- Check if `name` appears both at tool level and in schema

### "Invalid input schema"
- Schema doesn't conform to JSON Schema spec
- Check property types and structure

## Getting Help

If you're still experiencing issues:

1. **Check MCP server repository:**
   - Report issue to the MCP server maintainer
   - Include tool schema that's causing the problem

2. **Validate your schema:**
   - Use online JSON Schema validators
   - Use the validation script in this repository

3. **Minimal reproduction:**
   - Disable all other MCP servers
   - Test with only the problematic server
   - Share the tool definition (without secrets)

## Example: Fixed Twilio Tool Schema

**Before (causes 400 error):**
```json
{
  "name": "twilio_send_sms",
  "description": "Send SMS via Twilio",
  "inputSchema": {
    "name": "twilio_send_sms_input",  // ❌ PROBLEM HERE
    "type": "object",
    "properties": {
      "to": { "type": "string" },
      "from": { "type": "string" },
      "body": { "type": "string" }
    },
    "required": ["to", "from", "body"]
  }
}
```

**After (works correctly):**
```json
{
  "name": "twilio_send_sms",
  "description": "Send SMS via Twilio",
  "inputSchema": {
    "type": "object",
    "properties": {
      "to": {
        "type": "string",
        "description": "Recipient phone number in E.164 format"
      },
      "from": {
        "type": "string",
        "description": "Twilio phone number to send from"
      },
      "body": {
        "type": "string",
        "description": "Message content"
      }
    },
    "required": ["to", "from", "body"]
  }
}
```

## References

- [JSON Schema Specification](https://json-schema.org/)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Claude Code MCP Guide](../plugins/plugin-dev/skills/mcp-integration/SKILL.md)
