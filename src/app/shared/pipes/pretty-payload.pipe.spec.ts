import { PrettyPayloadPipe } from './pretty-payload.pipe';

describe('PrettyPayloadPipe', () => {
  const pipe = new PrettyPayloadPipe();

  it('pretty-prints JSON with 2-space indentation', () => {
    expect(pipe.transform('{"orderId":42,"items":[1,2]}')).toBe(
      '{\n  "orderId": 42,\n  "items": [\n    1,\n    2\n  ]\n}'
    );
  });

  it('indents XML by nesting depth', () => {
    expect(pipe.transform('<order><id>42</id><items><item>1</item></items></order>')).toBe(
      '<order>\n  <id>42</id>\n  <items>\n    <item>1</item>\n  </items>\n</order>'
    );
  });

  // Payloads that merely look like JSON must come through untouched, not blank.
  it('returns invalid JSON raw', () => {
    expect(pipe.transform('{oops')).toBe('{oops');
  });

  it('returns invalid XML raw', () => {
    expect(pipe.transform('<order><id></order>')).toBe('<order><id></order>');
  });

  it('returns plain text raw', () => {
    expect(pipe.transform('hello world')).toBe('hello world');
  });

  it('maps empty and missing values to an empty string', () => {
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });
});
