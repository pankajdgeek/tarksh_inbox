// ============================================================================
// Gemini CLI Helper — shells out to `gemini -p` for AI calls
// ============================================================================

import { spawn } from 'child_process';

export interface ClaudeCliResult {
  text: string;
  latencyMs: number;
}

/**
 * Call Gemini via the CLI (`gemini -p`).
 * Uses whatever auth the locally installed Gemini CLI has.
 * No API key needed in the app.
 */
export function callClaude(params: {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
}): Promise<ClaudeCliResult> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    // Combine system + user prompt for gemini -p
    const fullPrompt = `<instructions>\n${params.systemPrompt}\n</instructions>\n\n${params.userPrompt}`;

    const args = [
      '--yolo',
      '-p', fullPrompt,
    ];

    const proc = spawn('gemini', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn gemini CLI: ${err.message}. Is Gemini CLI installed?`));
    });

    proc.on('close', (code) => {
      const latencyMs = Date.now() - startTime;
      if (code !== 0) {
        reject(new Error(`gemini CLI exited with code ${code}: ${stderr || stdout}`));
      } else {
        resolve({ text: stdout.trim(), latencyMs });
      }
    });
  });
}
