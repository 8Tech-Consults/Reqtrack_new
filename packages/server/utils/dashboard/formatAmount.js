function formatAmount(amount) {
  if (amount >= 1_000_000_000) return `${round1(amount / 1_000_000_000)}B`;
  if (amount >= 1_000_000) return `${round1(amount / 1_000_000)}M`;
  if (amount >= 1_000) return `${round1(amount / 1_000)}K`;
  return String(amount);
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

module.exports = { formatAmount };