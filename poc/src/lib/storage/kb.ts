// ============================================================================
// KB Storage — JSON file persistence
// ============================================================================

import { readFile, writeFile, readdir } from 'fs/promises';
import path from 'path';
import { KnowledgeBase } from '../types';

const KB_DIR = path.join(process.cwd(), 'data', 'kb');

export async function getKB(propertyId: string): Promise<KnowledgeBase | null> {
  try {
    const filePath = path.join(KB_DIR, `${propertyId}.json`);
    const data = await readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function saveKB(propertyId: string, kb: KnowledgeBase): Promise<void> {
  const filePath = path.join(KB_DIR, `${propertyId}.json`);
  await writeFile(filePath, JSON.stringify(kb, null, 2));
}

export async function listKBs(): Promise<Array<{ propertyId: string; propertyName: string }>> {
  try {
    const files = await readdir(KB_DIR);
    const kbs: Array<{ propertyId: string; propertyName: string }> = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const data = await readFile(path.join(KB_DIR, file), 'utf-8');
        const kb = JSON.parse(data) as KnowledgeBase;
        kbs.push({
          propertyId: file.replace('.json', ''),
          propertyName: kb.property_name || file.replace('.json', ''),
        });
      } catch {
        // Skip invalid files
      }
    }

    return kbs;
  } catch {
    return [];
  }
}
