  // Body of script ends

  var target = (
    (typeof globalThis != 'undefined') ? globalThis :
    (typeof window != 'undefined') ? window :
    (typeof global != 'undefined') ? global :
    undefined
  );

  if (target) {
    target.CurrencyInfo = CurrencyInfo;
  }
})()
