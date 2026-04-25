export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' MMK';
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(dateString);
}

export function generateMatchCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export function getWinRate(wins: number, losses: number): string {
  const total = wins + losses;
  if (total === 0) return '0%';
  return ((wins / total) * 100).toFixed(1) + '%';
}

export function shortenId(id: string): string {
  if (id.length <= 12) return '#' + id;
  const prefix = id.substring(0, 4);
  const suffix = id.substring(id.length - 3);
  return `#${prefix}...${suffix}`;
}
