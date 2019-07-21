const names = [ '_fullDescription', '_fullTitle', '_fullSummary', '_id', '_fullDate' ]

const properties = new Set()
for (const name of names) {
  properties.add(name)
}

const isHiddenProperty = property => {
  return properties.has(property)
}

export { isHiddenProperty, names as hiddenProperties }
