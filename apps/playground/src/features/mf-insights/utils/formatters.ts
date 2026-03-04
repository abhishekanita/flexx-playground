export const fmt = (n: number) =>
    '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export const fmtL = (n: number) =>
    n >= 100_000
        ? `₹${(n / 100_000).toFixed(1)}L`
        : n >= 1_000
          ? `₹${(n / 1_000).toFixed(0)}K`
          : fmt(n);

export const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

export const fmtDays = (days: number) => {
    if (days >= 365) return `${(days / 365).toFixed(1)} yrs`;
    if (days >= 30) return `${Math.round(days / 30)} mo`;
    return `${days} days`;
};
