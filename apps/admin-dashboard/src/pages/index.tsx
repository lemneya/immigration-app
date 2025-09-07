import { useQuery } from 'react-query';
import {
  ChartBarIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  ServerIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { format } from 'date-fns';
import { apiClient } from '@/services/apiClient';
import clsx from 'clsx';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

// Mock data for charts
const weeklyData = [
  { name: 'Mon', requests: 1200, errors: 12 },
  { name: 'Tue', requests: 1900, errors: 8 },
  { name: 'Wed', requests: 3000, errors: 15 },
  { name: 'Thu', requests: 2800, errors: 6 },
  { name: 'Fri', requests: 3900, errors: 18 },
  { name: 'Sat', requests: 2400, errors: 4 },
  { name: 'Sun', requests: 1800, errors: 2 },
];

const serviceData = [
  { name: 'OCR Service', value: 35 },
  { name: 'PDF Service', value: 28 },
  { name: 'E-Signature', value: 22 },
  { name: 'Case Status', value: 15 },
];

const statusData = [
  { status: 'Pending', count: 145, color: '#f59e0b' },
  { status: 'Approved', count: 89, color: '#10b981' },
  { status: 'In Review', count: 67, color: '#0ea5e9' },
  { status: 'Rejected', count: 23, color: '#ef4444' },
];

export default function Dashboard() {
  const { data: healthData, isLoading: healthLoading } = useQuery(
    'system-health',
    () => apiClient.getSystemHealth(),
    {
      refetchInterval: 30000, // Refresh every 30 seconds
    }
  );

  const { data: metricsData, isLoading: metricsLoading } = useQuery(
    'system-metrics',
    () => apiClient.getSystemMetrics(),
    {
      refetchInterval: 60000, // Refresh every minute
    }
  );

  const stats = [
    {
      name: 'Total Services',
      value: healthData?.data?.length || 4,
      change: '+2',
      changeType: 'positive',
      icon: ServerIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      name: 'Active Cases',
      value: '1,247',
      change: '+12%',
      changeType: 'positive',
      icon: ClipboardDocumentListIcon,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      name: 'Signature Requests',
      value: '324',
      change: '+4%',
      changeType: 'positive',
      icon: PencilSquareIcon,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      name: 'Documents Processed',
      value: '2,847',
      change: '+18%',
      changeType: 'positive',
      icon: DocumentTextIcon,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
    {
      name: 'Active Users',
      value: '189',
      change: '-2%',
      changeType: 'negative',
      icon: UsersIcon,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
    },
    {
      name: 'Response Time',
      value: `${metricsData?.data?.averageResponseTime || 245}ms`,
      change: '-15ms',
      changeType: 'positive',
      icon: ClockIcon,
      color: 'text-teal-600',
      bgColor: 'bg-teal-100',
    },
  ];

  const healthyServices = healthData?.data?.filter(s => s.status === 'healthy').length || 0;
  const totalServices = healthData?.data?.length || 4;

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Welcome to the Immigration Suite admin dashboard. Monitor your services, users, and operations.
          </p>
        </div>

        {/* System Status Banner */}
        <div className={clsx(
          'mb-6 rounded-lg border p-4',
          healthyServices === totalServices
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-yellow-50 border-yellow-200 text-yellow-800'
        )}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {healthyServices === totalServices ? (
                <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
              ) : (
                <ExclamationTriangleIcon className="h-5 w-5" />
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">
                {healthyServices === totalServices
                  ? `All systems operational • ${healthyServices}/${totalServices} services healthy`
                  : `${healthyServices}/${totalServices} services healthy • Some services need attention`
                }
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-8">
          {stats.map((stat) => (
            <div key={stat.name} className="metric-card">
              <div className="flex items-center">
                <div className={clsx('flex-shrink-0 p-3 rounded-md', stat.bgColor)}>
                  <stat.icon className={clsx('h-6 w-6', stat.color)} aria-hidden="true" />
                </div>
                <div className="ml-4 flex-1">
                  <div className="metric-value">{stat.value}</div>
                  <div className="flex items-center justify-between">
                    <div className="metric-label">{stat.name}</div>
                    <div className={clsx(
                      'text-xs font-medium',
                      stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                    )}>
                      {stat.change}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Request Volume Chart */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Request Volume</h3>
              <p className="card-description">Daily request volume and error rates over the past week</p>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="requests" 
                    stroke="#0ea5e9" 
                    strokeWidth={2}
                    dot={{ fill: '#0ea5e9', strokeWidth: 2, r: 4 }}
                    name="Requests"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="errors" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                    name="Errors"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Service Usage Distribution */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Service Usage</h3>
              <p className="card-description">Distribution of requests across services</p>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={serviceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {serviceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Service Health & Case Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Service Health */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Service Health</h3>
              <p className="card-description">Real-time status of all microservices</p>
            </div>
            <div className="space-y-3">
              {healthLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg animate-pulse">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                        <div className="w-24 h-4 bg-gray-300 rounded"></div>
                      </div>
                      <div className="w-16 h-4 bg-gray-300 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : (
                healthData?.data?.map((service) => (
                  <div key={service.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={clsx(
                        'w-3 h-3 rounded-full',
                        service.status === 'healthy' ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                      )} />
                      <span className="font-medium text-gray-900">{service.name}</span>
                      {service.responseTime && (
                        <span className="text-sm text-gray-500">
                          {service.responseTime}ms
                        </span>
                      )}
                    </div>
                    <span className={clsx(
                      'px-2 py-1 text-xs font-medium rounded-full',
                      service.status === 'healthy' ? 'status-healthy' : 'status-unhealthy'
                    )}>
                      {service.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Case Status Distribution */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Case Status Distribution</h3>
              <p className="card-description">Current status breakdown of tracked cases</p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" />
                  <YAxis dataKey="status" type="category" width={80} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px'
                    }}
                  />
                  <Bar dataKey="count" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent Activity (placeholder) */}
        <div className="mt-8">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Recent Activity</h3>
              <p className="card-description">Latest system events and user actions</p>
            </div>
            <div className="flow-root">
              <ul className="-mb-8">
                {[
                  { id: 1, type: 'case_status', message: 'Case MSC2190000001 status updated to "Card Produced"', time: '5 minutes ago', user: 'System' },
                  { id: 2, type: 'signature', message: 'Signature request completed for I-485 form', time: '12 minutes ago', user: 'John Doe' },
                  { id: 3, type: 'user', message: 'New user registered: jane.smith@example.com', time: '1 hour ago', user: 'System' },
                  { id: 4, type: 'service', message: 'OCR service processing completed for document batch #1247', time: '2 hours ago', user: 'System' },
                ].map((item, itemIdx, items) => (
                  <li key={item.id}>
                    <div className="relative pb-8">
                      {itemIdx !== items.length - 1 ? (
                        <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                      ) : null}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className={clsx(
                            'h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white',
                            item.type === 'case_status' && 'bg-green-500',
                            item.type === 'signature' && 'bg-purple-500',
                            item.type === 'user' && 'bg-blue-500',
                            item.type === 'service' && 'bg-orange-500'
                          )}>
                            <ChartBarIcon className="h-4 w-4 text-white" aria-hidden="true" />
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                          <div>
                            <p className="text-sm text-gray-900">{item.message}</p>
                            <p className="text-sm text-gray-500">by {item.user}</p>
                          </div>
                          <div className="text-right text-sm whitespace-nowrap text-gray-500">
                            {item.time}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}