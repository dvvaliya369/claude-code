#!/usr/bin/env node
/**
 * MCP Tool Schema Validator
 * 
 * Validates MCP tool input schemas to catch common issues that cause
 * 400 errors from the Anthropic API, such as:
 * - Reserved property names in input schemas
 * - Invalid JSON Schema structures
 * - Unsupported schema features
 * 
 * Usage:
 *   npx tsx scripts/validate-mcp-tool-schema.ts <path-to-mcp-config.json>
 */

import * as fs from 'fs';
import * as path from 'path';

// Reserved JSON Schema keywords that should only appear at specific levels
const RESERVED_SCHEMA_KEYWORDS = new Set([
  '$schema',
  '$id',
  '$ref',
  '$defs',
  'definitions',
  'type',
  'properties',
  'required',
  'items',
  'additionalProperties',
  'patternProperties',
  'enum',
  'const',
  'allOf',
  'anyOf',
  'oneOf',
  'not',
]);

// Properties that are invalid at the root input schema level
const INVALID_ROOT_PROPERTIES = new Set([
  'name',
  'description',
  'inputSchema',
  'outputSchema',
]);

interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, any>;
    required?: string[];
    [key: string]: any;
  };
}

interface ValidationError {
  toolName: string;
  error: string;
  path: string;
  suggestion?: string;
}

function validateInputSchema(
  toolName: string,
  schema: any,
  propertyPath: string = 'inputSchema'
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!schema || typeof schema !== 'object') {
    errors.push({
      toolName,
      error: 'Input schema must be an object',
      path: propertyPath,
    });
    return errors;
  }

  // Check for invalid property names at root level
  for (const key of Object.keys(schema)) {
    if (INVALID_ROOT_PROPERTIES.has(key)) {
      errors.push({
        toolName,
        error: `Invalid property '${key}' found in input schema`,
        path: `${propertyPath}.${key}`,
        suggestion: `The property '${key}' should not be in the input schema. It may belong at the tool definition level.`,
      });
    }
  }

  // Validate that 'type' is set appropriately
  if (schema.type && schema.type !== 'object') {
    errors.push({
      toolName,
      error: `Input schema type must be 'object', found '${schema.type}'`,
      path: `${propertyPath}.type`,
      suggestion: 'MCP tool input schemas should have type="object"',
    });
  }

  // Validate properties structure
  if (schema.properties) {
    if (typeof schema.properties !== 'object') {
      errors.push({
        toolName,
        error: 'Properties must be an object',
        path: `${propertyPath}.properties`,
      });
    } else {
      // Check each property definition
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        if (typeof propSchema !== 'object' || propSchema === null) {
          errors.push({
            toolName,
            error: `Property '${propName}' schema must be an object`,
            path: `${propertyPath}.properties.${propName}`,
          });
        }
      }
    }
  }

  // Validate required array
  if (schema.required) {
    if (!Array.isArray(schema.required)) {
      errors.push({
        toolName,
        error: 'Required must be an array',
        path: `${propertyPath}.required`,
      });
    } else if (schema.properties) {
      // Check that all required properties exist
      const propNames = Object.keys(schema.properties);
      for (const reqProp of schema.required) {
        if (!propNames.includes(reqProp)) {
          errors.push({
            toolName,
            error: `Required property '${reqProp}' not found in properties`,
            path: `${propertyPath}.required`,
            suggestion: `Add '${reqProp}' to properties or remove from required array`,
          });
        }
      }
    }
  }

  // Check for common typos or misplacements
  if ('description' in schema && propertyPath === 'inputSchema') {
    // Description at root schema level is fine, but check if it's misplaced
    if (typeof schema.description !== 'string') {
      errors.push({
        toolName,
        error: 'Schema description must be a string',
        path: `${propertyPath}.description`,
      });
    }
  }

  return errors;
}

function validateTool(tool: MCPTool): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!tool.name || typeof tool.name !== 'string') {
    errors.push({
      toolName: tool.name || '<unnamed>',
      error: 'Tool name is required and must be a string',
      path: 'name',
    });
  }

  if (tool.inputSchema) {
    errors.push(...validateInputSchema(tool.name, tool.inputSchema));
  }

  return errors;
}

function validateMCPConfig(configPath: string): void {
  console.log(`Validating MCP configuration: ${configPath}\n`);

  let config: any;
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(content);
  } catch (error) {
    console.error(`❌ Failed to read or parse config file: ${error}`);
    process.exit(1);
  }

  let allErrors: ValidationError[] = [];
  let toolCount = 0;

  // Handle different config formats
  // Could be direct tool list or MCP server config
  if (Array.isArray(config)) {
    // Direct tool list
    for (const tool of config) {
      toolCount++;
      allErrors.push(...validateTool(tool));
    }
  } else if (config.tools && Array.isArray(config.tools)) {
    // Tools wrapped in object
    for (const tool of config.tools) {
      toolCount++;
      allErrors.push(...validateTool(tool));
    }
  } else {
    console.warn('⚠️  Unable to find tools in config. Expected array or {tools: [...]}');
  }

  console.log(`Validated ${toolCount} tool(s)\n`);

  if (allErrors.length === 0) {
    console.log('✅ No schema validation errors found!');
    process.exit(0);
  } else {
    console.log(`❌ Found ${allErrors.length} error(s):\n`);
    
    // Group errors by tool
    const errorsByTool = new Map<string, ValidationError[]>();
    for (const error of allErrors) {
      if (!errorsByTool.has(error.toolName)) {
        errorsByTool.set(error.toolName, []);
      }
      errorsByTool.get(error.toolName)!.push(error);
    }

    for (const [toolName, errors] of errorsByTool) {
      console.log(`\n📋 Tool: ${toolName}`);
      for (const error of errors) {
        console.log(`   ❌ ${error.error}`);
        console.log(`      Path: ${error.path}`);
        if (error.suggestion) {
          console.log(`      💡 ${error.suggestion}`);
        }
      }
    }

    console.log('\n');
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: npx tsx scripts/validate-mcp-tool-schema.ts <path-to-config.json>');
    console.log('\nThis tool validates MCP tool schemas to catch common issues that');
    console.log('cause 400 errors from the Anthropic API.');
    process.exit(1);
  }

  const configPath = path.resolve(args[0]);
  
  if (!fs.existsSync(configPath)) {
    console.error(`❌ File not found: ${configPath}`);
    process.exit(1);
  }

  validateMCPConfig(configPath);
}

export { validateInputSchema, validateTool };
