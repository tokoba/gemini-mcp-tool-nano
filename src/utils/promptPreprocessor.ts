import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger.js';

/**
 * Prompt preprocessing utility for @ symbol handling.
 * Prevents file reference errors in Gemini CLI by performing
 * conditional escaping based on file existence checks.
 */

/**
 * Regular expression to detect valid @ symbol patterns for filepaths.
 * Matches patterns starting with @ followed by filepath characters
 * (alphanumeric, slash, dot, hyphen, underscore).
 */
const FILEPATH_PATTERN = /@([a-zA-Z0-9\/\.\-_]+)/g;

/**
 * Preprocesses @ symbols in prompts with appropriate escaping.
 * 
 * Processing logic:
 * 1. Detect @filepath patterns
 * 2. Check file existence
 * 3. If exists → keep as-is (valid file reference)
 * 4. If not exists → escape with \@ (prevent parse errors)
 * 
 * @param prompt The prompt string to process
 * @param workingDir Base working directory for relative path resolution
 * @returns Prompt string with @ symbols properly escaped
 */
export function preprocessAtSymbols(prompt: string, workingDir: string = process.cwd()): string {
  let processedPrompt = prompt;
  
  // Detect and collect @filepath patterns
  const matches = [...prompt.matchAll(FILEPATH_PATTERN)];
  
  if (matches.length === 0) {
    Logger.debug('promptPreprocessor: No @ symbol patterns found');
    return processedPrompt;
  }
  
  Logger.debug(`promptPreprocessor: Detected ${matches.length} @ symbol patterns`);
  
  // Validate each @filepath pattern
  for (const match of matches) {
    const fullMatch = match[0]; // @filepath
    const filepath = match[1];   // filepath portion
    
    try {
      // Convert relative path to absolute path
      const absolutePath = path.isAbsolute(filepath) 
        ? filepath 
        : path.resolve(workingDir, filepath);
      
      // Check file existence
      const fileExists = fs.existsSync(absolutePath);
      
      if (fileExists) {
        Logger.debug(`promptPreprocessor: File exists - ${filepath} ✓ (keeping as valid reference)`);
        // Keep unchanged if file exists (Gemini CLI will expand the file)
      } else {
        Logger.debug(`promptPreprocessor: File not found - ${filepath} ✗ (escaping)`);
        // Escape with \@ if file doesn't exist
        processedPrompt = processedPrompt.replace(fullMatch, `\\${fullMatch}`);
      }
    } catch (error) {
      // Escape on path resolution errors too
      Logger.debug(`promptPreprocessor: Path resolution error - ${filepath} (escaping): ${error}`);
      processedPrompt = processedPrompt.replace(fullMatch, `\\${fullMatch}`);
    }
  }
  
  return processedPrompt;
}

/**
 * Test helper function for @ symbol processing.
 * Logs detailed differences before and after processing.
 * 
 * @param prompt The prompt to test
 * @param workingDir Working directory
 * @returns Detailed processing results
 */
export function debugAtSymbolProcessing(prompt: string, workingDir: string = process.cwd()): {
  original: string;
  processed: string;
  changes: Array<{ pattern: string; action: 'kept' | 'escaped'; reason: string }>;
} {
  const original = prompt;
  const matches = [...prompt.matchAll(FILEPATH_PATTERN)];
  const changes: Array<{ pattern: string; action: 'kept' | 'escaped'; reason: string }> = [];
  
  for (const match of matches) {
    const fullMatch = match[0];
    const filepath = match[1];
    
    try {
      const absolutePath = path.isAbsolute(filepath) 
        ? filepath 
        : path.resolve(workingDir, filepath);
      
      const fileExists = fs.existsSync(absolutePath);
      
      if (fileExists) {
        changes.push({
          pattern: fullMatch,
          action: 'kept',
          reason: `File exists: ${absolutePath}`
        });
      } else {
        changes.push({
          pattern: fullMatch,
          action: 'escaped',
          reason: `File not found: ${absolutePath}`
        });
      }
    } catch (error) {
      changes.push({
        pattern: fullMatch,
        action: 'escaped',
        reason: `Path resolution error: ${error}`
      });
    }
  }
  
  const processed = preprocessAtSymbols(prompt, workingDir);
  
  return { original, processed, changes };
}