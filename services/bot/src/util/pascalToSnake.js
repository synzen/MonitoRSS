/**
 * @param {string} pascal
 */
function pascalToSnake (pascal) {
  const replaced = pascal.replace(/[A-Z]/g, substr => {
    return `_${substr.toLowerCase()}`
  })
  // Remove the underscore at the beginning of the string
  return replaced.slice(1, replaced.length)
}

module.exports = pascalToSnake
