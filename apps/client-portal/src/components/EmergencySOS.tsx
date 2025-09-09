import React, { useState, useEffect } from 'react';
import { AlertTriangle, Phone, Shield, MapPin, FileText, Heart, Users, HelpCircle } from 'lucide-react';

interface EmergencyContact {
  name: string;
  role: string;
  phone: string;
  available: boolean;
}

interface SafetyResource {
  title: string;
  description: string;
  phone?: string;
  url?: string;
  icon: React.ReactNode;
}

export const EmergencySOS: React.FC = () => {
  const [panicMode, setPanicMode] = useState(false);
  const [locationShared, setLocationShared] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const emergencyContacts: EmergencyContact[] = [
    { name: 'Immigration Attorney', role: 'Legal Support', phone: '1-800-555-0100', available: true },
    { name: 'Community Advocate', role: 'Local Support', phone: '1-800-555-0101', available: true },
    { name: 'Legal Aid Hotline', role: '24/7 Support', phone: '1-800-555-0102', available: true },
  ];

  const safetyResources: SafetyResource[] = [
    {
      title: 'Know Your Rights',
      description: 'Quick guide on your rights during encounters',
      icon: <Shield className="w-5 h-5 text-blue-600" />,
      url: '/rights-guide'
    },
    {
      title: 'Document Vault',
      description: 'Access your important documents instantly',
      icon: <FileText className="w-5 h-5 text-green-600" />,
      url: '/documents'
    },
    {
      title: 'Family Alert',
      description: 'Notify trusted contacts of your situation',
      icon: <Users className="w-5 h-5 text-purple-600" />,
    },
    {
      title: 'Crisis Counseling',
      description: 'Speak with a trained counselor',
      icon: <Heart className="w-5 h-5 text-red-600" />,
      phone: '988'
    }
  ];

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      // Auto-dial emergency contact
      handleEmergencyCall();
    }
  }, [countdown]);

  const handlePanicButton = () => {
    setPanicMode(true);
    setCountdown(5); // 5 second countdown before auto-dial
    // In production, this would trigger real emergency protocols
    console.log('PANIC MODE ACTIVATED - Notifying emergency contacts...');
  };

  const cancelPanic = () => {
    setPanicMode(false);
    setCountdown(null);
    setLocationShared(false);
  };

  const handleEmergencyCall = () => {
    console.log('Calling emergency contact...');
    // In production, this would initiate a real phone call
    window.location.href = 'tel:1-800-555-0100';
  };

  const shareLocation = () => {
    setLocationShared(true);
    // In production, this would share real GPS coordinates
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('Location shared:', position.coords);
      },
      (error) => {
        console.error('Location error:', error);
      }
    );
  };

  return (
    <div className={`rounded-xl shadow-lg transition-all ${
      panicMode ? 'bg-red-50 ring-4 ring-red-500 animate-pulse' : 'bg-gradient-to-br from-orange-50 to-red-50'
    } p-6`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Shield className="text-orange-600" />
          Emergency Support Center
        </h2>
        {!panicMode && (
          <span className="text-sm text-green-600 bg-green-100 px-3 py-1 rounded-full">
            You are safe
          </span>
        )}
      </div>

      {/* Panic Mode Active */}
      {panicMode && (
        <div className="bg-red-100 border-2 border-red-500 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
              EMERGENCY MODE ACTIVE
            </h3>
            <button
              onClick={cancelPanic}
              className="text-sm bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
          
          {countdown !== null && countdown > 0 && (
            <div className="text-center mb-3">
              <p className="text-red-800 font-semibold">Auto-calling attorney in:</p>
              <p className="text-4xl font-bold text-red-600">{countdown}</p>
              <p className="text-sm text-gray-600">Press cancel to stop</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleEmergencyCall}
              className="bg-red-600 text-white rounded-lg py-3 flex flex-col items-center hover:bg-red-700"
            >
              <Phone className="w-6 h-6 mb-1" />
              <span className="text-sm">Call Now</span>
            </button>
            <button
              onClick={shareLocation}
              className="bg-blue-600 text-white rounded-lg py-3 flex flex-col items-center hover:bg-blue-700"
              disabled={locationShared}
            >
              <MapPin className="w-6 h-6 mb-1" />
              <span className="text-sm">
                {locationShared ? 'Location Shared' : 'Share Location'}
              </span>
            </button>
          </div>

          {locationShared && (
            <p className="text-sm text-green-700 bg-green-100 rounded p-2 mt-3 text-center">
              Your location has been shared with emergency contacts
            </p>
          )}
        </div>
      )}

      {/* Main Panic Button */}
      {!panicMode && (
        <div className="text-center mb-6">
          <button
            onClick={handlePanicButton}
            className="relative bg-red-600 text-white rounded-full w-32 h-32 mx-auto shadow-lg hover:bg-red-700 transition-all hover:scale-105 active:scale-95"
          >
            <div className="flex flex-col items-center justify-center h-full">
              <AlertTriangle className="w-10 h-10 mb-2" />
              <span className="font-bold text-lg">SOS</span>
              <span className="text-xs">Press & Hold</span>
            </div>
          </button>
          <p className="text-sm text-gray-600 mt-3">
            Tap for immediate legal assistance
          </p>
        </div>
      )}

      {/* Emergency Contacts */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Phone className="w-5 h-5" />
          Emergency Contacts
        </h3>
        <div className="space-y-2">
          {emergencyContacts.map((contact, index) => (
            <div key={index} className="bg-white rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="font-medium">{contact.name}</p>
                <p className="text-sm text-gray-600">{contact.role}</p>
              </div>
              <div className="flex items-center gap-2">
                {contact.available && (
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                )}
                <a
                  href={`tel:${contact.phone}`}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                >
                  Call
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Safety Resources */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <HelpCircle className="w-5 h-5" />
          Safety Resources
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {safetyResources.map((resource, index) => (
            <div key={index} className="bg-white rounded-lg p-3 hover:shadow-md transition cursor-pointer">
              <div className="flex items-start gap-2">
                {resource.icon}
                <div className="flex-1">
                  <p className="font-medium text-sm">{resource.title}</p>
                  <p className="text-xs text-gray-600 mt-1">{resource.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ICE Preparation Note */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-800 mb-2">Be Prepared, Stay Safe</h4>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• Keep your documents ready and accessible</li>
          <li>• Memorize important phone numbers</li>
          <li>• Know your rights - you have the right to remain silent</li>
          <li>• Have an emergency plan with your family</li>
        </ul>
      </div>

      {/* Reassurance Message */}
      <div className="mt-4 text-center text-sm text-gray-600 italic">
        "You are not alone. Help is always one tap away."
      </div>
    </div>
  );
};