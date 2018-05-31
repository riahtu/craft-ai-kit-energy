const luxon = require('luxon');
const test = require('ava');

const Provider = require('../../src/provider');
const SchoolHolidaysProvider = require('../../src/providers/school_holidays');


test('fails initializing the provider with invalid options', (t) => {
  const INVALID_OPTIONS = [null, undefined, 1228, false, Promise.resolve(), Symbol(), '', 'Jupiter'];

  return Promise.all(INVALID_OPTIONS
    .concat(INVALID_OPTIONS.map((option) => ({ country: option })))
    .map((option) => t.throws(SchoolHolidaysProvider.initialize({ options: option }))));
});

test('initializes the provider', (t) => {
  return initializeProvider().then((provider) => t.snapshot(provider));
});

test('computes the configuration\'s extension', (t) => {
  return initializeProvider().then((provider) => provider
    .extendConfiguration()
    .then((extension) => {
      t.truthy(extension);
      t.is(typeof extension, 'object');
      t.snapshot(extension);
    }));
});

test('computes the record\'s extension in Paris', (t) => {
  return WINDOW.reduce((promise, date) => promise
    .then(initializeProvider)
    .then((provider) => provider
      .extendRecord({ metadata: { region: '75' } }, date)
      .then((extension) => {
        t.truthy(extension);
        t.is(typeof extension, 'object');
        t.is(extension.holiday === 'YES', isHoliday(date, PARIS_HOLIDAYS));
      })), Promise.resolve());
});

test('computes the record\'s extension in Lille', (t) => {
  return WINDOW.reduce((promise, date) => promise
    .then(initializeProvider)
    .then((provider) => provider
      .extendRecord({ metadata: { region: '59' } }, date)
      .then((extension) => {
        t.truthy(extension);
        t.is(typeof extension, 'object');
        t.is(extension.holiday === 'YES', isHoliday(date, LILLE_HOLIDAYS));
      })), Promise.resolve());
});

test('computes the record\'s extension in Caen', (t) => {
  return WINDOW.reduce((promise, date) => promise
    .then(initializeProvider)
    .then((provider) => provider
      .extendRecord({ metadata: { region: '14' } }, date)
      .then((extension) => {
        t.truthy(extension);
        t.is(typeof extension, 'object');
        t.is(extension.holiday === 'YES', isHoliday(date, CAEN_HOLIDAYS));
      })), Promise.resolve());
});

test('handles computing the record\'s extension for an unknown region', (t) => {
  return WINDOW.reduce((promise, date) => promise
    .then(initializeProvider)
    .then((provider) => provider
      .extendRecord({ metadata: { region: '00' } }, date)
      .then((extension) => {
        t.truthy(extension);
        t.is(typeof extension, 'object');
        t.is(extension.holiday, 'UNKNOWN');
      })), Promise.resolve());
});

test('handles computing the record\'s extension with no school holidays information', (t) => {
  return WINDOW.reduce((promise, date) => promise
    .then(initializeProvider)
    .then((provider) => provider
      .extendRecord({ metadata: { region: '75' } }, date.minus({ year: 200 }))
      .then((extension) => {
        t.truthy(extension);
        t.is(typeof extension, 'object');
        t.is(extension.holiday, 'UNKNOWN');
      })), Promise.resolve());
});

test('closes the provider', (t) => {
  return initializeProvider().then((provider) => t.notThrows(provider.close()));
});


function initializeProvider() {
  return Provider.initialize({
    provider: SchoolHolidaysProvider,
    options: { ...PROVIDER_OPTIONS }
  }, 0);
}

function isHoliday(date, holidays) {
  return holidays.some((holidays) => date > DateTime.utc(...holidays[0]).endOf('day')
    && date < DateTime.utc(...holidays[1]).startOf('day'));
}


const PARIS_HOLIDAYS = [
  [[2017, 7, 31], [2017, 9, 4]],
  [[2017, 10, 21], [2017, 11, 6]],
  [[2017, 12, 23], [2018, 1, 8]],
  [[2018, 2, 17], [2018, 3, 5]],
  [[2018, 4, 14], [2018, 4, 30]],
  [[2018, 7, 7], [2018, 7, 31]],
];
const CAEN_HOLIDAYS = [
  [[2017, 7, 31], [2017, 9, 4]],
  [[2017, 10, 21], [2017, 11, 6]],
  [[2017, 12, 23], [2018, 1, 8]],
  [[2018, 2, 24], [2018, 3, 12]],
  [[2018, 4, 25], [2018, 5, 14]],
  [[2018, 7, 7], [2018, 7, 31]],
];
const LILLE_HOLIDAYS = [
  [[2017, 7, 31], [2017, 9, 4]],
  [[2017, 10, 21], [2017, 11, 6]],
  [[2017, 12, 23], [2018, 1, 8]],
  [[2018, 2, 24], [2018, 3, 12]],
  [[2018, 4, 21], [2018, 5, 7]],
  [[2018, 7, 7], [2018, 7, 31]],
];
const PROVIDER_OPTIONS = { country: 'fr' };
const DateTime = luxon.DateTime;

const WINDOW_START = DateTime.utc(...PARIS_HOLIDAYS[0][0]).plus({ day: 1 });
const WINDOW_END = DateTime.utc(...PARIS_HOLIDAYS[PARIS_HOLIDAYS.length - 1][1]);
const WINDOW = new Array(24 * WINDOW_END.diff(WINDOW_START).as('days'))
  .fill(null)
  .map((_, index) => WINDOW_START.plus({ hours: index }));