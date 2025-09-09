import React, { useState } from 'react';
import { Book, Camera, MapPin, Calendar, Heart, Share2, Download, Plus, Edit2, Mic } from 'lucide-react';

interface StoryEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  location?: string;
  mood: 'hopeful' | 'grateful' | 'nervous' | 'excited' | 'reflective';
  milestone?: string;
  photos?: string[];
  type: 'text' | 'photo' | 'audio' | 'milestone';
}

interface Milestone {
  id: string;
  title: string;
  icon: string;
  date: string;
}

export const MyStory: React.FC = () => {
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const storyEntries: StoryEntry[] = [
    {
      id: '1',
      date: '2022-03-15',
      title: 'The Day We Arrived',
      content: 'After 18 hours of flying, we finally landed at JFK. The kids were exhausted but their eyes were full of wonder. This is our new beginning.',
      location: 'New York, NY',
      mood: 'hopeful',
      milestone: 'Arrival in USA',
      type: 'milestone'
    },
    {
      id: '2',
      date: '2022-09-01',
      title: "Sofia's First Day of School",
      content: 'She was so brave, walking into that classroom not knowing much English. The teacher was kind and patient. I cried happy tears in the parking lot.',
      location: 'Brooklyn, NY',
      mood: 'grateful',
      photos: ['/api/placeholder/150/150'],
      type: 'photo'
    },
    {
      id: '3',
      date: '2023-06-20',
      title: 'Green Card Application Submitted',
      content: 'Today we submitted our I-485. Years of preparation led to this moment. The lawyer said we have a strong case. Fingers crossed!',
      mood: 'nervous',
      milestone: 'I-485 Filed',
      type: 'milestone'
    },
    {
      id: '4',
      date: '2024-01-10',
      title: 'Biometrics Appointment',
      content: 'Quick and professional. The officer was friendly and even made the kids laugh. One more step forward in our journey.',
      location: 'USCIS Office, Downtown',
      mood: 'excited',
      type: 'text'
    },
    {
      id: '5',
      date: '2024-07-04',
      title: 'Our First Independence Day',
      content: 'Watched fireworks with our new American friends. The kids waved little flags. This country is becoming our home.',
      mood: 'grateful',
      photos: ['/api/placeholder/150/150'],
      type: 'photo'
    }
  ];

  const milestones: Milestone[] = [
    { id: '1', title: 'Arrived in USA', icon: '✈️', date: '2022-03-15' },
    { id: '2', title: 'Found First Job', icon: '💼', date: '2022-05-20' },
    { id: '3', title: 'Kids Started School', icon: '🎒', date: '2022-09-01' },
    { id: '4', title: 'Filed I-485', icon: '📋', date: '2023-06-20' },
    { id: '5', title: 'Interview Scheduled', icon: '📅', date: '2024-09-15' }
  ];

  const moodColors = {
    hopeful: 'bg-blue-100 text-blue-700',
    grateful: 'bg-green-100 text-green-700',
    nervous: 'bg-yellow-100 text-yellow-700',
    excited: 'bg-purple-100 text-purple-700',
    reflective: 'bg-gray-100 text-gray-700'
  };

  const moodEmojis = {
    hopeful: '🌟',
    grateful: '🙏',
    nervous: '😰',
    excited: '🎉',
    reflective: '🤔'
  };

  const handleAddEntry = () => {
    console.log('Opening entry creator...');
  };

  const handleRecord = () => {
    setIsRecording(!isRecording);
    console.log(isRecording ? 'Stopping recording...' : 'Starting recording...');
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 shadow-lg">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Book className="text-indigo-600" />
            My Immigration Story
          </h2>
          <div className="flex gap-2">
            <button className="p-2 bg-white rounded-lg shadow hover:shadow-md transition">
              <Share2 className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 bg-white rounded-lg shadow hover:shadow-md transition">
              <Download className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
        <p className="text-gray-600 mt-1">
          Preserve your journey, celebrate your courage
        </p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-indigo-600">912</p>
          <p className="text-xs text-gray-600">Days in USA</p>
        </div>
        <div className="bg-white rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-purple-600">47</p>
          <p className="text-xs text-gray-600">Memories</p>
        </div>
        <div className="bg-white rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-pink-600">5</p>
          <p className="text-xs text-gray-600">Milestones</p>
        </div>
        <div className="bg-white rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-600">23</p>
          <p className="text-xs text-gray-600">Photos</p>
        </div>
      </div>

      {/* Milestone Timeline */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-800 mb-3">Your Milestones</h3>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {milestones.map((milestone) => (
            <div key={milestone.id} className="flex-shrink-0 bg-white rounded-lg p-3 shadow-md hover:shadow-lg transition cursor-pointer">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{milestone.icon}</span>
                <div>
                  <p className="text-sm font-medium">{milestone.title}</p>
                  <p className="text-xs text-gray-500">{milestone.date}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Story Entries */}
      <div className="space-y-4 mb-6">
        <h3 className="font-semibold text-gray-800">Recent Entries</h3>
        {storyEntries.slice(0, 3).map((entry) => (
          <div key={entry.id} className="bg-white rounded-lg p-4 shadow-md hover:shadow-lg transition">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-gray-800">{entry.title}</h4>
                  {entry.milestone && (
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                      Milestone
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <Calendar className="w-3 h-3" />
                  {new Date(entry.date).toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                  {entry.location && (
                    <>
                      <MapPin className="w-3 h-3 ml-2" />
                      {entry.location}
                    </>
                  )}
                </p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs ${moodColors[entry.mood]}`}>
                {moodEmojis[entry.mood]} {entry.mood}
              </span>
            </div>
            
            <p className="text-gray-700 text-sm mb-3">{entry.content}</p>
            
            {entry.photos && (
              <div className="flex gap-2">
                {entry.photos.map((photo, idx) => (
                  <div key={idx} className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden">
                    <Camera className="w-full h-full p-6 text-gray-400" />
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 mt-3 pt-3 border-t">
              <button className="text-sm text-gray-500 hover:text-red-500 flex items-center gap-1">
                <Heart className="w-4 h-4" />
                <span>Love</span>
              </button>
              <button className="text-sm text-gray-500 hover:text-blue-500 flex items-center gap-1">
                <Edit2 className="w-4 h-4" />
                <span>Edit</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Add Section */}
      <div className="bg-white rounded-lg p-4 shadow-md">
        <h3 className="font-semibold text-gray-800 mb-3">Add to Your Story</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleAddEntry}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-lg py-3 hover:bg-indigo-700 transition"
          >
            <Plus className="w-5 h-5" />
            Write Entry
          </button>
          <button className="flex items-center justify-center gap-2 bg-purple-600 text-white rounded-lg py-3 hover:bg-purple-700 transition">
            <Camera className="w-5 h-5" />
            Add Photo
          </button>
          <button
            onClick={handleRecord}
            className={`flex items-center justify-center gap-2 rounded-lg py-3 transition col-span-2 ${
              isRecording 
                ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse' 
                : 'bg-pink-600 text-white hover:bg-pink-700'
            }`}
          >
            <Mic className="w-5 h-5" />
            {isRecording ? 'Recording... Tap to Stop' : 'Record Voice Note'}
          </button>
        </div>
      </div>

      {/* Mood Tracker */}
      <div className="mt-6 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-2">How are you feeling today?</h3>
        <div className="flex gap-2 justify-around">
          {Object.entries(moodEmojis).map(([mood, emoji]) => (
            <button
              key={mood}
              onClick={() => setSelectedMood(mood)}
              className={`flex flex-col items-center p-2 rounded-lg transition ${
                selectedMood === mood ? 'bg-white shadow-md scale-110' : 'hover:bg-white/50'
              }`}
            >
              <span className="text-2xl">{emoji}</span>
              <span className="text-xs text-gray-600 capitalize">{mood}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Inspiration Quote */}
      <div className="mt-6 text-center p-4 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg">
        <p className="text-gray-700 italic">
          "Every immigrant story is a testament to human courage and hope"
        </p>
        <p className="text-sm text-gray-500 mt-2">
          - Your story matters
        </p>
      </div>
    </div>
  );
};