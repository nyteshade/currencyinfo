  const { CurrencyInfo } = require('../dist/currencyinfo.js')

  describe('CurrencyInfo', () => {
    describe('constructor and get', () => {
      it('should create a new instance', () => {
        const info = new CurrencyInfo('USD', 'en-US');
        expect(info).toBeInstanceOf(CurrencyInfo);
      });

      it('should return cached instance', () => {
        const info1 = CurrencyInfo.get('USD', 'en-US');
        const info2 = CurrencyInfo.get('USD', 'en-US');
        expect(info1).toBe(info2);
      });

      it('should throw error for invalid currency', () => {
        expect(() => new CurrencyInfo('INVALID', 'en-US')).toThrow(TypeError);
      });

      it('should throw error for invalid locale', () => {
        expect(() => new CurrencyInfo('USD', 'en_US')).toThrow(RangeError);
      });

      it('should return error instead of throwing when doNotThrow is true', () => {
        const result = new CurrencyInfo('INVALID', 'en-US', true);
        expect(result).toBeInstanceOf(Error);
      });
    });

    describe('format and strip', () => {
      const usd = CurrencyInfo.get('USD', 'en-US');
      const cad = CurrencyInfo.get('CAD', 'fr-CA');

      it('should format numbers correctly', () => {
        expect(usd.format(1234.56)).toBe('$1,234.56');
        expect(cad.format(1234.56)).toBe('1 234,56 $');
      });

      it('should strip formatted strings correctly', () => {
        expect(usd.strip('$1,234.56')).toBe(1234.56);
        expect(cad.strip('1 234,56 $')).toBe(1234.56);
      });
    });

    describe('symbolPosition', () => {
      const usd = CurrencyInfo.get('USD', 'en-US');

      it('should correctly identify symbol positions', () => {
        expect(usd.symbol.locator('$100')).toBe('leading');
        expect(usd.symbol.locator('100$')).toBe('trailing');
        expect(usd.symbol.locator('1$00')).toBe('within');
        expect(usd.symbol.locator('100')).toBe('missing');
      });

      it('should work with formatToParts array', () => {
        const parts = [
          { type: 'currency', value: '$' },
          { type: 'integer', value: '100' },
        ];
        expect(usd.symbol.locator(parts)).toBe('leading');
      });
    });

    describe('static methods', () => {
      it('should escape RegExp special characters', () => {
        expect(CurrencyInfo.escapeRegExp('$.')).toBe('\\$\\.');
      });

      it('should validate currency codes', () => {
        expect(CurrencyInfo.validateCurrency('USD')).toBe(true);
        expect(CurrencyInfo.validateCurrency('INVALID')).toBeInstanceOf(TypeError);
      });

      it('should validate locales', () => {
        expect(CurrencyInfo.validateLocale('en-US')).toBe(true);
        expect(CurrencyInfo.validateLocale('en_US')).toBeInstanceOf(RangeError);
      });

      it('should validate runtime capabilities', () => {
        expect(CurrencyInfo.validateRuntime()).toBe(true);
      });

      it('should check if value is CurrencyInfo instance', () => {
        expect(CurrencyInfo.isCurrencyInfo(new CurrencyInfo('USD', 'en-US'))).toBe(true);
        expect(CurrencyInfo.isCurrencyInfo({})).toBe(false);
      });
    });

    describe('detect', () => {
      it('should detect USD', () => {
        const result = CurrencyInfo.detect('$1,234.56');
        expect(result.locale).toBe('en-US');
        expect(result.currencyInfo.currency).toBe('USD');
        expect(result.score).toBeGreaterThan(0);
      });

      it('should detect invalid decimals', () => {
        const result = CurrencyInfo.detect('$1,234.56.23');
        expect(result).toBeNull();
      });

      it('should detect large USD', () => {
        const result = CurrencyInfo.detect('$123,456,789.23');
        expect(result.locale).toBe('en-US');
        expect(result.currencyInfo.currency).toBe('USD');
        expect(result.score).toBeGreaterThan(0);
      });

      it('should detect CAD', () => {
        const result = CurrencyInfo.detect('1 234,56 $');
        expect(result.locale).toBe('fr-CA');
        expect(result.currencyInfo.currency).toBe('CAD');
        expect(result.score).toBeGreaterThan(0);
      });

      it('should return null for undetectable input', () => {
        expect(CurrencyInfo.detect('abc')).toBeNull();
      });

      it('should use assume option when detection fails', () => {
        const localeCurrency = { locale: 'en-US', currency: 'USD' }
        const result = CurrencyInfo.detect(123, { assume: localeCurrency });

        expect(result.locale).toBe('en-US');
        expect(result.currencyInfo.currency).toBe('USD');
        expect(result.score).toBe(0);
      });

      it('should use assume option with CurrencyInfo when detection fails', () => {
        const result = CurrencyInfo.detect(123, { assume: CurrencyInfo.USD });

        expect(result.locale).toBe('en-US');
        expect(result.currencyInfo.currency).toBe('USD');
        expect(result.score).toBe(0);
      })

      it('should handle custom currencies and locales', () => {
        const result = CurrencyInfo.detect('£1,234.56', {
          currencies: ['GBP'],
          languages: ['en'],
          countries: ['GB']
        });
        expect(result.locale).toBe('en-GB');
        expect(result.currencyInfo.currency).toBe('GBP');
      });
    });

    describe('static getters', () => {
      it('should return correct instances for USD and CAD', () => {
        expect(CurrencyInfo.USD.currency).toBe('USD');
        expect(CurrencyInfo.USD.locale).toBe('en-US');
        expect(CurrencyInfo.CAD.currency).toBe('CAD');
        expect(CurrencyInfo.CAD.locale).toBe('fr-CA');
        expect(CurrencyInfo.enCAD.locale).toBe('en-CA');
        expect(CurrencyInfo.frCAD).toBe(CurrencyInfo.CAD);
      });
    });

    describe('Symbol.toStringTag', () => {
      it('should return correct string representation', () => {
        const info = new CurrencyInfo('USD', 'en-US');
        expect(Object.prototype.toString.call(info)).toBe('[object CurrencyInfo]');
      });
    });
  });
