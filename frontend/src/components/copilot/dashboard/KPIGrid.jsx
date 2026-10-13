import React from 'react';

export function KPIGrid({ children, className = '' }) {
  return (
    <div className={`grid grid-cols-2 gap-2.5 sm:gap-3 w-full my-3 ${className}`}>
      {children}
    </div>
  );
}

export default KPIGrid;
