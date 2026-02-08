#!/usr/bin/env node
/**
 * Test cases for MCP Tool Schema Validator
 * Demonstrates common schema issues that cause 400 errors
 */

import { validateInputSchema, validateTool } from './validate-mcp-tool-schema';

interface TestCase {
  name: string;
  tool: any;
  shouldFail: boolean;
  expectedErrors?: string[];
}

const testCases: TestCase[] = [
  {
    name: 'Valid tool with proper schema',
    tool: {
      name: 'send_email',
      description: 'Send an email',
      inputSchema: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient email' },
          subject: { type: 'string', description: 'Email subject' },
          body: { type: 'string', description: 'Email body' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
    shouldFail: false,
  },
  {
    name: 'Invalid: name property in inputSchema (Twilio-like issue)',
    tool: {
      name: 'twilio_send_sms',
      description: 'Send SMS via Twilio',
      inputSchema: {
        name: 'twilio_send_sms_input', // ❌ This causes 400 error
        type: 'object',
        properties: {
          to: { type: 'string' },
          from: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['to', 'from', 'body'],
      },
    },
    shouldFail: true,
    expectedErrors: ["Invalid property 'name' found in input schema"],
  },
  {
    name: 'Invalid: description property in inputSchema',
    tool: {
      name: 'some_tool',
      description: 'A tool',
      inputSchema: {
        description: 'Some schema description', // May cause issues
        type: 'object',
        properties: {
          param: { type: 'string' },
        },
      },
    },
    shouldFail: true,
    expectedErrors: ["Invalid property 'description' found in input schema"],
  },
  {
    name: 'Invalid: inputSchema property in inputSchema',
    tool: {
      name: 'nested_tool',
      inputSchema: {
        inputSchema: {
          // ❌ Circular/nested structure
          type: 'object',
        },
      },
    },
    shouldFail: true,
    expectedErrors: ["Invalid property 'inputSchema' found in input schema"],
  },
  {
    name: 'Invalid: wrong type for inputSchema',
    tool: {
      name: 'wrong_type_tool',
      inputSchema: {
        type: 'string', // ❌ Must be 'object'
      },
    },
    shouldFail: true,
    expectedErrors: ["Input schema type must be 'object'"],
  },
  {
    name: 'Invalid: required property not in properties',
    tool: {
      name: 'missing_prop_tool',
      inputSchema: {
        type: 'object',
        properties: {
          foo: { type: 'string' },
        },
        required: ['foo', 'bar'], // ❌ 'bar' doesn't exist
      },
    },
    shouldFail: true,
    expectedErrors: ["Required property 'bar' not found in properties"],
  },
  {
    name: 'Invalid: properties is not an object',
    tool: {
      name: 'bad_props_tool',
      inputSchema: {
        type: 'object',
        properties: 'should be object', // ❌ Wrong type
      },
    },
    shouldFail: true,
    expectedErrors: ['Properties must be an object'],
  },
  {
    name: 'Invalid: property schema is not an object',
    tool: {
      name: 'bad_prop_schema_tool',
      inputSchema: {
        type: 'object',
        properties: {
          param1: 'string', // ❌ Should be {type: "string"}
        },
      },
    },
    shouldFail: true,
    expectedErrors: ["Property 'param1' schema must be an object"],
  },
  {
    name: 'Valid: optional description at schema root',
    tool: {
      name: 'schema_with_desc',
      inputSchema: {
        type: 'object',
        properties: {
          param: { type: 'string' },
        },
      },
    },
    shouldFail: false,
  },
  {
    name: 'Valid: tool with no required parameters',
    tool: {
      name: 'optional_params_tool',
      inputSchema: {
        type: 'object',
        properties: {
          optionalParam: { type: 'string', description: 'Optional parameter' },
        },
      },
    },
    shouldFail: false,
  },
];

function runTests(): void {
  console.log('Running MCP Tool Schema Validator Tests\n');
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const errors = validateTool(testCase.tool);
    const hasFailed = errors.length > 0;

    const testPassed = hasFailed === testCase.shouldFail;

    if (testPassed) {
      // Check if expected errors are present
      if (testCase.expectedErrors && errors.length > 0) {
        const allExpectedFound = testCase.expectedErrors.every((expectedError) =>
          errors.some((e) => e.error.includes(expectedError))
        );
        if (!allExpectedFound) {
          console.log(`\n❌ FAIL: ${testCase.name}`);
          console.log(`   Expected errors not found:`);
          console.log(`   Expected: ${testCase.expectedErrors.join(', ')}`);
          console.log(
            `   Got: ${errors.map((e) => e.error).join(', ')}`
          );
          failed++;
          continue;
        }
      }

      console.log(`✅ PASS: ${testCase.name}`);
      passed++;
    } else {
      console.log(`\n❌ FAIL: ${testCase.name}`);
      console.log(
        `   Expected ${testCase.shouldFail ? 'errors' : 'no errors'}, got ${errors.length} error(s)`
      );
      if (errors.length > 0) {
        console.log('   Errors:');
        errors.forEach((e) => console.log(`   - ${e.error} at ${e.path}`));
      }
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\nTest Results: ${passed} passed, ${failed} failed out of ${testCases.length} total`);

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}
