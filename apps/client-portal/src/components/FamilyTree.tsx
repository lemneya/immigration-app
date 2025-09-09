import React, { useState } from 'react';
import { Users, UserPlus, Heart, Home, AlertCircle, CheckCircle, Clock, FileText } from 'lucide-react';

interface FamilyMember {
  id: string;
  name: string;
  relationship: 'self' | 'spouse' | 'child' | 'parent' | 'sibling';
  caseType: string;
  status: 'preparing' | 'submitted' | 'in-review' | 'approved' | 'denied';
  priority: number;
  dateSubmitted?: string;
  estimatedCompletion?: string;
  documents: number;
  completeness: number;
}

export const FamilyTree: React.FC = () => {
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  
  const familyMembers: FamilyMember[] = [
    {
      id: '1',
      name: 'You',
      relationship: 'self',
      caseType: 'I-485 (Green Card)',
      status: 'in-review',
      priority: 1,
      dateSubmitted: '2023-06-20',
      estimatedCompletion: '2024-12-01',
      documents: 23,
      completeness: 85
    },
    {
      id: '2',
      name: 'Maria',
      relationship: 'spouse',
      caseType: 'I-485 (Green Card)',
      status: 'in-review',
      priority: 1,
      dateSubmitted: '2023-06-20',
      estimatedCompletion: '2024-12-01',
      documents: 21,
      completeness: 80
    },
    {
      id: '3',
      name: 'Sofia',
      relationship: 'child',
      caseType: 'I-485 (Derivative)',
      status: 'submitted',
      priority: 2,
      dateSubmitted: '2023-07-15',
      estimatedCompletion: '2025-01-15',
      documents: 15,
      completeness: 100
    },
    {
      id: '4',
      name: 'Carlos',
      relationship: 'child',
      caseType: 'I-485 (Derivative)',
      status: 'preparing',
      priority: 3,
      documents: 12,
      completeness: 60
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-500';
      case 'in-review': return 'bg-yellow-500';
      case 'submitted': return 'bg-blue-500';
      case 'preparing': return 'bg-gray-400';
      case 'denied': return 'bg-red-500';
      default: return 'bg-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'in-review': return <Clock className="w-4 h-4" />;
      case 'submitted': return <FileText className="w-4 h-4" />;
      case 'preparing': return <AlertCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const getRelationshipEmoji = (relationship: string) => {
    switch (relationship) {
      case 'self': return '👤';
      case 'spouse': return '💑';
      case 'child': return '👶';
      case 'parent': return '👨‍👩‍👧';
      case 'sibling': return '👫';
      default: return '👤';
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 shadow-lg">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Home className="text-purple-600" />
          Our Family's Journey Together
        </h2>
        <p className="text-gray-600 mt-1">
          Track everyone's immigration progress in one place
        </p>
      </div>

      {/* Family Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {familyMembers.map((member) => (
          <div
            key={member.id}
            onClick={() => setSelectedMember(member.id)}
            className={`bg-white rounded-lg p-4 shadow-md cursor-pointer transition-all hover:shadow-lg
              ${selectedMember === member.id ? 'ring-2 ring-purple-500' : ''}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{getRelationshipEmoji(member.relationship)}</span>
                  <div>
                    <h3 className="font-semibold text-lg">{member.name}</h3>
                    <p className="text-sm text-gray-500 capitalize">{member.relationship}</p>
                  </div>
                </div>
                
                <p className="text-sm font-medium text-gray-700 mb-2">{member.caseType}</p>
                
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2 py-1 rounded-full text-xs text-white flex items-center gap-1 ${getStatusColor(member.status)}`}>
                    {getStatusIcon(member.status)}
                    {member.status.replace('-', ' ')}
                  </span>
                  {member.priority === 1 && (
                    <span className="px-2 py-1 bg-red-100 text-red-600 rounded-full text-xs">
                      Priority
                    </span>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="mb-2">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{member.completeness}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all"
                      style={{ width: `${member.completeness}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="flex justify-between text-xs text-gray-600">
                  <span>{member.documents} documents</span>
                  {member.estimatedCompletion && (
                    <span>Est. {new Date(member.estimatedCompletion).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Family Unity Message */}
      <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-3">
          <Heart className="text-red-500 w-6 h-6 animate-pulse" />
          <div>
            <h3 className="font-semibold text-gray-800">Stronger Together</h3>
            <p className="text-sm text-gray-600">
              Your family's cases are linked. Progress on one can positively impact others.
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button className="flex-1 bg-purple-600 text-white rounded-lg py-3 px-4 flex items-center justify-center gap-2 hover:bg-purple-700 transition">
          <Users className="w-5 h-5" />
          View Family Timeline
        </button>
        <button className="flex-1 bg-white border-2 border-purple-600 text-purple-600 rounded-lg py-3 px-4 flex items-center justify-center gap-2 hover:bg-purple-50 transition">
          <UserPlus className="w-5 h-5" />
          Add Family Member
        </button>
      </div>

      {/* Emotional Support Note */}
      <div className="mt-4 text-center text-sm text-gray-600 italic">
        "No one gets there alone" - Your family's unity is your strength
      </div>
    </div>
  );
};