import React from 'react';
import { cn } from '../../utils/cn';

export function MetricsRow({ children, className }) {
  return (
    <div className={cn("grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4 w-full auto-rows-fr", className)}>
      {children}
    </div>
  );
}
