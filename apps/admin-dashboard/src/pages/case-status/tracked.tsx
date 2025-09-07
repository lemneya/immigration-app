import { useState } from 'react';
import { useQuery } from 'react-query';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  EyeIcon,
  BellIcon,
  StopIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import clsx from 'clsx';
import { apiClient } from '@/services/apiClient';

const mockTrackedCases = [
  {
    receiptNumber: 'MSC2190000001',
    status: 'Card Was Produced',
    lastUpdated: '2024-01-15T10:30:00Z',
    userId: 'user123',
    userEmail: 'john.doe@example.com',
    trackingEnabled: true,
    checkInterval: 60,
    totalChecks: 42,
    lastChecked: '2024-01-15T14:30:00Z',
    alertsCount: 3,
    formType: 'I-485',
    caseType: 'Adjustment of Status'
  },
  {
    receiptNumber: 'EAC2290000123',
    status: 'Interview Was Scheduled',
    lastUpdated: '2024-01-14T16:20:00Z',
    userId: 'user456',
    userEmail: 'jane.smith@example.com',
    trackingEnabled: true,
    checkInterval: 30,
    totalChecks: 89,
    lastChecked: '2024-01-15T14:25:00Z',
    alertsCount: 1,
    formType: 'N-400',
    caseType: 'Naturalization'
  },
  {
    receiptNumber: 'WAC2190000789',
    status: 'Case Was Received',
    lastUpdated: '2024-01-10T09:15:00Z',
    userId: 'user789',
    userEmail: 'mike.wilson@example.com',
    trackingEnabled: true,
    checkInterval: 120,
    totalChecks: 25,
    lastChecked: '2024-01-15T14:20:00Z',
    alertsCount: 0,
    formType: 'I-130',
    caseType: 'Family-Based Petition'
  },
];

export default function TrackedCasesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: casesData, isLoading } = useQuery(
    'tracked-cases',
    () => apiClient.getTrackedCases(),
    {
      // Use mock data for now since the API might not be fully implemented
      placeholderData: { success: true, data: mockTrackedCases },
    }
  );

  const filteredCases = casesData?.data?.filter(caseItem => {
    const matchesSearch = searchQuery === '' || 
      caseItem.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      caseItem.userEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      caseItem.status.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || caseItem.status === statusFilter;

    return matchesSearch && matchesStatus;
  }) || [];

  const getStatusColor = (status: string) => {
    if (status.toLowerCase().includes('approved') || status.toLowerCase().includes('produced')) {
      return 'text-green-800 bg-green-100';
    }
    if (status.toLowerCase().includes('interview') || status.toLowerCase().includes('scheduled')) {
      return 'text-blue-800 bg-blue-100';
    }
    if (status.toLowerCase().includes('denied') || status.toLowerCase().includes('rejected')) {
      return 'text-red-800 bg-red-100';
    }
    if (status.toLowerCase().includes('received') || status.toLowerCase().includes('pending')) {
      return 'text-yellow-800 bg-yellow-100';
    }
    return 'text-gray-800 bg-gray-100';
  };

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between mb-8">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate">
              Tracked Cases
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Monitor and manage USCIS cases being tracked for status updates
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <button className="btn-primary">
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Case
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="metric-card">
            <div className="metric-value">{casesData?.data?.length || 0}</div>
            <div className="metric-label">Total Tracked</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">
              {casesData?.data?.filter(c => c.trackingEnabled).length || 0}
            </div>
            <div className="metric-label">Active Monitoring</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">
              {casesData?.data?.reduce((sum, c) => sum + (c.alertsCount || 0), 0) || 0}
            </div>
            <div className="metric-label">Total Alerts</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">
              {casesData?.data?.filter(c => 
                c.status.toLowerCase().includes('approved') || 
                c.status.toLowerCase().includes('produced')
              ).length || 0}
            </div>
            <div className="metric-label">Approved Cases</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by receipt number, email, or status..."
                  className="form-input pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="Card Was Produced">Card Produced</option>
                <option value="Interview Was Scheduled">Interview Scheduled</option>
                <option value="Case Was Received">Case Received</option>
                <option value="Case Is Being Actively Reviewed">Under Review</option>
              </select>
            </div>
          </div>
        </div>

        {/* Cases Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-6">
              <div className="animate-pulse">
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/5"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/8"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-gray-400 text-lg mb-2">No cases found</div>
              <div className="text-gray-500 text-sm">
                {searchQuery || statusFilter !== 'all' 
                  ? 'Try adjusting your filters'
                  : 'Start by adding a case to track'
                }
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead className="table-header">
                  <tr>
                    <th className="table-header-cell">Receipt Number</th>
                    <th className="table-header-cell">Status</th>
                    <th className="table-header-cell">Form Type</th>
                    <th className="table-header-cell">User</th>
                    <th className="table-header-cell">Last Updated</th>
                    <th className="table-header-cell">Alerts</th>
                    <th className="table-header-cell">Monitoring</th>
                    <th className="table-header-cell">Actions</th>
                  </tr>
                </thead>
                <tbody className="table-body">
                  {filteredCases.map((caseItem) => (
                    <tr key={caseItem.receiptNumber} className="hover:bg-gray-50">
                      <td className="table-cell">
                        <div className="font-mono font-medium text-gray-900">
                          {caseItem.receiptNumber}
                        </div>
                        <div className="text-sm text-gray-500">
                          {caseItem.caseType}
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className={clsx(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                          getStatusColor(caseItem.status)
                        )}>
                          {caseItem.status}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className="font-medium text-gray-900">
                          {caseItem.formType}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="text-sm text-gray-900">
                          {caseItem.userEmail}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {caseItem.userId}
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="text-sm text-gray-900">
                          {format(new Date(caseItem.lastUpdated), 'MMM d, yyyy')}
                        </div>
                        <div className="text-sm text-gray-500">
                          {format(new Date(caseItem.lastUpdated), 'h:mm a')}
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center">
                          <BellIcon className="h-4 w-4 text-gray-400 mr-1" />
                          <span className="text-sm font-medium text-gray-900">
                            {caseItem.alertsCount}
                          </span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center">
                          <div className={clsx(
                            'w-2 h-2 rounded-full mr-2',
                            caseItem.trackingEnabled ? 'bg-green-400 animate-pulse' : 'bg-gray-300'
                          )} />
                          <span className="text-sm text-gray-900">
                            {caseItem.trackingEnabled ? 'Active' : 'Paused'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          Every {caseItem.checkInterval}min
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center space-x-2">
                          <button
                            className="text-immigration-600 hover:text-immigration-700 p-1 rounded"
                            title="View Details"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button
                            className="text-gray-400 hover:text-gray-500 p-1 rounded"
                            title="Pause Monitoring"
                          >
                            <StopIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination placeholder */}
        {filteredCases.length > 0 && (
          <div className="mt-6 flex justify-between items-center">
            <div className="text-sm text-gray-700">
              Showing {filteredCases.length} of {casesData?.data?.length || 0} cases
            </div>
            <div className="flex space-x-2">
              <button className="btn-ghost" disabled>
                Previous
              </button>
              <button className="btn-ghost" disabled>
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}