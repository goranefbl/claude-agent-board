/**
 * Buffers incoming data and emits complete lines.
 * Useful if we need line-level granularity in the future.
 * For now, we stream raw chunks directly.
 */
export class StreamParser {
  private buffer = '';

  push(chunk: string): string[] {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() || '';
    return lines;
  }

  flush(): string {
    const remaining = this.buffer;
    this.buffer = '';
    return remaining;
  }
}
