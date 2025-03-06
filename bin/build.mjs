const { readFile, writeFile } = await import('fs/promises')

try {
  const commonjs = await readFile('./export_helpers/common.js')
  const modulejs = await readFile('./export_helpers/module.js')
  const currency = await readFile('./src/currencyinfo.js')

  await writeFile('./dist/currencyinfo.js', currency.toString() + commonjs.toString())
  await writeFile('./dist/currencyinfo.mjs', currency.toString() + modulejs.toString())
}
catch (error) {
  console.error(error)
  
}
  
