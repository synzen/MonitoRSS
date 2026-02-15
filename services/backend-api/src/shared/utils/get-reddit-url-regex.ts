export function getRedditUrlRegex(): RegExp {
  return /^http(s?):\/\/(www.)?(\w+\.)?reddit\.com\/r\//i;
}
