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
import type { Node, File } from '@babel/types';
import * as fs from 'fs';
import * as path from 'path';

// The babel traverse module provides a default export but sometimes needs 
// special handling in pure ESM or CJS depending on how it's bundled.
const traverse = (traverseModule as any).default || traverseModule;

const MAX_TOTAL_CHARS = 4000;

function buildLocalImportsMap(ast: File): Map<string, { source: string; importedName: string }> {
  const localImports = new Map<string, { source: string; importedName: string }>();
  traverse(ast, {
    ImportDeclaration(p: NodePath<any>) {
      const source = p.node.source.value;
      if (source.startsWith('.') || source.startsWith('/')) {
        for (const specifier of p.node.specifiers) {
          if (specifier.type === 'ImportSpecifier') {
            const importedName = specifier.imported.type === 'Identifier' 
              ? specifier.imported.name 
              : (specifier.imported as any).value;
            localImports.set(specifier.local.name, { source, importedName });
          } else if (specifier.type === 'ImportDefaultSpecifier') {
            localImports.set(specifier.local.name, { source, importedName: 'default' });
          }
        }
      }
    }
  });
  return localImports;
}

/**
 * Parses the provided code and extracts the block enclosing the target line number.
 *
 * @param code - The full source code of the file.
 * @param targetLine - The 1-indexed line number where the failure occurred.
 * @param currentFilePath - The absolute path of the file (used for resolving imports).
 * @returns The string containing the isolated source block, or the full file if no block was found.
 */
export function extractEnclosingBlock(code: string, targetLine: number, currentFilePath?: string): string {
  try {
    const ast = parse(code, {
      sourceType: 'unambiguous',
      plugins: ['typescript', 'jsx', 'decorators-legacy'],
      // We need loc info to find lines
      tokens: false,
    });

    let bestNode: Node | null = null;
    let minLines = Infinity;
    let bestPath: NodePath | null = null;

    const localImports = buildLocalImportsMap(ast);

    traverse(ast, {
      enter(p: NodePath) {
        const node = p.node;
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
            bestPath = p;
          }
        }
      },
    });

    let result = code;

    if (bestNode && (bestNode as any).loc) {
      // Split original code by lines to extract the exact slice.
      // loc lines are 1-indexed.
      const codeLines = code.split('\n');
      const startLineIdx = (bestNode as any).loc.start.line - 1;
      const endLineIdx = (bestNode as any).loc.end.line;
      result = codeLines.slice(startLineIdx, endLineIdx).join('\n');
    }

    if (bestPath && currentFilePath && localImports.size > 0) {
      const usedIdentifiers = new Set<string>();
      
      (bestPath as any).traverse({
        Identifier(innerPath: NodePath<any>) {
          if (innerPath.isReferencedIdentifier()) {
            usedIdentifiers.add(innerPath.node.name);
          }
        }
      });

      const appendedContexts = [];
      let currentTotalChars = result.length;
      const visitedSymbols = new Set<string>();

      for (const usedId of usedIdentifiers) {
        const importInfo = localImports.get(usedId);
        if (importInfo) {
          const importedContext = extractExportedSymbolFromFile(
            currentFilePath,
            importInfo.source,
            importInfo.importedName,
            1, // currentDepth
            2, // maxDepth
            visitedSymbols,
            currentTotalChars
          );
          if (importedContext) {
            const block = `\n// --- Imported from ${importInfo.source} ---\n${importedContext}`;
            appendedContexts.push(block);
            currentTotalChars += block.length;
          }
        }
      }

      if (appendedContexts.length > 0) {
        result += '\n' + appendedContexts.join('\n');
      }
    }

    // Fallback: If the error was top-level or outside any function/class, return full code.
    // Actually the above logic returns the full code if bestNode is null, which is correct.
    return result;
  } catch (err) {
    console.error(`[AST_PRUNER] Failed to parse AST: ${err instanceof Error ? err.message : String(err)}`);
    // Fallback on error to full code
    return code;
  }
}

function extractExportedSymbolFromFile(
  currentFilePath: string,
  importSource: string,
  symbolName: string,
  currentDepth: number,
  maxDepth: number,
  visitedSymbols: Set<string>,
  currentTotalChars: number
): string | null {
  if (currentTotalChars >= MAX_TOTAL_CHARS) {
    return null;
  }

  try {
    const baseDir = path.dirname(currentFilePath);
    let resolvedPath = path.resolve(baseDir, importSource);
    
    // Naive extension resolution if it doesn't have one
    if (!fs.existsSync(resolvedPath) || fs.statSync(resolvedPath).isDirectory()) {
      const exts = ['.ts', '.js', '.tsx', '.jsx', '/index.ts', '/index.js'];
      let found = false;
      for (const ext of exts) {
        if (fs.existsSync(resolvedPath + ext) && !fs.statSync(resolvedPath + ext).isDirectory()) {
          resolvedPath += ext;
          found = true;
          break;
        }
      }
      if (!found) return null;
    }

    const uniqueKey = `${resolvedPath}::${symbolName}`;
    if (visitedSymbols.has(uniqueKey)) {
      return null; // Cycle detected or already included
    }
    visitedSymbols.add(uniqueKey);

    const code = fs.readFileSync(resolvedPath, 'utf8');
    const ast = parse(code, {
      sourceType: 'unambiguous',
      plugins: ['typescript', 'jsx', 'decorators-legacy'],
      tokens: false,
    });

    let targetNode: Node | null = null;
    let targetPath: NodePath | null = null;

    traverse(ast, {
      ExportDefaultDeclaration(p: NodePath<any>) {
        if (symbolName === 'default') {
          targetNode = p.node;
          targetPath = p;
          p.stop();
        }
      },
      ExportNamedDeclaration(p: NodePath<any>) {
        if (symbolName === 'default') return;
        const declaration = p.node.declaration;
        if (declaration) {
          if (declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration') {
            if (declaration.id && declaration.id.name === symbolName) {
              targetNode = p.node;
              targetPath = p;
              p.stop();
            }
          } else if (declaration.type === 'VariableDeclaration') {
            for (const decl of declaration.declarations) {
              if (decl.id && decl.id.name === symbolName) {
                targetNode = p.node;
                targetPath = p;
                p.stop();
              }
            }
          }
        } else if (p.node.specifiers) {
          for (const spec of p.node.specifiers) {
            const exportedName = spec.exported.type === 'Identifier' ? spec.exported.name : (spec.exported as any).value;
            if (exportedName === symbolName) {
              targetNode = p.node;
              targetPath = p;
              p.stop();
            }
          }
        }
      }
    });

    if (targetNode && (targetNode as any).loc) {
      const lines = code.split('\n');
      let result = lines.slice((targetNode as any).loc.start.line - 1, (targetNode as any).loc.end.line).join('\n');
      
      let localTotalChars = currentTotalChars + result.length;

      // Recursive depth traversal
      if (currentDepth < maxDepth && targetPath) {
        const localImports = buildLocalImportsMap(ast);
        if (localImports.size > 0) {
          const usedIdentifiers = new Set<string>();
          
          (targetPath as any).traverse({
            Identifier(innerPath: NodePath<any>) {
              if (innerPath.isReferencedIdentifier()) {
                usedIdentifiers.add(innerPath.node.name);
              }
            }
          });

          const appendedContexts = [];
          for (const usedId of usedIdentifiers) {
            const importInfo = localImports.get(usedId);
            if (importInfo) {
              const nestedContext = extractExportedSymbolFromFile(
                resolvedPath,
                importInfo.source,
                importInfo.importedName,
                currentDepth + 1,
                maxDepth,
                visitedSymbols,
                localTotalChars
              );
              if (nestedContext) {
                const block = `\n// --- Imported from ${importInfo.source} ---\n${nestedContext}`;
                appendedContexts.push(block);
                localTotalChars += block.length;
              }
            }
          }
          if (appendedContexts.length > 0) {
            result += '\n' + appendedContexts.join('\n');
          }
        }
      }

      return result;
    }
  } catch (err) {
    // Gracefully ignore unresolved/external imports or parsing errors
  }
  return null;
}
