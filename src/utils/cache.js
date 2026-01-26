import NodeCache from "node-cache";

// 60 seconds cache (you can increase later)
export const menuCache = new NodeCache({
  stdTTL: 60,
  checkperiod: 120,
});
