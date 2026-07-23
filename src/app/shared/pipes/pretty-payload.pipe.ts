import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats a message payload for display: JSON is re-indented (2 spaces), XML gets a
 * lightweight indent, and anything else — including payloads that merely look like
 * JSON or XML but do not parse — is returned untouched. A pure pipe, so the parse
 * runs once per payload rather than on every change-detection cycle.
 */
@Pipe({ name: 'prettyPayload' })
export class PrettyPayloadPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';

    // JSON detection by parsing, not sniffing: whatever JSON.parse accepts is JSON.
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      // fall through
    }

    if (value.trim().startsWith('<')) {
      const formatted = this.formatXml(value.trim());
      if (formatted !== null) return formatted;
    }

    return value;
  }

  private formatXml(xml: string): string | null {
    // DOMParser reports failure as a <parsererror> document rather than throwing.
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) return null;

    // Split adjacent tags onto their own lines, then indent by tracking depth.
    const lines = xml.replace(/>\s*</g, '>\n<').split('\n');
    let depth = 0;
    return lines
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('</')) depth = Math.max(depth - 1, 0);
        const indented = '  '.repeat(depth) + trimmed;
        const opensElement =
          trimmed.startsWith('<') &&
          !trimmed.startsWith('</') &&
          !trimmed.startsWith('<?') &&
          !trimmed.startsWith('<!--') &&
          !trimmed.endsWith('/>') &&
          !/<\/[^>]+>$/.test(trimmed); // e.g. <id>42</id> opens and closes on one line
        if (opensElement) depth++;
        return indented;
      })
      .join('\n');
  }
}
