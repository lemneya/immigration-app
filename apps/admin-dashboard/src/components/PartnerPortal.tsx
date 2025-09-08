import React, { useState, useEffect } from 'react';

interface Partner {
  id: string;
  name: string;
  type: 'ngo' | 'law_firm' | 'consultant';
  status: 'active' | 'inactive' | 'pending';
  clientCount: number;
  monthlyRevenue: number;
  joinDate: string;
  contactEmail: string;
}

interface Client {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  caseType: string;
  partnerId: string;
  createdAt: string;
  lastActivity: string;
}

interface BillingRecord {
  id: string;
  partnerId: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  period: string;
  dueDate: string;
  services: string[];
}

export const PartnerPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'clients' | 'billing' | 'reports'>('overview');
  const [partners, setPartners] = useState<Partner[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPartnerData();
  }, []);

  const loadPartnerData = async () => {
    try {
      // Mock data - replace with actual API calls
      setPartners([
        {
          id: '1',
          name: 'Legal Aid Society',
          type: 'ngo',
          status: 'active',
          clientCount: 45,
          monthlyRevenue: 2250,
          joinDate: '2023-01-15',
          contactEmail: 'contact@legalaid.org'
        },
        {
          id: '2', 
          name: 'Immigration Law Partners',
          type: 'law_firm',
          status: 'active',
          clientCount: 78,
          monthlyRevenue: 3900,
          joinDate: '2022-11-20',
          contactEmail: 'admin@immigrationlaw.com'
        }
      ]);

      setClients([
        {
          id: '1',
          name: 'John Doe',
          email: 'john.doe@email.com',
          status: 'active',
          caseType: 'Green Card',
          partnerId: '1',
          createdAt: '2024-01-15',
          lastActivity: '2024-01-20'
        }
      ]);

      setBillingRecords([
        {
          id: '1',
          partnerId: '1',
          amount: 2250,
          status: 'paid',
          period: 'January 2024',
          dueDate: '2024-02-01',
          services: ['Document Processing', 'Translation Services']
        }
      ]);

      setLoading(false);
    } catch (error) {
      console.error('Error loading partner data:', error);
      setLoading(false);
    }
  };

  const OverviewTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900">Total Partners</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">{partners.length}</p>
          <p className="text-sm text-gray-500 mt-1">
            {partners.filter(p => p.status === 'active').length} active
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900">Total Clients</h3>
          <p className="text-3xl font-bold text-green-600 mt-2">
            {partners.reduce((sum, p) => sum + p.clientCount, 0)}
          </p>
          <p className="text-sm text-gray-500 mt-1">Across all partners</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900">Monthly Revenue</h3>
          <p className="text-3xl font-bold text-purple-600 mt-2">
            ${partners.reduce((sum, p) => sum + p.monthlyRevenue, 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 mt-1">This month</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Partner Organizations</h3>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Organization</th>
                  <th className="text-left py-2">Type</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Clients</th>
                  <th className="text-left py-2">Revenue</th>
                  <th className="text-left py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((partner) => (
                  <tr key={partner.id} className="border-b">
                    <td className="py-3">
                      <div>
                        <p className="font-medium">{partner.name}</p>
                        <p className="text-sm text-gray-500">{partner.contactEmail}</p>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="capitalize">{partner.type.replace('_', ' ')}</span>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        partner.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : partner.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {partner.status}
                      </span>
                    </td>
                    <td className="py-3">{partner.clientCount}</td>
                    <td className="py-3">${partner.monthlyRevenue.toLocaleString()}</td>
                    <td className="py-3">
                      <button className="text-blue-600 hover:text-blue-800 mr-3">
                        View Details
                      </button>
                      <button className="text-gray-600 hover:text-gray-800">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const ClientsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold">Client Management</h3>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
            Add New Client
          </button>
        </div>
        <div className="p-6">
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search clients..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Client Name</th>
                  <th className="text-left py-2">Partner Organization</th>
                  <th className="text-left py-2">Case Type</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Last Activity</th>
                  <th className="text-left py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => {
                  const partner = partners.find(p => p.id === client.partnerId);
                  return (
                    <tr key={client.id} className="border-b">
                      <td className="py-3">
                        <div>
                          <p className="font-medium">{client.name}</p>
                          <p className="text-sm text-gray-500">{client.email}</p>
                        </div>
                      </td>
                      <td className="py-3">{partner?.name}</td>
                      <td className="py-3">{client.caseType}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          client.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {client.status}
                        </span>
                      </td>
                      <td className="py-3">{new Date(client.lastActivity).toLocaleDateString()}</td>
                      <td className="py-3">
                        <button className="text-blue-600 hover:text-blue-800 mr-3">
                          View Case
                        </button>
                        <button className="text-gray-600 hover:text-gray-800">
                          Contact
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const BillingTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900">Total Revenue</h3>
          <p className="text-3xl font-bold text-green-600 mt-2">
            ${billingRecords.reduce((sum, b) => sum + b.amount, 0).toLocaleString()}
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900">Pending Payments</h3>
          <p className="text-3xl font-bold text-yellow-600 mt-2">
            {billingRecords.filter(b => b.status === 'pending').length}
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900">Overdue</h3>
          <p className="text-3xl font-bold text-red-600 mt-2">
            {billingRecords.filter(b => b.status === 'overdue').length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold">Billing Records</h3>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
            Generate Invoice
          </button>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Partner</th>
                  <th className="text-left py-2">Period</th>
                  <th className="text-left py-2">Amount</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Due Date</th>
                  <th className="text-left py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {billingRecords.map((record) => {
                  const partner = partners.find(p => p.id === record.partnerId);
                  return (
                    <tr key={record.id} className="border-b">
                      <td className="py-3">{partner?.name}</td>
                      <td className="py-3">{record.period}</td>
                      <td className="py-3">${record.amount.toLocaleString()}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          record.status === 'paid' 
                            ? 'bg-green-100 text-green-800' 
                            : record.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="py-3">{new Date(record.dueDate).toLocaleDateString()}</td>
                      <td className="py-3">
                        <button className="text-blue-600 hover:text-blue-800 mr-3">
                          View Invoice
                        </button>
                        {record.status !== 'paid' && (
                          <button className="text-green-600 hover:text-green-800">
                            Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const ReportsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Partner Performance Reports</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">Revenue by Partner Type</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>NGO</span>
                  <span className="font-medium">$2,250</span>
                </div>
                <div className="flex justify-between">
                  <span>Law Firm</span>
                  <span className="font-medium">$3,900</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-3">Client Growth</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>This Month</span>
                  <span className="font-medium text-green-600">+12</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Month</span>
                  <span className="font-medium">98</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Partner Portal</h1>
        <p className="text-gray-600 mt-2">
          Manage partner organizations, clients, and billing
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'clients', label: 'Clients' },
            { key: 'billing', label: 'Billing' },
            { key: 'reports', label: 'Reports' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'clients' && <ClientsTab />}
      {activeTab === 'billing' && <BillingTab />}
      {activeTab === 'reports' && <ReportsTab />}
    </div>
  );
};