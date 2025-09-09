import React from 'react';
import { Heart, Users, Calendar, Star, Gift } from 'lucide-react';

interface MilestoneProps {
  date: string;
  title: string;
  status: 'completed' | 'current' | 'upcoming';
  message?: string;
}

export const JourneyCompanion: React.FC = () => {
  const milestones: MilestoneProps[] = [
    {
      date: '2022-03-15',
      title: 'Arrived in USA 🛬',
      status: 'completed',
      message: 'Your brave journey began'
    },
    {
      date: '2023-06-20',
      title: 'Filed I-485 📋',
      status: 'completed',
      message: 'You took the big step!'
    },
    {
      date: '2024-01-10',
      title: 'Biometrics Done ✓',
      status: 'completed',
      message: 'Your identity secured'
    },
    {
      date: '2024-09-15',
      title: 'Interview Scheduled 🎯',
      status: 'current',
      message: "You're so close! We believe in you!"
    },
    {
      date: '2024-12-01',
      title: 'Green Card Arrival 💚',
      status: 'upcoming',
      message: 'Your new chapter awaits'
    }
  ];

  const encouragements = [
    "You're not alone - 44 million immigrants have walked this path",
    "Every day you're closer to your dream",
    "Your courage inspires us all",
    "This journey makes you stronger"
  ];

  return (
    <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Heart className="text-red-500 animate-pulse" />
          Your Journey to Home
        </h2>
        <div className="flex gap-2">
          <span className="bg-yellow-100 px-3 py-1 rounded-full text-sm">
            Day 912 in USA
          </span>
          <span className="bg-green-100 px-3 py-1 rounded-full text-sm">
            78% Complete
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative pl-8 space-y-8">
        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-500 via-yellow-500 to-gray-300" />
        
        {milestones.map((milestone, index) => (
          <div key={index} className="relative">
            <div className={`absolute -left-5 w-6 h-6 rounded-full border-4 border-white
              ${milestone.status === 'completed' ? 'bg-green-500' : 
                milestone.status === 'current' ? 'bg-yellow-500 animate-pulse' : 
                'bg-gray-300'}`} 
            />
            
            <div className={`bg-white rounded-lg p-4 shadow-md
              ${milestone.status === 'current' ? 'ring-2 ring-yellow-400' : ''}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{milestone.title}</h3>
                  <p className="text-sm text-gray-500">{milestone.date}</p>
                  {milestone.message && (
                    <p className="text-sm text-blue-600 mt-1 italic">
                      {milestone.message}
                    </p>
                  )}
                </div>
                {milestone.status === 'completed' && (
                  <Star className="text-yellow-500 w-5 h-5" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Daily Encouragement */}
      <div className="mt-8 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg p-4">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <Gift className="w-5 h-5" />
          Today's Encouragement
        </h3>
        <p className="text-gray-700 italic">
          "{encouragements[new Date().getDate() % encouragements.length]}"
        </p>
        <p className="text-sm text-gray-500 mt-2">
          - From Maria, who got her Green Card last month
        </p>
      </div>

      {/* Community Support */}
      <div className="mt-6 flex gap-4">
        <button className="flex-1 bg-blue-500 text-white rounded-lg py-3 px-4 flex items-center justify-center gap-2 hover:bg-blue-600 transition">
          <Users className="w-5 h-5" />
          Connect with 23 others at same stage
        </button>
        <button className="flex-1 bg-green-500 text-white rounded-lg py-3 px-4 flex items-center justify-center gap-2 hover:bg-green-600 transition">
          <Calendar className="w-5 h-5" />
          Join interview prep group
        </button>
      </div>

      {/* Celebration Ready */}
      {milestones.some(m => m.status === 'current') && (
        <div className="mt-6 text-center p-4 bg-yellow-50 rounded-lg">
          <p className="text-sm text-gray-600">
            🎉 Interview in 7 days! We've helped 1,847 people succeed. You're next!
          </p>
        </div>
      )}
    </div>
  );
};