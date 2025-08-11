const i18n = require('i18next');
const Backend = require('i18next-fs-backend');

i18n.use(Backend).init({
  fallbackLng: 'es',
  preload: ['en', 'es'],
  backend: {
    loadPath: __dirname + '/locales/{{lng}}/translation.json'
  }
});

module.exports = i18n;
