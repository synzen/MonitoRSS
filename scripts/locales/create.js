const fs = require('fs')
const path = require('path')
const readline = require('readline')
const defaultLocale = require('../../src/config.js').bot.locale
const localeData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'locales', `${defaultLocale}.json`)))

const obj = {}

function traverse (object, reference) {
  for (const key in object) {
    const value = object[key]
    if (typeof value === 'object') {
      reference[key] = {}
      traverse(value, reference[key])
    } else {
      reference[key] = ''
    }
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Type the locale to generate a template: ', name => {
  traverse(localeData, obj)
  const file = path.join(__dirname, '..', '..', 'src', 'locales', `${name}.json`)
  fs.writeFileSync(file, JSON.stringify(obj, null, 2))
  console.log(`Created at ${file}`)
  rl.close()
})
