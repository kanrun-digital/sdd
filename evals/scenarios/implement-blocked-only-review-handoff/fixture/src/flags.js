// Feature flags — tiny fixture module (T1's committed work).
const FLAGS = new Map([['beta_banner', true]]);

function isEnabled(name) {
  return FLAGS.get(name) === true;
}

module.exports = { isEnabled };
