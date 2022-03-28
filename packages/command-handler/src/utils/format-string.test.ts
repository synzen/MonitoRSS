import formatString from './format-string';

describe('formatString', () => {
  it('formats the string with 1 variable correctly', () => {
    const result = formatString('Hello {name}', { name: 'John' });
    expect(result).toBe('Hello John');
  });

  it('formats the string with 2 of the same variables correctly', () => {
    const result = formatString('Hello {name} and {name}', { name: 'John' });
    expect(result).toBe('Hello John and John');
  });

  it('formats the string with different variables', () => {
    const result = formatString('Hello {name} and {age}', { name: 'John', age: '30' });
    expect(result).toBe('Hello John and 30');
  });
});
