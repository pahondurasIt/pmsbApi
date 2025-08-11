const i18n = require('../i18n/i18n');

function t(key, lng = "en") {
  return i18n.t(key, { lng }); // aquí usamos directamente i18n.t()
}

module.exports = { t };
