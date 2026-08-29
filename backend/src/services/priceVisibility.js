const maskPrice = (proposals, requesterId, jobCustomerId, _jobStatus) => {
  if (!proposals || proposals.length === 0) return proposals;

  // After payment recorded, final_price is public - but proposals are still masked for non-parties
  const allPrices = proposals
    .map(p => parseFloat(p.proposed_price))
    .filter(p => !isNaN(p) && p > 0);

  const priceRange = allPrices.length > 0
    ? `LKR ${Math.min(...allPrices).toLocaleString()}–${Math.max(...allPrices).toLocaleString()}`
    : null;

  return proposals.map(p => {
    // Customer who owns the job sees full prices
    if (requesterId === jobCustomerId) return p;
    // Worker sees their own proposal
    if (requesterId === p.worker_id) return p;
    // Everyone else gets masked
    return {
      ...p,
      proposed_price: null,
      price_range: priceRange,
    };
  });
};

module.exports = { maskPrice };
