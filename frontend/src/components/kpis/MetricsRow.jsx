import React from 'react';
import { cn } from '../../utils/cn';

export function MetricsRow({ children, className }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {children}
    </div>
  );
}
