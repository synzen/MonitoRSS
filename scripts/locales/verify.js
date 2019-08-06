const fs = require('fs')
const path = require('path')
const defaultLocale = require('../../src/config.js').bot.locale
const referenceLocaleData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'locales', `${defaultLocale}.json`)))
const fileNames = fs.readdirSync(path.join(__dirname, '..', '..', 'src', 'locales'))

const strings = []

function traverse (object, reference, location) {
  for (const key in reference) {
    if (typeof reference[key] !== typeof object[key]) {
      strings.push(`\x1b[36m${location}[${key}]\x1b[0m expected \x1b[32m${typeof reference[key]}\x1b[0m but found \x1b[31m${typeof object[key]}\x1b[0m`)
    } else if (typeof reference[key] === 'object' && typeof object[key] === 'object') {
      traverse(object[key], reference[key], location + `[${key}]`)
    }
  }
}

function checkLocale (fileName) {
  const localeData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'locales', fileName)))
  traverse(localeData, referenceLocaleData, fileName.replace('.json', ''))
}

for (const fileName of fileNames) {
  if (fileName !== 'en-US.json') {
    checkLocale(fileName)
  }
}

if (strings.length === 0) {
  console.log('Everything looks good!')
} else {
  // Prettify the logs
  let longestLocation = 0
  for (const line of strings) {
    const parts = line.split('expected')
    const location = parts[0]
    if (location.length > longestLocation) {
      longestLocation = location.length
    }
  }

  for (let i = 0; i < strings.length; ++i) {
    const parts = strings[i].split('expected')
    let location = parts[0]
    while (location.length < longestLocation) {
      location += ' '
    }
    parts[0] = location
    strings[i] = parts.join('expected')
  }

  console.log(`${strings.join('\n')}\n\nNote that for untranslated strings, their values must be "" (an empty string). They cannot be undefined.`)
}