import { useState } from 'react';
import { useQuery } from 'react-query';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { apiClient } from '@/services/apiClient';

export default function ServiceHealthPage() {
  const [refreshing, setRefreshing] = useState(false);

  const { data: healthData, isLoading, refetch } = useQuery(
    'system-health',
    () => apiClient.getSystemHealth(),
    {
      refetchInterval: 30000, // Refresh every 30 seconds
    }
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
      toast.success('Service health refreshed');
    } catch (error) {
      toast.error('Failed to refresh service health');
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'unhealthy':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-800 bg-green-100';
      case 'unhealthy':
        return 'text-red-800 bg-red-100';
      default:
        return 'text-yellow-800 bg-yellow-100';
    }
  };

  const healthyServices = healthData?.data?.filter(s => s.status === 'healthy').length || 0;
  const totalServices = healthData?.data?.length || 0;
  const overallHealth = healthyServices === totalServices ? 'healthy' : 'degraded';

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between mb-8">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate">
              Service Health
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Real-time monitoring of all microservices in the Immigration Suite
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <button
              onClick={handleRefresh}
              disabled={refreshing || isLoading}
              className="btn-secondary"
            >
              <ArrowPathIcon 
                className={clsx(
                  'h-4 w-4 mr-2',
                  (refreshing || isLoading) && 'animate-spin'
                )} 
              />
              Refresh
            </button>
          </div>
        </div>

        {/* Overall Status Banner */}
        <div className={clsx(
          'mb-8 rounded-lg border p-6',
          overallHealth === 'healthy' 
            ? 'bg-green-50 border-green-200' 
            : 'bg-yellow-50 border-yellow-200'
        )}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {overallHealth === 'healthy' ? (
                <CheckCircleIcon className="h-8 w-8 text-green-500" />
              ) : (
                <ExclamationTriangleIcon className="h-8 w-8 text-yellow-500" />
              )}
            </div>
            <div className="ml-4">
              <h3 className={clsx(
                'text-lg font-medium',
                overallHealth === 'healthy' ? 'text-green-800' : 'text-yellow-800'
              )}>
                {overallHealth === 'healthy' ? 'All Systems Operational' : 'Service Degradation Detected'}
              </h3>
              <p className={clsx(
                'text-sm mt-1',
                overallHealth === 'healthy' ? 'text-green-700' : 'text-yellow-700'
              )}>
                {healthyServices}/{totalServices} services are healthy
                {healthData?.data && (
                  <span className="ml-2">
                    • Last updated {format(new Date(), 'MMM d, yyyy h:mm a')}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Service Grid */}
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-6 w-6 bg-gray-200 rounded-full"></div>
                </div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {healthData?.data?.map((service) => (
              <div key={service.name} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {service.name}
                  </h3>
                  {getStatusIcon(service.status)}
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Status</span>
                    <span className={clsx(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize',
                      getStatusColor(service.status)
                    )}>
                      {service.status}
                    </span>
                  </div>
                  
                  {service.responseTime && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Response Time</span>
                      <span className={clsx(
                        'text-sm font-medium',
                        service.responseTime < 300 ? 'text-green-600' :
                        service.responseTime < 1000 ? 'text-yellow-600' : 'text-red-600'
                      )}>
                        {service.responseTime}ms
                      </span>
                    </div>
                  )}
                  
                  {service.version && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Version</span>
                      <span className="text-sm font-mono text-gray-900">
                        {service.version}
                      </span>
                    </div>
                  )}
                  
                  {service.uptime !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Uptime</span>
                      <span className="text-sm font-medium text-gray-900">
                        {service.uptime}%
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Last Checked</span>
                    <div className="flex items-center text-sm text-gray-600">
                      <ClockIcon className="h-4 w-4 mr-1" />
                      {format(new Date(service.lastChecked), 'h:mm a')}
                    </div>
                  </div>
                  
                  {service.error && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-800">{service.error}</p>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-gray-200">
                  <a
                    href={service.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-immigration-600 hover:text-immigration-700 font-medium"
                  >
                    View Health Endpoint →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Service Status History (Placeholder) */}
        <div className="mt-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Service Status History (24 Hours)
            </h3>
            <div className="text-sm text-gray-500">
              Historical uptime and performance data would be displayed here.
              Integration with monitoring systems like Prometheus or DataDog would provide:
            </div>
            <ul className="mt-3 text-sm text-gray-600 list-disc list-inside">
              <li>Service uptime percentages</li>
              <li>Response time trends</li>
              <li>Error rate monitoring</li>
              <li>Alert history</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}