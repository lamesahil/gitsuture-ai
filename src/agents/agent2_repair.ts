/**
 * src/agents/agent2_repair.ts
 *
 * Agent 2 — DIAGNOSE & REPAIR
 *
 * Connects to the Gemini API to analyze a failing test stack trace and the
 * AST-pruned file context. Returns a strict JSON response containing the
 * root cause, confidence score, and a Unified Git Diff.
 *
 * Uses the @google/genai SDK with responseSchema to guarantee output structure.
 */

import { GoogleGenAI, Type, Schema } from '@google/genai';
import { env } from '../config/env.js';
import type { RepairResult } from '../core/types.js';

// Define the exact schema the model must adhere to.
const repairSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    rootCauseAnalysis: {
      type: Type.STRING,
      description: 'A brief explanation of why the test failed.',
    },
    confidenceScore: {
      type: Type.NUMBER,
      description: 'Number from 0.0 to 1.0 indicating confidence in the fix.',
    },
    filePath: {
      type: Type.STRING,
      description: 'The exact file path of the file that was repaired.',
    },
    unifiedDiff: {
      type: Type.STRING,
      description: 'The repair patch formatted strictly as a Unified Git Diff.',
    },
  },
  required: ['rootCauseAnalysis', 'confidenceScore', 'filePath', 'unifiedDiff'],
};

/**
 * Sends the failure context to Gemini and requests a structured patch.
 *
 * @param stackTrace       - The stderr / stdout from the failing test run (Agent 1).
 * @param fileContext      - The raw source code or AST-pruned context of the failing file.
 * @param failingFilePath  - The exact path to the file that needs fixing.
 * @param aiClient         - Optional injected GoogleGenAI client (for testing).
 *
 * @returns A strictly typed RepairResult object.
 */
export async function diagnoseAndRepair(
  stackTrace: string,
  fileContext: string,
  failingFilePath: string,
  aiClient?: GoogleGenAI
): Promise<RepairResult> {
  const ai = aiClient ?? new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

  const prompt = `
You are an expert autonomous software engineer (Agent 2 of GitSuture).
Your job is to diagnose the failing test based on the stack trace, and output a fix for the provided source file.

Failing File Path:
${failingFilePath}

Source Code Context:
\`\`\`
${fileContext}
\`\`\`

Test Failure Stack Trace:
\`\`\`
${stackTrace}
\`\`\`

Instructions:
1. Analyze the stack trace to determine the root cause of the failure.
2. Formulate a fix that targets ONLY the root cause.
3. Generate a strict Unified Git Diff patch that applies cleanly to the provided source code.
4. Output your response EXACTLY matching the requested JSON schema. Do NOT include markdown blocks (\`\`\`json) outside the JSON output.
`;

  console.log(`[AGENT2] Requesting repair for ${failingFilePath}...`);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: repairSchema,
      temperature: 0.2, // Low temperature for deterministic code fixes
    },
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error('[AGENT2] AI returned empty response.');
  }

  try {
    const result = JSON.parse(responseText) as RepairResult;

    // Sanity check to ensure Gemini adhered to the schema.
    if (
      typeof result.rootCauseAnalysis !== 'string' ||
      typeof result.confidenceScore !== 'number' ||
      typeof result.filePath !== 'string' ||
      typeof result.unifiedDiff !== 'string'
    ) {
      throw new Error('[AGENT2] Invalid schema returned by AI.');
    }

    console.log(`[AGENT2] Repair generated for ${result.filePath} (Confidence: ${result.confidenceScore})`);
    return result;
  } catch (err) {
    console.error(`[AGENT2] Failed to parse AI response: ${responseText}`);
    throw new Error(`[AGENT2] Failed to parse structured output: ${err instanceof Error ? err.message : String(err)}`);
  }
}
