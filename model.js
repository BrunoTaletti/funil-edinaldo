(function (root) {
  'use strict';
  const schema = Object.freeze({
    visitors: { min: 0, max: 1000000, value: 5000, integer: true },
    communityRate: { min: 0, max: 10, value: 1 },
    midRate: { min: 0, max: 20, value: 3 },
    consultRate: { min: 0, max: 20, value: 5 },
    communityPrice: { min: 10, max: 500, value: 49.9 },
    midPrice: { min: 993, max: 10000, value: 1497 },
    consultPrice: { min: 15000, max: 100000, value: 20000 },
    directRate: { min: 0, max: 2, value: 0.1 },
    churn: { min: 0, max: 100, value: 8 },
    costRate: { min: 0, max: 100, value: 30 },
    midCapacity: { min: 0, max: 200, value: 20, integer: true },
    consultCapacity: { min: 0, max: 5, value: 1, integer: true },
    investmentShare: { min: 0, max: 100, value: 40, integer: true },
    acquisitionShare: { min: 0, max: 100, value: 30, integer: true },
    annualReturn: { min: 0, max: 15, value: 8 },
    incomeGoal: { min: 100, max: 100000, value: 3000 }
  });
  const defaults = Object.freeze(Object.fromEntries(Object.entries(schema).map(([key, rule]) => [key, rule.value])));

  function sanitize(input = {}) {
    const result = {};
    for (const [key, rule] of Object.entries(schema)) {
      const raw = input[key];
      let number = raw === '' || raw === null || raw === undefined ? rule.value : Number(raw);
      if (!Number.isFinite(number)) number = rule.value;
      number = Math.min(rule.max, Math.max(rule.min, number));
      result[key] = rule.integer ? Math.floor(number) : Math.round(number * 100) / 100;
    }
    result.acquisitionShare = Math.min(result.acquisitionShare, 100 - result.investmentShare);
    return result;
  }

  function simulate(input) {
    const config = sanitize(input);
    const myhubShare = 100 - config.investmentShare - config.acquisitionShare;
    const monthlyReturn = Math.pow(1 + config.annualReturn / 100, 1 / 12) - 1;
    const newMembers = Math.floor(config.visitors * config.communityRate / 100);
    const months = [];
    let members = 0;
    let pipeline = 0;
    let portfolio = 0;
    let acquisitions = 0;
    let myhub = 0;
    const totals = { communityRevenue: 0, midRevenue: 0, consultRevenue: 0, gross: 0, costs: 0, net: 0, investment: 0, acquisition: 0, myhubDeposit: 0, midBuyers: 0, consultCount: 0 };

    for (let month = 1; month <= 12; month++) {
      members = Math.floor(members * (1 - config.churn / 100) + 1e-9) + newMembers;
      const communityBuyers = Math.min(Math.floor(members * config.midRate / 100), config.midCapacity);
      // Both acquisition rates are expressed per channel view; views are not unique people.
      const directBuyers = Math.min(Math.floor(config.visitors * config.directRate / 100), config.midCapacity - communityBuyers);
      const midBuyers = communityBuyers + directBuyers;
      pipeline += midBuyers * config.consultRate / 100;
      const consultCount = Math.min(Math.floor(pipeline + 1e-9), config.consultCapacity);
      pipeline = Math.max(0, pipeline - consultCount);
      const communityRevenue = members * config.communityPrice;
      const midRevenue = midBuyers * config.midPrice;
      const consultRevenue = consultCount * config.consultPrice;
      const gross = communityRevenue + midRevenue + consultRevenue;
      const costs = gross * config.costRate / 100;
      const net = gross - costs;
      const investment = net * config.investmentShare / 100;
      const acquisition = net * config.acquisitionShare / 100;
      // Use the remainder so that every cent is assigned, even with floating-point arithmetic.
      const myhubDeposit = net - investment - acquisition;
      portfolio = portfolio * (1 + monthlyReturn) + investment;
      acquisitions += acquisition;
      myhub += myhubDeposit;
      const values = { communityRevenue, midRevenue, consultRevenue, gross, costs, net, investment, acquisition, myhubDeposit, midBuyers, consultCount };
      for (const key of Object.keys(totals)) totals[key] += values[key];
      months.push({ month, members, newMembers, communityBuyers, directBuyers, ...values, portfolio, acquisitions, myhub, pipeline, cumulative: { ...totals } });
    }
    const requiredCapital = monthlyReturn > 0 ? config.incomeGoal / monthlyReturn : null;
    let memberLtv = 0;
    for (let month = 0; month < 12; month++) memberLtv += config.communityPrice * Math.pow(1 - config.churn / 100, month);
    return { config, myhubShare, monthlyReturn, newMembers, memberLtv, requiredCapital, months, totals, portfolioIncome: portfolio * monthlyReturn };
  }

  const api = Object.freeze({ schema, defaults, sanitize, simulate });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FunnelModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
