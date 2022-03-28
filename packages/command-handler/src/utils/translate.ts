import fs from 'fs';
import path from 'path';
import formatString from './format-string';

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
function translate(locale: string, toTranslate: string, data?: Record<string, any>) {
  const localeObject = locales.get(locale);

  if (!localeObject) {
    throw new Error(`Locale ${locale} not found`);
  }

  const localeString = localeObject[toTranslate];

  if (!localeString) {
    throw new Error(`Translation ${toTranslate} not found`);
  }

  return formatString(localeString, data);
}


export function createLocaleTranslator(locale = 'en-us') {
  return (toTranslate: string, data?: Record<string, any>) => translate(locale, toTranslate, data);
}


export default translate;
