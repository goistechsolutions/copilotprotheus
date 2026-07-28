export default function StatCard({ title, value, subtitle, icon: Icon, trend, color = 'blue' }) {
  const colors = {
    blue: { bg: 'bg-[#1565C0]/10', border: 'border-[#1565C0]/20', icon: 'text-[#2196F3]' },
    green: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'text-emerald-400' },
    yellow: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: 'text-amber-400' },
    red: { bg: 'bg-red-500/10', border: 'border-red-500/20', icon: 'text-red-400' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: 'text-purple-400' },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className={`bg-[#161B27] border ${c.border} rounded-xl p-5 hover:border-[#2196F3]/40 transition-all`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[#8892A4] text-xs font-medium uppercase tracking-wider mb-1">{title}</p>
          <p className="text-white text-2xl font-bold">{value}</p>
          {subtitle && <p className="text-[#8892A4] text-xs mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`w-10 h-10 ${c.bg} rounded-lg flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${c.icon}`} />
          </div>
        )}
      </div>
      {trend !== undefined && (
        <div className={`mt-3 flex items-center gap-1 text-xs ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          <span>{trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%</span>
          <span className="text-[#8892A4]">vs. mês anterior</span>
        </div>
      )}
    </div>
  );
}
