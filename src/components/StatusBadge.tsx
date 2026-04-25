'use client';

import { MATCH_STATUS_CONFIG } from '@/lib/constants';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = MATCH_STATUS_CONFIG[status] || { label: status, color: '#6b7280', bgColor: 'rgba(107,114,128,0.15)' };

  return (
    <span
      className="status-badge"
      style={{
        color: config.color,
        background: config.bgColor,
        fontSize: size === 'sm' ? 10 : 12,
        padding: size === 'sm' ? '2px 8px' : '4px 12px',
      }}
    >
      {config.label}
    </span>
  );
}
