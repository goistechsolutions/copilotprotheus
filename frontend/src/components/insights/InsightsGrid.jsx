import React from 'react';
import { cn } from '../../utils/cn';

export function InsightsGrid({ children, className }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 lg:grid-cols-2", className)}>
      {children}
    </div>
  );
}
