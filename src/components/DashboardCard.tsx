import { ReactNode } from "react";

interface DashboardCardProps {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function DashboardCard({ title, icon, action, children, className = "" }: DashboardCardProps) {
  return (
    <div className={`bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg shadow-primary/5 overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="p-2 rounded-xl bg-muted/50">
              {icon}
            </div>
          )}
          <h2 className="text-base font-heading font-bold text-foreground">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}
