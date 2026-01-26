import NodeCache from "node-cache";

export const menuCache = new NodeCache({
  stdTTL: 300,   // 5 minutes instead of 1
  checkperiod: 600,
});
