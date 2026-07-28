const variants = {
  default: 'bg-[#1E2535] text-[#8892A4]',
  blue: 'bg-[#1565C0]/20 text-[#2196F3] border border-[#1565C0]/30',
  green: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
  red: 'bg-red-500/15 text-red-400 border border-red-500/20',
  yellow: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  purple: 'bg-purple-500/15 text-purple-400 border border-purple-500/20',
};

export default function Badge({ children, variant = 'default', className = '' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
