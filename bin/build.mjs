const { readFile, writeFile } = await import('fs/promises')

try {
  const currency = await readFile('./src/currencyinfo.js')
  const bufferToString = buffer => buffer.toString()

  const commonjs = await readFile('./export_helpers/common.js')  
  const modulejs = await readFile('./export_helpers/module.js')

  const iffyleading = await readFile('./export_helpers/iffy_leading.js')
  const iffytrailing = await readFile('./export_helpers/iffy_trailing.js')

  const files = {
    commonjs: [
      currency,
      commonjs,
    ].map(bufferToString).join('\n'),

    modulejs: [
      currency,
      modulejs,
    ].map(bufferToString).join('\n'),

    iffyjs: [
      iffyleading,
      currency,
      iffytrailing,
    ].map(bufferToString).join('\n'),
  }

  await writeFile('./dist/currencyinfo.js', files.commonjs)
  await writeFile('./dist/currencyinfo.mjs', files.modulejs)
  await writeFile('./dist/currencyinfo.browser.js', files.iffyjs)
}
catch (error) {
  console.error(error)
}
  
