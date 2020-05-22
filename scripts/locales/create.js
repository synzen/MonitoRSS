const fs = require('fs')
const path = require('path')
const readline = require('readline')
const localeData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'locales', `en-US.json`)))

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
})

console.log('The locale name should by in the format of \x1b[1mlanguage-region\x1b[0m.')

function prompt () {
  rl.question('\nType the locale to generate a template: ', name => {
    traverse(localeData, obj)
    if (name.includes('_')) {
      console.log('Invalid. Hyphens (-) must be used, not underscores.')
      return prompt()
    }
    const file = path.join(__dirname, '..', '..', 'src', 'locales', `${name}.json`)
    fs.writeFileSync(file, JSON.stringify(obj, null, 2))
    console.log(`Created at ${file}`)
    rl.close()
  })
}

prompt()
