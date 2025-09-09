import React from 'react';
import { ChevronRight } from 'lucide-react';

interface QuickActionCardProps {
  title: string;
  subtitle?: string;
  cta: string;
  onClick: () => void;
  icon?: React.ReactNode;
  badge?: string;
  priority?: 'high' | 'medium' | 'low';
}

export const QuickActionCard: React.FC<QuickActionCardProps> = ({
  title,
  subtitle,
  cta,
  onClick,
  icon,
  badge,
  priority
}) => {
  const priorityColors = {
    high: 'border-red-500 bg-red-50',
    medium: 'border-yellow-500 bg-yellow-50',
    low: 'border-green-500 bg-green-50'
  };

  return (
    <div 
      className={`
        bg-white rounded-xl shadow-sm hover:shadow-lg transition-all cursor-pointer
        border-2 ${priority ? priorityColors[priority] : 'border-gray-200'}
        p-6 group
      `}
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        {icon && (
          <div className="text-3xl flex-shrink-0">
            {icon}
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {badge && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-gray-600 mb-4">
              {subtitle}
            </p>
          )}
          <button className="inline-flex items-center gap-2 text-blue-600 font-medium hover:text-blue-700 group-hover:gap-3 transition-all">
            {cta}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};