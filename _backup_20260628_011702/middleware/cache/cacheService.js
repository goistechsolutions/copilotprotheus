// middleware/cache/cacheService.js  (npm install node-cache)
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 60, checkperiod: 30 });

function buildKey(intent, ctx) {
  return [intent, ctx.environment, ctx.company, ctx.branch, ctx.user || ""].join("|");
}
const get        = (i, c)    => cache.get(buildKey(i, c)) || null;
const set        = (i, c, d) => cache.set(buildKey(i, c), d);
const invalidate = (i, c)    => cache.del(buildKey(i, c));

module.exports = { get, set, invalidate };
