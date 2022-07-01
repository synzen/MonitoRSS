const fs = require('fs')
const path = require('path')
const COLORS = {
  BRIGHT: '\x1b[1m',
  RESET: '\x1b[0m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  CYAN: '\x1b[36m'
}
const CONSTANT_CHARACTERS = ['"', '\n', '`', '\u200b']
const referenceLocaleData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'locales', 'en-US.json')))
const fileNames = fs.readdirSync(path.join(__dirname, '..', '..', 'src', 'locales'))

const stringCountsByLocale = {}
const errorStringsByLocale = {}

function traverse (object, reference, location, locale) {
  for (const key in reference) {
    if (typeof reference[key] !== typeof object[key]) {
      errorStringsByLocale[locale].push(`${COLORS.CYAN}${location}[${key}]${COLORS.RESET} expected ${COLORS.GREEN}${typeof reference[key]}${COLORS.RESET} but found ${COLORS.RED}${typeof object[key]}${COLORS.RESET}`)
    } else if (typeof reference[key] === 'object') {
      traverse(object[key], reference[key], location + `[${key}]`, locale)
    } else if (typeof reference[key] === 'string' && object[key].length > 0) {
      ++stringCountsByLocale[locale]
      for (const character of CONSTANT_CHARACTERS) {
        const referenceCharCount = (reference[key].match(new RegExp(character, 'g')) || []).length
        const charCount = (object[key].match(new RegExp(character, 'g')) || []).length
        if (referenceCharCount !== charCount) {
          const printCharacter = character === '\n' ? '\\n' : character === '\u200b' ? '\\u200b' : character
          errorStringsByLocale[locale].push(`${COLORS.CYAN}${location}[${key}]${COLORS.RESET} expected ${COLORS.GREEN}${referenceCharCount} ${COLORS.BRIGHT}${printCharacter}${COLORS.RESET} character(s)${COLORS.RESET} but found ${COLORS.RED}${charCount} ${COLORS.BRIGHT}${printCharacter}${COLORS.RESET} character(s)`)
        }
      }
    }
  }
}

for (const fileName of fileNames) {
  const localeData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'locales', fileName)))
  const locale = fileName.replace('.json', '')
  errorStringsByLocale[locale] = []
  stringCountsByLocale[locale] = 0
  traverse(localeData, referenceLocaleData, locale, locale)
}

const totalStrings = stringCountsByLocale['en-US']
const okStrings = []
const errorStrings = []

for (const locale in errorStringsByLocale) {
  const strings = errorStringsByLocale[locale]
  if (strings.length === 0) {
    okStrings.push(`${COLORS.GREEN}√${COLORS.RESET} ${locale} ${locale === 'en-US' ? '(Reference)' : `(${((stringCountsByLocale[locale] / totalStrings) * 100).toFixed(2)}%)`}`)
    continue
  }
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
  errorStrings.push(`${COLORS.RED}X${COLORS.RESET} ${locale}\n${strings.join('\n')}`)
}

if (okStrings.length > 0) {
  console.log(okStrings.join('\n'))
}
if (errorStrings.length > 0) {
  console.log(errorStrings.join('\n'))
}
console.log('\nNote that for untranslated strings, their values must be "" (an empty string). They cannot be undefined.\nEmpty string translations will fall back to using the default en-US strings.')
