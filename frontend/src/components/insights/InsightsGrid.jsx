import React from 'react';
import { cn } from '../../utils/cn';

export function InsightsGrid({ children, className }) {
  return (
    <div className={cn("grid grid-cols-1 gap-3.5 sm:gap-4 md:grid-cols-2 w-full auto-rows-fr items-stretch", className)}>
      {children}
    </div>
  );
}
