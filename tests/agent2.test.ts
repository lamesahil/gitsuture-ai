import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Mock the environment before importing Agent 2
process.env.GEMINI_API_KEY = 'test_key';
process.env.GITHUB_WEBHOOK_SECRET = 'test_secret';

// 2. Import Agent 2 dynamically
const { diagnoseAndRepair } = await import('../src/agents/agent2_repair.js');

describe('Agent 2 - Diagnose & Repair (Mocked Gemini)', () => {
  let mockGenerateContent: any;
  let mockGenAI: any;

  beforeEach(() => {
    mockGenerateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        rootCauseAnalysis: "The function 'add' was missing a return statement.",
        confidenceScore: 0.95,
        filePath: "src/math.ts",
        unifiedDiff: "--- a/src/math.ts\n+++ b/src/math.ts\n@@ -1,3 +1,3 @@\n export function add(a: number, b: number) {\n-  a + b;\n+  return a + b;\n }"
      })
    });

    mockGenAI = {
      models: {
        generateContent: mockGenerateContent
      }
    };
  });

  it('should request structured JSON and return exactly the required schema', async () => {
    const stackTrace = 'Error: Expected 4, got undefined';
    const fileContext = 'export function add(a: number, b: number) { a + b; }';
    const filePath = 'src/math.ts';

    const result = await diagnoseAndRepair(stackTrace, fileContext, filePath, mockGenAI);

    // Verify the output matches exactly
    expect(result.rootCauseAnalysis).toBe("The function 'add' was missing a return statement.");
    expect(result.confidenceScore).toBe(0.95);
    expect(result.filePath).toBe("src/math.ts");
    expect(result.unifiedDiff).toContain("return a + b;");

    // Verify we asked Gemini for strict JSON with the schema
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateContent.mock.calls[0][0];
    
    expect(callArgs.model).toBe('gemini-2.5-flash');
    expect(callArgs.config.responseMimeType).toBe('application/json');
    expect(callArgs.config.responseSchema).toBeDefined();
    expect(callArgs.config.responseSchema.required).toEqual(['rootCauseAnalysis', 'confidenceScore', 'filePath', 'unifiedDiff']);
  });

  it('should throw an error if Gemini returns invalid JSON', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: "This is not JSON"
    });

    await expect(diagnoseAndRepair('trace', 'context', 'path', mockGenAI))
      .rejects
      .toThrow(/Failed to parse structured output/);
  });

  it('should throw an error if Gemini misses required schema fields', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        rootCauseAnalysis: "Missing other fields"
      })
    });

    await expect(diagnoseAndRepair('trace', 'context', 'path', mockGenAI))
      .rejects
      .toThrow(/Invalid schema returned by AI/);
  });
});
