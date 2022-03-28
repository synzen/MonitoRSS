/**
 * Replace placeholders in a string with values. Placeholders are in the form of
 * `{placeholderName}`. For example, `{name}` or `{name} {lastName}`.
 * 
 * @param string The string to format
 * @param data The data to use for formatting
 * @returns The formatted string
 */
function formatString(string: string, data?: Record<string, any>): string {
  if (!data) {
    return string;
  }

  return string.replace(/{([^{}]*)}/g, (match, key) => {
    const value = data[key];

    if (value === undefined) {
      return match;
    }

    return value;
  });
}

export default formatString;
