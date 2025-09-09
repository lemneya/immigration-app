import React, { useState, useEffect } from 'react';
import { Globe, HelpCircle, Home, Mail, MapPin, FileText, Phone, Calendar, Upload, Briefcase, Shield } from 'lucide-react';
import { QuickActionCard } from './QuickActionCard';
import { StatusGlance } from './StatusGlance';
import { ParlantDrawer } from './ParlantDrawer';

interface UserProfile {
  first_name: string;
  last_name: string;
  locale: string;
  a_number?: string;
  in_eoir?: boolean;
  receipts?: string[];
}

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  icon: React.ReactNode;
  badge?: string;
  priority?: 'high' | 'medium' | 'low';
  context: any;
}

export const TrustworthyDashboard: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile>({
    first_name: 'Maria',
    last_name: 'Rodriguez',
    locale: 'en',
    a_number: 'A123456789',
    in_eoir: false,
    receipts: ['MSC2390123456', 'EAC2389876543']
  });

  const [recommendations, setRecommendations] = useState<QuickAction[]>([]);
  const [agent, setAgent] = useState<{ open: boolean; ctx: any }>({ open: false, ctx: null });
  const [selectedLocale, setSelectedLocale] = useState('en');

  useEffect(() => {
    // Simulate fetching recommendations
    const actions: QuickAction[] = [
      {
        id: 'change-address',
        title: 'Change Your Address',
        subtitle: 'Update USCIS (and EOIR if needed). Takes ~3 minutes.',
        cta: 'Start Now',
        icon: <MapPin />,
        badge: 'Required',
        priority: 'high',
        context: { action: 'change-address' }
      },
      {
        id: 'review-mail',
        title: 'Review a Mail or Notice',
        subtitle: 'Translate, summarize, and get action items with due dates.',
        cta: 'Open Mail',
        icon: <Mail />,
        badge: '2 New',
        priority: 'high',
        context: { action: 'review-mail' }
      },
      {
        id: 'renew-work-permit',
        title: 'Renew Work Permit',
        subtitle: 'File I-765 renewal. Eligibility window opens in 30 days.',
        cta: 'Check Eligibility',
        icon: <Briefcase />,
        priority: 'medium',
        context: { action: 'renew-ead' }
      },
      {
        id: 'replace-card',
        title: 'Replace Lost Card',
        subtitle: 'File I-90 for green card replacement.',
        cta: 'Get Started',
        icon: <FileText />,
        context: { action: 'replace-card' }
      },
      {
        id: 'request-records',
        title: 'Request Your Records',
        subtitle: 'FOIA request to get your immigration file.',
        cta: 'Request FOIA',
        icon: <Shield />,
        context: { action: 'foia-request' }
      },
      {
        id: 'upload-evidence',
        title: 'Upload Evidence',
        subtitle: 'Respond to RFE or submit additional documents.',
        cta: 'Upload Files',
        icon: <Upload />,
        badge: 'Due in 7 days',
        priority: 'high',
        context: { action: 'upload-rfe' }
      },
      {
        id: 'book-appointment',
        title: 'Book Appointment',
        subtitle: 'Schedule a consultation with your attorney.',
        cta: 'View Calendar',
        icon: <Calendar />,
        context: { action: 'book-appointment' }
      },
      {
        id: 'call-translation',
        title: 'Call with Translation',
        subtitle: 'Connect to USCIS with live translation support.',
        cta: 'Start Call',
        icon: <Phone />,
        context: { action: 'call-uscis' }
      }
    ];
    setRecommendations(actions);
  }, []);

  const handleActionClick = (context: any) => {
    setAgent({ open: true, ctx: { ...context, profile, locale: selectedLocale } });
  };

  const locales = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'ar', label: 'العربية', flag: '🇸🇦' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Home className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Welcome, {profile.first_name}
                </h1>
                <p className="text-sm text-gray-600">
                  Your private immigration hub
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Locale Switcher */}
              <select 
                value={selectedLocale}
                onChange={(e) => setSelectedLocale(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm bg-white"
              >
                {locales.map(locale => (
                  <option key={locale.code} value={locale.code}>
                    {locale.flag} {locale.label}
                  </option>
                ))}
              </select>
              
              {/* Help Button */}
              <button 
                onClick={() => setAgent({ open: true, ctx: { action: 'help' } })}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <HelpCircle className="w-4 h-4" />
                Need Help?
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Trust Banner */}
      <div className="bg-green-50 border-b border-green-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-green-600" />
            <p className="text-sm text-green-800">
              <strong>Your data is secure.</strong> This is your private immigration hub. 
              Pick one action to complete at a time. We're here to guide you every step.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Glance */}
        <StatusGlance />

        {/* Quick Actions Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Quick Actions</h2>
              <p className="text-gray-600 mt-1">
                Complete one task at a time with step-by-step guidance
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>High Priority</span>
              </div>
              <div className="flex items-center gap-1 ml-4">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span>Medium</span>
              </div>
              <div className="flex items-center gap-1 ml-4">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Low</span>
              </div>
            </div>
          </div>

          {/* Action Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {recommendations.map((action) => (
              <QuickActionCard
                key={action.id}
                title={action.title}
                subtitle={action.subtitle}
                cta={action.cta}
                icon={action.icon}
                badge={action.badge}
                priority={action.priority}
                onClick={() => handleActionClick(action.context)}
              />
            ))}
          </div>
        </div>

        {/* Timeline Section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            What We've Done Together
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">I-485 Application Submitted</p>
                <p className="text-xs text-gray-600">June 20, 2023 • Receipt: MSC2390123456</p>
              </div>
              <a href="#" className="text-blue-600 text-sm hover:underline">View</a>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Biometrics Completed</p>
                <p className="text-xs text-gray-600">January 10, 2024 • Brooklyn ASC</p>
              </div>
              <a href="#" className="text-blue-600 text-sm hover:underline">View</a>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">RFE Response Due</p>
                <p className="text-xs text-gray-600">December 22, 2024 • 7 days remaining</p>
              </div>
              <a href="#" className="text-blue-600 text-sm hover:underline">Upload</a>
            </div>
          </div>
        </div>
      </main>

      {/* Parlant Agent Drawer */}
      <ParlantDrawer
        open={agent.open}
        onClose={() => setAgent({ open: false, ctx: null })}
        context={agent.ctx}
      />
    </div>
  );
};