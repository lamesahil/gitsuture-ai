/**
 * src/ast/pruner.ts
 *
 * Provides utilities to parse a TypeScript/JavaScript source file and extract
 * only the narrowest enclosing block (Function, Class, Method, Arrow Function)
 * surrounding a given line number.
 *
 * This reduces the context window passed to the LLM (Agent 2), reducing hallucination
 * and token costs.
 */

import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type { Node } from '@babel/types';

// The babel traverse module provides a default export but sometimes needs 
// special handling in pure ESM or CJS depending on how it's bundled.
const traverse = (traverseModule as any).default || traverseModule;

/**
 * Parses the provided code and extracts the block enclosing the target line number.
 *
 * @param code - The full source code of the file.
 * @param targetLine - The 1-indexed line number where the failure occurred.
 * @returns The string containing the isolated source block, or the full file if no block was found.
 */
export function extractEnclosingBlock(code: string, targetLine: number): string {
  try {
    const ast = parse(code, {
      sourceType: 'unambiguous',
      plugins: ['typescript', 'jsx', 'decorators-legacy'],
      // We need loc info to find lines
      tokens: false,
    });

    let bestNode: Node | null = null;
    let minLines = Infinity;

    traverse(ast, {
      enter(path: NodePath) {
        const node = path.node;
        if (!node.loc) return;

        // Check if the node is one of the enclosing structures we care about
        const isTargetType =
          node.type === 'FunctionDeclaration' ||
          node.type === 'ClassDeclaration' ||
          node.type === 'ClassMethod' ||
          node.type === 'ClassPrivateMethod' ||
          node.type === 'ArrowFunctionExpression' ||
          node.type === 'FunctionExpression' ||
          node.type === 'ObjectMethod';

        if (!isTargetType) return;

        const startLine = node.loc.start.line;
        const endLine = node.loc.end.line;

        // Is the target line within this node?
        if (targetLine >= startLine && targetLine <= endLine) {
          const lines = endLine - startLine;
          // We want the narrowest/tightest enclosing block
          if (lines < minLines) {
            minLines = lines;
            bestNode = node;
          }
        }
      },
    });

    if (bestNode && bestNode.loc) {
      // Split original code by lines to extract the exact slice.
      // loc lines are 1-indexed.
      const codeLines = code.split('\n');
      const startLineIdx = bestNode.loc.start.line - 1;
      const endLineIdx = bestNode.loc.end.line;
      return codeLines.slice(startLineIdx, endLineIdx).join('\n');
    }

    // Fallback: If the error was top-level or outside any function/class, return full code.
    return code;
  } catch (err) {
    console.error(`[AST_PRUNER] Failed to parse AST: ${err instanceof Error ? err.message : String(err)}`);
    // Fallback on error to full code
    return code;
  }
}
