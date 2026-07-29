import { describe, it, expect } from 'vitest';
import { generateId } from './id';

describe('ID Utility', () => {
  it('generates a valid UUID string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    // basic regex for v4 uuid format
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});
