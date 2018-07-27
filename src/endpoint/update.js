const buffer = require('most-buffer');
const most = require('most');

const Common = require('./common');
const Constants = require('../constants');
const Provider = require('../provider');
const Utils = require('../utils');


async function update(records, options) {
  this.debug('updating');

  const agent = this.agent;
  const agentId = this.agentId;
  const client = this.kit.client;
  const energy = this.energy;
  const features = this.features;
  const end = agent.lastTimestamp;

  let stream = Common.toRecordStream(records, options && options.import);
  let failed = false;

  if (energy.period) stream = energy.origin
    ? stream.thru(convertAccumulatedEnergyToLoad.bind(null, energy))
    : stream.tap(convertEnergyToLoad.bind(null, energy.hours));

  return stream
    // Extend the record with providers
    .thru(Provider.extendRecords.bind(null, this))
    .thru(end === undefined
      ? Common.mergeUntilFirstFullRecord.bind(null, features)
      : ignoreOldRecords.bind(null, end))
    // Send the context operations by bulks.
    .thru(Common.formatRecords.bind(null, features))
    .thru(buffer(client.cfg.operationsChunksSize))
    .recoverWith((error) => {
      // TODO: proper error handling
      failed = true;

      return most.throwError(error);
    })
    .concatMap((history) => most.fromPromise(client
      .addAgentContextOperations(agentId, history)
      .then(() => {
        this.debug('added %d records to the agent\'s history', history.length);

        return history;
      })
      .catch(/* istanbul ignore next */(error) => {
        if (!failed) throw error;
      })))
    // Update agent's local state
    .reduce((result, history) => {
      if (!result.start) result.start = history[0].timestamp;

      result.end = history[history.length - 1].timestamp;

      return result;
    }, { start: agent.start, end })
    .then((result) => {
      agent.firstTimestamp = result.start;
      agent.lastTimestamp = result.end;
      agent.lastContextUpdate = Date.now();
      this.debug('updated', agentId);

      return this;
    });
}


function convertAccumulatedEnergyToLoad(energy, records) {
  const period = energy.period;
  const origin = energy.origin;

  return records.loop((seed, record) => {
    const date = record[PARSED_RECORD][DATE];
    const interval = Utils.getInterval(origin, period, date, seed.date);

    if (seed.date && interval.toDuration() <= period) {
      const previous = seed.record;
      const hours = (record[DATE] - previous[DATE]) / 3600;

      if (record[LOAD] === undefined) record[LOAD] = (record[ENERGY] - previous[ENERGY]) / hours;
      else record[ENERGY] = previous[ENERGY] + record[LOAD] * hours;
    } else {
      seed.date = Utils.roundDate(interval, period);

      const hours = date.diff(seed.date, 'hours').hours;

      if (record[LOAD] === undefined) record[LOAD] = record[ENERGY] / hours;
      else record[ENERGY] = record[LOAD] * hours;
    }

    seed.record = { ...record };

    return { seed, value: record };
  }, { record: null, date: null });
}

function convertEnergyToLoad(hours, record) {
  if (record[LOAD] !== undefined) return;

  record[LOAD] = record[ENERGY] / hours;
}

function ignoreOldRecords(lastSavedRecordDate, records) {
  return records.skipWhile((record) => record[DATE] <= lastSavedRecordDate);
}


const DATE = Constants.DATE_FEATURE;
const ENERGY = Constants.ENERGY_FEATURE;
const LOAD = Constants.LOAD_FEATURE;
const PARSED_RECORD = Constants.PARSED_RECORD;


module.exports = update;
