/**
 * Working with the ECMAScript {@link Intl} classes can be a trying and
 * exhausting experience. Especially when working with currency strings
 * for different locales. This class is designed to provide bi-directional
 * formatting and detection of currency values in your code and leverages
 * the built-in capabilities of most modern backend and browser based
 * JavaScript environments.
 *
 * @example
 * // Shorthand formatting to common combos like USD for 'en-US'
 * CurrencyInfo.USD.format(123456789.123) => '$123,456,789.12'
 *
 * // Or CAD for 'fr-CA'
 * CurrencyInfo.CAD.format(123456789.123) => '123 456 789,12 $'
 *
 * @example
 * // Detection of locales by various input
 *
 * // Not enough discernible information available, could be anything
 * CurrencyInfo.detect(1) => null
 *
 * // If there isn't enough information, provide an assumptive output
 * // note that the score will still be 0 since nothing was detected
 * CurrencyInfo.detect(1, { assume: CurrencyInfo.USD }) =>
 *   { locale: 'en-US', score: 0, ... }
 * CurrencyInfo.detect(1, { assume: { locale: 'en-US', currency: 'USD' }}) =>
 *   { locale: 'en-US', score: 0, ... }
 *
 * // Or provide some currency string input and multiple checks will
 * // be applied and a score derived. Things that will be checked
 * // include grouping and decimal separators like commas vs. strings or
 * // commas vs. periods, the position presence of the currency symbol
 * // and ensuring that no more than one possible decimal separator is
 * // present. The values to check are dynamically provided by the Intl
 * // classes present in modern JavaScript runtime environments
 * CurrencyInfo.detect('1 $') => { locale: 'fr-CA', score: 0.3, ... }
 * CurrencyInfo.detect('123,00') => { locale: 'fr-CA', score: 0.6, ... }
 * CurrencyInfo.detect('$1') => { locale: 'en-US', score: 0.3,... }
 *
 * @todo add detection and configuration of how many decimal places are
 * present in formatted output.
 *
 * @class CurrencyInfo
 */
class CurrencyInfo {
  /**
   * Creates (and caches) or retrieves a cached instance that was previously
   * created. New memory is only allocated if a cached instance could not be
   * retrived using the supplied `currency` and `locale` values.
   *
   * @param {string} currency a currency code string such as `CAD` or `USD`
   * @param {string} [locale = 'en-US'] a language and country code to help
   * determine how currency should be string formatted. defaults to `en-US`
   * if no value is supplied
   * @param {boolean} [doNotThrow = false] if {@link true}, errors are
   * returned instead of thrown, otherwise errors validating input or JS
   * runtime capabilities are thrown during object creation.
   * @returns {CurrencyInfo|Error} either a newly created and cached instance
   * of {@link CurrencyInfo} or a previously created and cached instance. The
   * function is pure in the sense that like input creates like output every
   * time. An {@link Error} instance can be returned if `doNotThrow` is set to
   * {@link true}.
   *
   * @throws {Error} if {@link Intl} is not present in your JavaScript runtime
   * @throws {TypeError} if currency is not in the list returned by a call to
   * {@link Intl.supportedValuesOf} ('currency')
   * @throws {RangeError} if incorrect locale information is supplied to a
   * call to {@link Intl.getCanonicalLocales} with the supplied `locale`
   */
  constructor(currency, locale = 'en-US', doNotThrow = false) {
    // Fetch any cached value if one was previously created
    const cached = this.constructor.cache(currency, locale)

    // If we have a cached value, short-circuit and return it immediately
    if (cached)
      return cached

    // Perform environmental and input validations
    const errors = this.constructor.checkForInputErrors(currency, locale)
    if (errors.length) {
      if (doNotThrow) return errors[0]; else throw errors[0]
    }

    // Take the canonical locale value since we know it passed that test, or
    // just use the locale if an empty array is returned but still doesn't
    // throw an error [this last part is just a precaution, the expectation
    // is that a value will always be returned]
    locale = Intl.getCanonicalLocales(locale)?.[0] ?? locale

    // Create a formatter based on locale and currency provided
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol',
    })

    // Split a large number into its semantic parts. This will return an
    // array such as the following for "CAD", "fr-CA"
    // [
    //   { type: 'integer', value: '123' },
    //   { type: 'group', value: ' ' },
    //   { type: 'integer', value: '456' },
    //   { type: 'group', value: ' ' },
    //   { type: 'integer', value: '789' },
    //   { type: 'decimal', value: ',' },
    //   { type: 'fraction', value: '12' },
    //   { type: 'literal', value: ' ' },
    //   { type: 'currency', value: '$' }
    // ]
    const parts = formatter.formatToParts(123456789.123)

    // Grab the first entry indicated as group and its associated string
    const group = parts.find(p => p.type == 'group')?.value ?? ','

    // Grab the first entry indicated as decimal and its associated string
    const decimal = parts.find(p => p.type == 'decimal')?.value ?? '.'

    // Grab the first entry indicated at the currency type and its value
    const symbol = parts.find(p => p.type == 'currency')?.value ?? '$'

    // Shorthand for the static `escapeRegExp` function, allowing the class
    // to be renamed without having to worry about that detail
    const escapeRegExp = this.constructor.escapeRegExp

    // Create an object that will generate a regular expression with the
    // global flag set for each of the detected separator values. These
    // will be properly escaped when the dynamic regular expression is
    // generated.
    //
    // Note: a function is created rather a single instance because when
    // an instance has any of its methods invoked, it takes on state. So
    // the rSeparators create new regular expression instances with the
    // separators strings escaped each time the are invoked
    const regexSeparators = {
      group: () => new RegExp(`[${escapeRegExp(group.normalize('NFKC'))}]`, 'g'),
      symbol: () => new RegExp(symbol.length < 2
        ? `[${escapeRegExp(symbol.normalize('NFKC'))}]`
        : escapeRegExp(symbol.normalize('NFKC')), 'g'
      ),
      decimal: () => new RegExp(`[${escapeRegExp(decimal)}]`, 'g')
    }

    /**
     * This function removes any localized currency string formatting from
     * the supplied value. While passing a {@link Number} is redundant and
     * computationally wasteful, it is supported. All values passed in are
     * first converted to String, the locale specific grouping, decimal and
     * symbol string values are removed with the localized decimal being
     * converted to decimal compatible period, all before being wrapped in
     * a call to {@link Number}.
     *
     * This process will correctly return a valid {@link Nubmer} if the locale
     * matches the input, but will result in a {@link NaN} value if the
     * localizations are incorrect for the input in most cases.
     *
     * @param {*} numberOrString a number or string to strip of this specific
     * locale's stylistic formatting
     * @returns {number} the localized string's decimal equivalent or
     * {@link NaN} if an error occurred while stripping the formatted value
     * down.
     */
    function strip(numberOrString) {
      return Number(String(numberOrString)
        .replace(regexSeparators.group(), '')
        .replace(regexSeparators.decimal(), '.')
        .replace(regexSeparators.symbol(), '')
      )
    }

    /**
     * This custom function uses the supplied locale and currency values to
     * to {@link strip} and {@link Intl.NumberFormat.format} the resulting
     * stripped number.
     *
     * @param {*} numberOrString a value to format using this specific locale
     * and currency values.
     * @returns {string} a {@link String} that was created by first stripping
     * any styling from the input using {@link strip} and then re-formatting
     * the number using {@link Intl.NumberFormat} with this `currency` and
     * `locale` values
     */
    function format(numberOrString) {
      return formatter.format(this.strip(numberOrString))
    }

    /**
     * Calculates the position of the currency symbol, based on this locale
     * and currency code, within the supplied string or formatted parts array.
     * The resulting enum like response will be one of four strings,
     *   - **"leading"** symbol is first character
     *   - **"within"** symbol is present and neither the first nor the last
     *     character
     *   - **"trailing"** symbol is the last character
     *   - **"missing"** symbol is not present at all
     *
     * @example
     * symbolPosition('$1.50') => "leading"
     * symbolPosition('1,50 $') => "trailing"
     * symbolPosition('1.50') => "missing"
     *
     * // usually "within" indicates a malformed input
     * symbolPosition('1$50') => "within"
     *
     * // The position reflects the index of the array value with type
     * // "currency" relative to the number of parts supplied.
     * symbolPosition([
     *   { type: 'currency', value: '$' },
     *   { type: 'integer', value: '1' },
     *   { type: 'decimal', value: '.' },
     *   { type: 'fraction', value: '00' }
     * ]) => "leading"
     *
     * @param {*|{type: string, value: string}[]} numberOrStringOrParts is
     * either a value from which to make a {@link String} or it is an array
     * returned from {@link Intl.NumberFormat.formatToParts}
     * @returns {'leading'|'within'|'trailing'|'missing'} one of four possible
     * string values based on this locale and currency's expected separator
     * value's location in the input string or array.
     */
    function symbolPosition(numberOrStringOrParts) {
      let parts = Array.isArray(numberOrStringOrParts)
        ? numberOrStringOrParts
        : null;

      let position = -1

      if (parts === numberOrStringOrParts) {
        // Ensure the array contains only objects with both a type and value
        // property and both of those values are truthy
        parts = parts.filter(part => part?.type && part?.value)

        // At this point, if the array contained no valid objects one would
        // expect from Intl.NumberFormat.formatToParts() then -1 will be
        // returned from the call to findIndex
        position = parts.findIndex(p => p?.type == 'currency')
      }
      else {
        // Convert the supplied non-array input to a string by wrapping it
        // in a call to String(). All strings have a .length property and
        // an .indexOf() function to identify the position of the currency
        // symbol.
        parts = String(numberOrStringOrParts)

        // Locate the currency symbol or -1 in the list
        position = parts.indexOf(symbol)
      }

      return (position === 0
        ? 'leading' // currency symbol found as the first character
        : position == parts.length - 1
          ? 'trailing' // currency symbol found as the last character
          : ~position // ensure we have a non-negative 1 value
            ? 'within' // then its someplace within the string
            : 'missing' // otherwise it isn't present at all in the string
      )
    }

    // Assign all the calculated values to properties of this new instance
    // of CurrencyInfo.
    Object.assign(this, {
      // An object with markers specific to this currency and locale for
      // the grouping, decimal and currency symbol values
      separators: {
        group, // example values might be "," or " "
        decimal, // example values might be "." or ","
        symbol, // example values might be "$" or "£"
      },

      // An object with the same keys as separators except the values are
      // a function that returns the separator as a global flagged, escaped,
      // regular expression; e.g. new RegExp('[\\$]', 'g')
      regex: regexSeparators,

      // An object indicating the position of the currency symbol for numbers
      // conforming to this locale, and a helper function to locate this
      // currency and locale specific symbol in another string
      symbol: {
        position: symbolPosition(parts),
        locator: symbolPosition,
      },

      // The currency code for this CurrencyInfo instance
      currency,

      // The locale code for this CurrencyInfo instance
      locale,

      // A function to strip a formatted string conforming to this instance's
      // locale and currency designations, back into a number
      strip,

      // Take a string or value to be converted into a string, strip its
      // markers according to this locale and currency desingations, and then
      // re-format it equally accordingly
      format,

      // The instance of Intl.NumberFormat created for this CurrencyInfo
      // instance.
      formatter,
    })

    // Cache this newly created instance so that future requests for this
    // currency and locale combination will simply return this created instance
    this.constructor.cache(currency, locale, this)
  }

  /**
   * Returns the class name so that if you pass an instance of the class
   * to {@link String} function, you'll end up with something like
   * `"[object CurrencyInfo]"` if the class name is CurrencyInfo.
   *
   * @type string
   */
  get [Symbol.toStringTag]() {
    return this.constructor.name
  }

  /**
   * Access to the cache of previously created {@link CurrencyInfo} instances
   * that were created with the same `currency` and `locale` values. These are
   * stored in an internal map using the string key of `${currency}-${locale}`.
   *
   * If a `value` is supplied, and the value is an instanceof
   * {@link CurrencyInfo}, then it is added to the cache before being returned.
   * If a `value` is supplied and its value is explicitly {@link null}, then
   * any cached value of the calculated key is deleted from the cache.
   *
   * @param {string} currency a currency value type such as 'USD'
   * @param {string} locale a locale value, defaults to 'en-US'
   * @param {CurrencyInfo|null} value an optional value that can be stored in
   * the cache using a key derived from the `currency` and `locale` parameters
   * @returns {CurrencyInfo} a cached {@link CurrencyInfo} object instance
   * or `undefined` if none has yet been cached for the supplied `currency`
   * and `locale` combination.
   */
  static cache(currency, locale = 'en-US', value) {
    currency = String(currency)
    locale = String(locale)

    const mapKey = Symbol.for('CurrencyInfoCache')
    const dataKey = `${currency}-${locale}`

    if (!this[mapKey])
      Object.defineProperty(this, mapKey, {
        enumerable: false,
        writable: false,
        configurable: true,
        value: new Map()
      })

    if (value && value instanceof this) {
      this[mapKey].set(dataKey, value)
    }
    else if (value === null && this[mapKey].has(dataKey)) {
      this[mapKey].delete(dataKey)
    }

    return this[mapKey].get(dataKey)
  }

  /**
   * Invokes {@link CurrencyInfo.validateRuntime}, followed by a call to
   * {@link CurrencyInfo.validateCurrency} and then subsequently by a call to
   * {@link CurrencyInfo.validateLocale}. The last two calls will be supplied
   * the parameters passed to this function.
   *
   * @example
   * CurrencyInfo.checkForInputErrors('bitcoin', 'en-US') => [
   *   TypeError('Currency value bitcoin is not supported')
   * ]
   *
   * @param {*} currency a currency value to validate
   * @param {*} locale a locale value to validate
   * @returns {error[]} any array of errors that occurred while testing
   * for JS runtime capabilities, the supplied currency code and the
   * supplied locale code. An empty array indicates no errors were detected
   */
  static checkForInputErrors(currency, locale) {
    return [
      this.validateRuntime(),
      this.validateCurrency(currency),
      this.validateLocale(locale)
    ].filter(validation => validation instanceof Error)
  }

  /**
   * This function makes a best effort to determine the currency and locale
   * of a given input. It is intended to be used with input like '$1,234' or
   * '1 343,23 $'. However, any value supplied will be wrapped in a call to
   * the {@link String} function to convert it into a string for parsing.
   *
   * The default currency, language and country combinations will be attempted
   * and information such as the position of the currency symbol or grouping
   * identifiers will be used to find a best in class match. The highest
   * scoring or first of tied highest scored matches will be returned if one
   * could be detected.
   *
   * A successful result will return an object with the following shape:
   * ```
   * {
   *   locale: string,         // language-country code such as 'fr-CA'
   *   amount: number,         // the input string stripped to a number, may
   *                           // be `NaN` if it could not be properly
   *                           // detected. Do not assume!
   *   formatted: string,      // original input converted to number and
   *                           // re-formatted using the detected match
   *   original: string,       // original input wrapped in String() call
   *   currency: CurrencyInfo, // instance of `CurrencyInfo`
   *   score: number,          // the scoring value as a fractional value of tests
   *                           // conducted to determine a match
   * }
   * ```
   *
   * @param {*} formatted any value for which an attempt to determine the
   * language, country and locale will be made. This value will be wrapped
   * in call to {@link String} converting it to a string. For some objects
   * this may trigger an indirect call to {@link Object.valueOf}
   * @param {string[]} options.currencies an array of currencies to test for;
   * if this value is not supplied it defaults to `['USD', 'CAD']`
   * @param {string[]} options.languages an array of language codes to test
   * for; if this value is not supplied it defaults to `['en', 'es', 'fr']`
   * @param {string[]} options.countries an array of country codes to test
   * for; if this value is not supplied it defaults to `['US', 'CA']`
   * @param {object|CurrencyInfo} options.assume defaults to `undefined`, but
   * can be either a plain object with `locale` and `currency` string
   * properties, or an instanceof {@link CurrencyInfo}
   * @param {string} options.assume.locale a language and country code to
   * use if a locale could not be determined; defaults to undefined
   * @param {string} options.assume.currency a currency code to default to
   * if a currency could not be determined; defaults to undefined
   * @returns {object} if the currency information can be detected from
   * the supplied info and object meeting the specification described above
   * will be returned. If no currency information could be detected, and
   * valid values for `assume` are provided, that currency information will
   * be used, but the score will be 0. If no information could be determined
   * and no assume values are provided, `null` will be returned.
   */
  static detect(formatted, options = {}) {
    // Ensure formatted is a string. This will work for any input value
    formatted = String(formatted)

    // Extract the values to use from the supplied options object and
    // inject default values if they were not manually supplied by the
    // caller.
    let {
      currencies = ['USD', 'CAD'],
      languages = ['en', 'es', 'fr'],
      countries = ['US', 'CA'],
      assume = undefined, // { locale: 'en-US', currency: 'USD' }
    } = Object(options)

    // Generate locales from the combination of languages and countries
    // supplied in the options above
    const locales = countries.reduce((acc, country) => {
      for (const language of languages) {
        acc.push(`${language}-${country}`)
      }
      return acc
    }, []);

    // Convert all of our locales and supplied or default currency codes
    // into CurrencyInfo instances. These will be cached instances if they've
    // already been created before.
    const currencyData = currencies.reduce(
      (acc, currency) => {
        locales
          /* Converts each locale, currency combo into a CurrencyInfo */
          .map(locale => CurrencyInfo.get(currency, locale))

          /* Adds each CurrencyInfo instance to the locale's array */
          .forEach(currencyInfo => acc[currencyInfo.locale].push(currencyInfo));

        return acc
      },

      // Starting value will be an object with an empty array for each locale
      locales.reduce((acc, locale) => { acc[locale] = []; return acc }, {})
    )

    // Create scoreboard for checks made on each combination
    let scoreboard = {}

    // Let's walk our list of locale and currency info object lists
    for (const currencies of Object.values(currencyData)) {
      for (const info of currencies) {
        const locale = info.locale
        const { group, decimal, symbol } = info.regex
        const amount = info.strip(formatted)
        const reformatted = info.format(amount)

        let score = 0;

        // If this CurrencyInfo stripped amount number is NaN, this locale
        // currency combo is not a match, move on
        if (isNaN(amount)) {
          continue;
        }

        // If the reformatted string perfectly matches the original, we have
        // a 100% score match. Simply return it now and skip the loops.
        if (reformatted == formatted) {
          return {
            locale,
            amount,
            formatted: reformatted,
            currencyInfo: info,
            score: 1.0
          }
        }

        // Count the grouping markers and decimal markers
        const numberOfGroupSeparators = formatted.match(group())?.length ?? 0
        const numberOfDecimalSeparators = formatted.match(decimal())?.length ?? 0

        // If we have more than one count of a decimal marker, we have invalid
        // data and this locale/currency combo is not a match; move on
        if (numberOfDecimalSeparators > 1) {
          continue
        }

        // Count the number of times the curency symbol appeared
        const numberOfSymbols = formatted.match(symbol())?.length ?? 0

        // Check the position of the currency marker in the original formatted
        // string and the reformatted string from a stripped number
        const iSymbolPosition = info.symbol.locator(formatted)
        const oSymbolPosition = info.symbol.locator(reformatted)

        // If we have multiple counts of grouping separators, we likely have
        // a match, increase our score
        if (numberOfGroupSeparators) {
          score++

          // If there is more than one, its more likey a comaptible match
          // so we should increase the score here too
          if (numberOfGroupSeparators > 1) score++
        }

        // Having a matching decimal separator score earns a point
        if (numberOfDecimalSeparators) {
          score++

          // If there is exactly 1 decimal separator, add a point
          if (numberOfDecimalSeparators == 1) score++
        }

        // If we have at least one currency symbol marker that matches the
        // locale/currency configuration, add a point
        if (numberOfSymbols > 0) {
          score++

          // We get another point if the position of the currency marker is
          // the same in formatted and reformatted values.
          if (iSymbolPosition == oSymbolPosition)
            score++

          // However if the symbol positions are not equal, leading vs trailing
          // or leading vs missing, for example, we likey do not have valid
          // match, so let's deduct a point
          else
            score--
        }

        // Clamp the calculated score to number from 0 to 6. Just to be
        // consistent with expectations
        score = Math.max(0, Math.min(6, score))

        // Store the results in the scoreboard and move on to the next
        // combination of currency, language and locale
        scoreboard[locale] = {
          score: score / 6,
          currencyInfo: info
        }
      }
    }

    // If we are here, we didn't find a perfect match. So lets start the
    // scoreboard comparisons. We will reduce them down to a single result
    let result = Object.entries(scoreboard).reduce(
      (acc, [locale, {score, currencyInfo}]) => {
        // If we have a valid .locale property and score that is greater than
        // zero OR if we have a score already and that score is less than
        // the current score, lets take that value
        if ((!acc.locale && score > 0) || acc.score < score) {
          acc.locale = locale
          acc.amount = currencyInfo.strip(formatted)
          acc.formatted = currencyInfo.format(acc.amount)
          acc.score = score
          acc.currencyInfo = currencyInfo
        }

        return acc
      },

      // The starting value will be a result object with a null or undefined
      // value for the .locale, .amount, .formatted, and .currencyInfo
      // properties. These will be filled with the highest scoring values
      // in the reduction process.
      {
        locale: null,
        amount: undefined,
        formatted: null,
        original: formatted,
        currencyInfo: null,
        score: 0
      }
    )

    // If we ended up with a reduced value that has no assigned .locale
    // property, we didn't find any scoring matches. Check to see if we
    // have provided an assumption object. This can be an object with
    // a locale AND currenc code or a CurrencyInfo instance which also
    // has these properties.
    if (!result.locale && assume && typeof assume === 'object') {
      const { locale: assumedLocale, currency: assumedCurency } = assume

      // If everything checks out, use a matching CurrencyInfo instance
      // to adjust our reduced value to the assumption result values. Note
      // this process will still result in a score of 0 but will have
      // values formatted and stripped according to the provided assumption's
      // localizations. This may result in NaN amounts and unexpected formatted
      // string values.
      if (assumedLocale && assumedCurency) {
        result.locale = assumedLocale
        result.currency = assumedCurency
        result.currencyInfo = CurrencyInfo.get(assumedCurency, assumedLocale)
        result.amount = result.currencyInfo.strip(formatted)
        result.formatted = result.currencyInfo.format(result.amount)
      }
    }

    // Return the reduced result only if it has a truthy .locale property,
    // othewise return null specifically.
    return result.locale ? result : null
  }

  /**
   * A quick function to ensure we can escape string input to dynamically
   * created {@link RegExp} class instances. This will escape any provided
   * value, which is ensured to be converted to a {@link String} if it is
   * not already a string.
   *
   * So values like `.` or `$` or `^` which all possess special meanings
   * in regular expressions will be escaped in the supplied string.
   *
   * @param {*} string a value that will be wrapped in the {@link String}
   * function. Values that are already strings will remain as such, but
   * values that are not will be converted into one.
   * @returns {string} a regular expression safe string
   */
  static escapeRegExp(string) {
    return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * Shorthand alias function that will create a new instance of
   * {@link CurrencyInfo} or retrieve an already cached version. This function
   * provides semantic readability but is identical to calling this class with
   * `new` keyword.
   *
   * @param {string} currency the type of currency such as `CAD` or `USD`
   * @param {string} [locale = 'en-US'] a language and country code to help
   * determine how currency should be string formatted. defaults to `en-US`
   * if no value is supplied
   * @param {boolean} [doNotThrow = false] if {@link true}, errors are
   * returned instead of thrown, otherwise errors validating input or JS
   * runtime capabilities are thrown during object creation.
   * @returns {CurrencyInfo|Error} either a newly created and cached instance
   * of {@link CurrencyInfo} or a previously created and cached instance. The
   * function is pure in the sense that like input creates like output every
   * time. An {@link Error} instance can be returned if `doNotThrow` is set to
   * {@link true}.
   *
   * @throws {Error} if {@link Intl} is not present in your JavaScript runtime
   * @throws {TypeError} if currency is not in the list returned by a call to
   * {@link Intl.supportedValuesOf} ('currency')
   * @throws {RangeError} if incorrect locale information is supplied to a
   * call to {@link Intl.getCanonicalLocales} with the supplied `locale`   */
  static get(currency, locale = 'en-US', doNotThrow = false) {
    return new this(currency, locale)
  }

  /**
   * A semantic alternative to `value instanceof CurrencyInfo` that will
   * dynamically check if the supplied value is an instance of this class
   *
   * @param {*} value any value to be tested using `instanceof CurrencyInfo`
   * @returns {@link true} if the supplied value is an instance of this class
   * or {@link false} otherwise
   */
  static isCurrencyInfo(value) {
    return value instanceof this
  }

  /**
   * Checks with the runtime's knowledge of international currencies. These
   * can be found by calling `Intl.supportedValuesOf('currency')` which
   * returns an {@link Array} of supported currency {@link String} codes.
   *
   * @param {*} currency a value to check as a valid {@link Intl} currency
   * code such as `USD`
   * @returns {true|TypeError} an instance of {@link TypeError} if the currency
   * is an unknown code, or {@link true} if it is properly recognized in a
   * the results of a call to {@link Intl.supportedValuesOf} with `currency`
   * as a parameter.
   */
  static validateCurrency(currency) {
    if (!Intl.supportedValuesOf('currency').includes(currency)) {
      return new TypeError(`Currency value ${currency} is not supported`)
    }

    return true
  }

  /**
   * Checks with the runtime's knowledge of canonical locales. The ECMAScript
   * {@link Intl} library does not, as of the time of this writing, provide a
   * dynamic list of known `language-Country` codes, however it will throw an
   * error if an invalid input in a call to {@link Intl.getCanonicalLocales}
   * is performed. So this function relies on that knowledge and captures the
   * error if one is raised. Otherwise, {@link true} will be returned if no
   * error is thrown in the process of checking.
   *
   * @param {*} locale a value to check as a valid {@link Intl} locale
   * code such as `en-US`
   * @returns {true|RangeError} an instance of {@link RangeError} if the locale
   * is an unknown code, or {@link true} if it is properly recognized in a
   * the results of a call to {@link Intl.getCanonicalLocales}.
   */
  static validateLocale(locale) {
    try {
      locale = Intl.getCanonicalLocales(locale)
    }
    catch (error) {
      return error
    }

    return true
  }

  /**
   * Checks the runtime for {@link Intl} capabilities and returns {@link true}
   * or an instance of {@link Error} the needed functions and classes are
   * not present.
   *
   * @returns {true|Error} {@link true} if {@link Intl} and its needed
   * classes and functions are present, or an {@link Error} indicating
   * the JavaScript runtime this function is executed in does not have
   * sufficient ECMAScript internationalization capabillities
   */
  static validateRuntime() {
    if (
      typeof globalThis == 'undefined' ||
      typeof globalThis.Intl != 'object' ||
      typeof Intl.supportedValuesOf != 'function' ||
      typeof Intl.getCanonicalLocales != 'function' ||
      typeof Intl.NumberFormat != 'function'
    ) {
      return new Error(`Your JavaScript runtime does not support Intl`)
    }

    return true
  }

  /** @returns alias for `CurrencyInfo.get('USD', 'en-US')` */
  static get USD() { return this.get('USD', 'en-US') }

  /** @returns alias for `CurrencyInfo.get('CAD', 'fr-CA')` */
  static get CAD() { return this.get('CAD', 'fr-CA') }

  /** @returns alias for `CurrencyInfo.get('CAD', 'en-CA')` */
  static get enCAD() { return this.get('CAD', 'en-CA') }

  /** @returns alias for `CurrencyInfo.get('CAD', 'fr-CA')` */
  static get frCAD() { return this.CAD }
}


export { CurrencyInfo }
export default CurrencyInfo
