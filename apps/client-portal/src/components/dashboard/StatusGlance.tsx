import React from 'react';
import { FileText, Clock, AlertCircle, CheckCircle, Calendar, TrendingUp } from 'lucide-react';

interface StatusCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  color: string;
}

const StatusCard: React.FC<StatusCardProps> = ({ icon, label, value, subtext, color }) => (
  <div className={`bg-white rounded-lg p-4 border-l-4 ${color}`}>
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <p className="text-sm text-gray-600 mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
      </div>
      <div className="text-gray-400">
        {icon}
      </div>
    </div>
  </div>
);

export const StatusGlance: React.FC = () => {
  const statusData = {
    caseStatus: 'In Review',
    openTasks: 3,
    upcomingDeadlines: 2,
    completedForms: 12,
    daysInUSA: 912,
    nextAppointment: 'Dec 15, 2024'
  };

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Your Immigration Status at a Glance</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatusCard
          icon={<FileText className="w-6 h-6" />}
          label="USCIS Case Status"
          value={statusData.caseStatus}
          subtext="Last updated 2 days ago"
          color="border-blue-500"
        />
        <StatusCard
          icon={<Clock className="w-6 h-6" />}
          label="Open Tasks"
          value={statusData.openTasks}
          subtext="2 high priority"
          color="border-yellow-500"
        />
        <StatusCard
          icon={<AlertCircle className="w-6 h-6" />}
          label="Upcoming Deadlines"
          value={statusData.upcomingDeadlines}
          subtext="Next: RFE response in 7 days"
          color="border-red-500"
        />
        <StatusCard
          icon={<CheckCircle className="w-6 h-6" />}
          label="Completed Forms"
          value={statusData.completedForms}
          subtext="All saved securely"
          color="border-green-500"
        />
        <StatusCard
          icon={<TrendingUp className="w-6 h-6" />}
          label="Days in USA"
          value={statusData.daysInUSA}
          subtext="Your journey continues"
          color="border-purple-500"
        />
        <StatusCard
          icon={<Calendar className="w-6 h-6" />}
          label="Next Appointment"
          value={statusData.nextAppointment}
          subtext="Interview scheduled"
          color="border-indigo-500"
        />
      </div>
    </div>
  );
};