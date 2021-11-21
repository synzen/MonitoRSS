import fs from 'fs';
import path from 'path';

const localesDir = path.join(__dirname, '..', 'locales');

const locales = fs
  .readdirSync(localesDir, {
    withFileTypes: true,
  })
  .filter(file => file.isFile() && file.name.endsWith('.json'))
  .map(file => file.name)
  .reduce((mapOfLocales, fileName) => {
    const filePath = path.join(localesDir, fileName);

    const localesObject = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    mapOfLocales.set(fileName.replace('.json', ''), localesObject);

    return mapOfLocales;
  }, new Map<string, Record<string, string>>());


// TODO: Add support for string formatting
function translate(locale: string, toTranslate: string) {
  const localeObject = locales.get(locale);

  if (!localeObject) {
    throw new Error(`Locale ${locale} not found`);
  }

  const localeString = localeObject[toTranslate];

  if (!localeString) {
    throw new Error(`Translation ${toTranslate} not found`);
  }

  return localeString;
}


export function createLocaleTranslator(locale = 'en-us') {
  return (toTranslate: string) => translate(locale, toTranslate);
}


export default translate;
