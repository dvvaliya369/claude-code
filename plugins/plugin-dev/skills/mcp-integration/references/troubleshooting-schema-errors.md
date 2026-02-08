# Troubleshooting MCP Tool Schema Errors

## Overview

This guide helps diagnose and fix schema validation errors that prevent Claude Desktop from starting Code sessions when MCP servers are enabled.

## Common Error: Invalid Property Key in Input Schema

### Symptom

Claude Desktop fails to start any Code session with a specific MCP integration enabled, returning a 400 error:

```
Error: Failed to start session
Status: 400 Bad Request
Cause: Invalid property key in tool input schema
```

### Root Cause

MCP tool input schemas must follow JSON Schema specifications. Property keys (field names) in the schema must be valid identifiers.

### Valid Property Key Rules

Property keys in MCP tool input schemas must:

1. **Start with a letter or underscore** (not a number)
2. **Contain only alphanumeric characters, underscores, or hyphens**
3. **Not contain spaces**
4. **Not contain special characters** (except `-` and `_`)

### Examples

**Valid property keys:**
```json
{
  "properties": {
    "phone_number": { "type": "string" },
    "user-id": { "type": "string" },
    "accountSid": { "type": "string" },
    "to_number": { "type": "string" },
    "message_body": { "type": "string" }
  }
}
```

**Invalid property keys:**
```json
{
  "properties": {
    "phone number": { "type": "string" },      // ❌ Contains space
    "123-account": { "type": "string" },       // ❌ Starts with number
    "user@email": { "type": "string" },        // ❌ Contains @
    "message.body": { "type": "string" },      // ❌ Contains dot
    "to#number": { "type": "string" }          // ❌ Contains #
  }
}
```

## Diagnosing the Issue

### Step 1: Identify the Problematic MCP Server

1. List all configured MCP servers:
   ```bash
   claude mcp list
   ```

2. Disable MCP servers one by one to identify which causes the error:
   ```bash
   claude mcp disable <server-name>
   ```

3. Try starting a Code session after each disable

4. The server that, when disabled, allows sessions to start is the problematic one

### Step 2: Inspect the Tool Schema

1. Get the tool list from the problematic server:
   ```bash
   claude mcp get <server-name>
   ```

2. Look for tools with invalid property keys in their `inputSchema.properties`

3. Common culprits in Twilio MCP server:
   - `"From Number"` → should be `"from_number"` or `"fromNumber"`
   - `"To Number"` → should be `"to_number"` or `"toNumber"`
   - `"Message Body"` → should be `"message_body"` or `"messageBody"`
   - `"Account SID"` → should be `"account_sid"` or `"accountSid"`

### Step 3: Check MCP Server Configuration

If you're using a custom or third-party MCP server, check its configuration file or source code for the tool definitions.

**Example problematic Twilio tool schema:**
```json
{
  "name": "send_sms",
  "description": "Send an SMS message",
  "inputSchema": {
    "type": "object",
    "properties": {
      "To Number": {              // ❌ Invalid: contains space
        "type": "string"
      },
      "From Number": {            // ❌ Invalid: contains space
        "type": "string"
      },
      "Message Body": {           // ❌ Invalid: contains space
        "type": "string"
      }
    }
  }
}
```

## Fixing the Issue

### Option 1: Update MCP Server (Recommended)

If you control the MCP server source code:

1. Locate the tool definition file
2. Rename property keys to valid identifiers:

**Before:**
```python
# In your MCP server code
tool_schema = {
    "properties": {
        "To Number": {"type": "string"},
        "From Number": {"type": "string"},
        "Message Body": {"type": "string"}
    }
}
```

**After:**
```python
tool_schema = {
    "properties": {
        "to_number": {"type": "string"},
        "from_number": {"type": "string"},
        "message_body": {"type": "string"}
    }
}
```

3. Restart the MCP server
4. Restart Claude Desktop

### Option 2: Use a Different MCP Server

If using a third-party MCP server with invalid schemas:

1. Check if there's an updated version:
   ```bash
   npm update @twilio/mcp-server  # Example
   ```

2. Look for alternative Twilio MCP servers with valid schemas

3. Report the issue to the MCP server maintainer

### Option 3: Create a Wrapper MCP Server

If you can't modify the original server, create a wrapper that fixes the schema:

```javascript
// wrapper-server.js
import { TwilioMCPServer } from '@twilio/mcp-server';

class FixedTwilioServer extends TwilioMCPServer {
  async listTools() {
    const tools = await super.listTools();
    
    // Fix invalid property keys
    return tools.map(tool => {
      if (tool.inputSchema?.properties) {
        const fixedProperties = {};
        for (const [key, value] of Object.entries(tool.inputSchema.properties)) {
          // Replace spaces with underscores, convert to lowercase
          const fixedKey = key.toLowerCase().replace(/\s+/g, '_');
          fixedProperties[fixedKey] = value;
        }
        tool.inputSchema.properties = fixedProperties;
      }
      return tool;
    });
  }
}

// Start the wrapper server
const server = new FixedTwilioServer();
server.start();
```

Configure Claude to use the wrapper:
```json
{
  "twilio-fixed": {
    "command": "node",
    "args": ["${CLAUDE_PLUGIN_ROOT}/wrapper-server.js"],
    "env": {
      "TWILIO_ACCOUNT_SID": "${TWILIO_ACCOUNT_SID}",
      "TWILIO_AUTH_TOKEN": "${TWILIO_AUTH_TOKEN}"
    }
  }
}
```

## Prevention

### For MCP Server Developers

When creating MCP servers, follow these guidelines:

1. **Use snake_case or camelCase** for property keys:
   ```json
   "phone_number"  // ✅ snake_case
   "phoneNumber"   // ✅ camelCase
   ```

2. **Validate schemas** before publishing:
   ```javascript
   const Ajv = require('ajv');
   const ajv = new Ajv();
   
   // Validate your tool schema
   const valid = ajv.validateSchema(toolSchema);
   if (!valid) {
     console.error('Invalid schema:', ajv.errors);
   }
   ```

3. **Test with Claude Desktop** before releasing:
   ```bash
   claude mcp add my-server --config ./test-config.json
   claude --mcp-config ./test-config.json
   ```

4. **Document property naming conventions** in your README

### For Plugin Developers

When bundling MCP servers with plugins:

1. **Validate all tool schemas** in your test suite
2. **Use consistent naming conventions** across all tools
3. **Document expected property formats** in plugin README
4. **Test integration** with Claude Desktop before publishing

## Additional Resources

- [JSON Schema Specification](https://json-schema.org/specification.html)
- [MCP Protocol Documentation](https://modelcontextprotocol.io/)
- [Claude Code MCP Integration Guide](./SKILL.md)
- [MCP Server Types Reference](./server-types.md)

## Getting Help

If you continue experiencing schema validation errors:

1. **Check MCP server logs**:
   ```bash
   claude --debug
   ```

2. **Verify schema with online validator**:
   - Copy the tool's inputSchema
   - Validate at https://www.jsonschemavalidator.net/

3. **Report to MCP server maintainer**:
   - Include the full tool schema
   - Describe the 400 error
   - Mention which property keys are invalid

4. **Ask in Claude Code community**:
   - Share sanitized MCP configuration
   - Include error messages
   - Mention MCP server name and version
