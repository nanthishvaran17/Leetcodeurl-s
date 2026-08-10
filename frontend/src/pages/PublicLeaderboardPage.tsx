import React, { useState, useEffect } from 'react';
import { Globe, Trophy, Shield } from 'lucide-react';
import api from '../services/api';
import { LeaderboardTable, StudentData } from '../components/LeaderboardTable';

export const PublicLeaderboardPage: React.FC = () => {
  const [students, setStudents] = useState<StudentData[]>([]);

  useEffect(() => {
    fetchPublicData();
  }, []);

  const fetchPublicData = async () => {
    try {
      const res = await api.get('/public/leaderboard?limit=50');
      setStudents(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      
      <div className="glass-card p-6 rounded-3xl border bg-gradient-to-r from-brand-900/20 via-indigo-900/20 to-purple-900/20">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-2xl bg-brand-600 text-white">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Public Shareable Leaderboard</h2>
            <p className="text-xs text-gray-500">Read-only public leaderboard route suitable for college TV displays, LinkedIn showcases or placement cell integration</p>
          </div>
        </div>
      </div>

      <LeaderboardTable students={students} />

    </div>
  );
};
