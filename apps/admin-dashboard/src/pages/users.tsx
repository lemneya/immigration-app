import { useState } from 'react';
import { useQuery } from 'react-query';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  EllipsisHorizontalIcon,
  ShieldCheckIcon,
  UserIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';
import { Menu } from '@headlessui/react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { apiClient } from '@/services/apiClient';

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: usersData, isLoading } = useQuery(
    'users',
    () => apiClient.getUsers()
  );

  const filteredUsers = usersData?.data?.filter(user => {
    const matchesSearch = searchQuery === '' || 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  }) || [];

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return 'text-purple-800 bg-purple-100';
      case 'operator':
        return 'text-blue-800 bg-blue-100';
      case 'user':
        return 'text-green-800 bg-green-100';
      default:
        return 'text-gray-800 bg-gray-100';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-800 bg-green-100';
      case 'inactive':
        return 'text-yellow-800 bg-yellow-100';
      case 'suspended':
        return 'text-red-800 bg-red-100';
      default:
        return 'text-gray-800 bg-gray-100';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <ShieldCheckIcon className="h-4 w-4" />;
      case 'operator':
        return <KeyIcon className="h-4 w-4" />;
      default:
        return <UserIcon className="h-4 w-4" />;
    }
  };

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between mb-8">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate">
              User Management
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage user accounts, roles, and permissions for the Immigration Suite
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <button className="btn-primary">
              <PlusIcon className="h-4 w-4 mr-2" />
              Add User
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="metric-card">
            <div className="metric-value">{usersData?.data?.length || 0}</div>
            <div className="metric-label">Total Users</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">
              {usersData?.data?.filter(u => u.status === 'active').length || 0}
            </div>
            <div className="metric-label">Active Users</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">
              {usersData?.data?.filter(u => u.role === 'admin').length || 0}
            </div>
            <div className="metric-label">Administrators</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">
              {usersData?.data?.filter(u => 
                u.lastLogin && 
                new Date(u.lastLogin) > new Date(Date.now() - 24 * 60 * 60 * 1000)
              ).length || 0}
            </div>
            <div className="metric-label">Active Today</div>
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
                  placeholder="Search by name or email..."
                  className="form-input pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="w-full sm:w-32">
              <select
                className="form-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="operator">Operator</option>
                <option value="user">User</option>
              </select>
            </div>
            <div className="w-full sm:w-32">
              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-6">
              <div className="animate-pulse">
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                      </div>
                      <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/8"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center">
              <UserIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <div className="text-gray-400 text-lg mb-2">No users found</div>
              <div className="text-gray-500 text-sm">
                {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Start by adding your first user'
                }
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead className="table-header">
                  <tr>
                    <th className="table-header-cell">User</th>
                    <th className="table-header-cell">Role</th>
                    <th className="table-header-cell">Status</th>
                    <th className="table-header-cell">Last Login</th>
                    <th className="table-header-cell">Created</th>
                    <th className="table-header-cell">Permissions</th>
                    <th className="table-header-cell">Actions</th>
                  </tr>
                </thead>
                <tbody className="table-body">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="table-cell">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-immigration-100 flex items-center justify-center mr-4">
                            {getRoleIcon(user.role)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{user.name}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className={clsx(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize',
                          getRoleBadge(user.role)
                        )}>
                          {user.role}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className={clsx(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize',
                          getStatusBadge(user.status)
                        )}>
                          {user.status}
                        </span>
                      </td>
                      <td className="table-cell">
                        {user.lastLogin ? (
                          <div>
                            <div className="text-sm text-gray-900">
                              {format(new Date(user.lastLogin), 'MMM d, yyyy')}
                            </div>
                            <div className="text-sm text-gray-500">
                              {format(new Date(user.lastLogin), 'h:mm a')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">Never</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <div className="text-sm text-gray-900">
                          {format(new Date(user.createdAt), 'MMM d, yyyy')}
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex flex-wrap gap-1">
                          {user.permissions.map((permission: string) => (
                            <span
                              key={permission}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                            >
                              {permission}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="table-cell">
                        <Menu as="div" className="relative">
                          <Menu.Button className="p-2 rounded-md hover:bg-gray-100">
                            <EllipsisHorizontalIcon className="h-4 w-4" />
                          </Menu.Button>
                          <Menu.Items className="absolute right-0 z-10 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                            <div className="py-1">
                              <Menu.Item>
                                {({ active }) => (
                                  <button
                                    className={clsx(
                                      active ? 'bg-gray-100' : '',
                                      'block w-full text-left px-4 py-2 text-sm text-gray-700'
                                    )}
                                  >
                                    View Details
                                  </button>
                                )}
                              </Menu.Item>
                              <Menu.Item>
                                {({ active }) => (
                                  <button
                                    className={clsx(
                                      active ? 'bg-gray-100' : '',
                                      'block w-full text-left px-4 py-2 text-sm text-gray-700'
                                    )}
                                  >
                                    Edit User
                                  </button>
                                )}
                              </Menu.Item>
                              <Menu.Item>
                                {({ active }) => (
                                  <button
                                    className={clsx(
                                      active ? 'bg-gray-100' : '',
                                      'block w-full text-left px-4 py-2 text-sm text-gray-700'
                                    )}
                                  >
                                    Change Role
                                  </button>
                                )}
                              </Menu.Item>
                              <Menu.Item>
                                {({ active }) => (
                                  <button
                                    className={clsx(
                                      active ? 'bg-gray-100' : '',
                                      'block w-full text-left px-4 py-2 text-sm text-red-700'
                                    )}
                                  >
                                    {user.status === 'suspended' ? 'Unsuspend' : 'Suspend'} User
                                  </button>
                                )}
                              </Menu.Item>
                            </div>
                          </Menu.Items>
                        </Menu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Role Distribution Chart */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Role Distribution</h3>
            <div className="space-y-3">
              {['admin', 'operator', 'user'].map((role) => {
                const count = usersData?.data?.filter(u => u.role === role).length || 0;
                const percentage = usersData?.data?.length ? (count / usersData.data.length) * 100 : 0;
                
                return (
                  <div key={role} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className={clsx(
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize mr-3',
                        getRoleBadge(role)
                      )}>
                        {role}
                      </span>
                      <span className="text-sm text-gray-600">{count} users</span>
                    </div>
                    <div className="flex items-center w-32">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                        <div
                          className={clsx(
                            'h-2 rounded-full',
                            role === 'admin' ? 'bg-purple-500' :
                            role === 'operator' ? 'bg-blue-500' : 'bg-green-500'
                          )}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600">{percentage.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {usersData?.data
                ?.filter(u => u.lastLogin)
                ?.sort((a, b) => new Date(b.lastLogin!).getTime() - new Date(a.lastLogin!).getTime())
                ?.slice(0, 5)
                ?.map((user) => (
                  <div key={user.id} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-immigration-100 flex items-center justify-center mr-3">
                        {getRoleIcon(user.role)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-900">
                        {format(new Date(user.lastLogin!), 'MMM d')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {format(new Date(user.lastLogin!), 'h:mm a')}
                      </div>
                    </div>
                  </div>
                )) || (
                <div className="text-sm text-gray-500">No recent activity</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}