'use client';

import React, { useState, useEffect, useMemo } from 'react';

interface Player {
  id: string;
  number: number;
  name: string;
  photoUrl: string;
  countryFlag: string;
  countryCode: string;
  positionCategory: 'Kiper' | 'Bek' | 'Gelandang' | 'Penyerang';
  positionDetail: string;
  age: number;
  salaryWeeklyNum: number;
  salaryDisplay: string;
  marketValueNum: number;
  marketValueDisplay: string;
  status?: 'CEDERA' | null;
  isNew?: boolean;
}

export default function SquadPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'Skuad' | 'Kontrak' | 'Pelatih' | 'Cedera' | 'Timnas' | 'Akademi' | 'Women'>('Skuad');
  const [posFilter, setPosFilter] = useState<'Semua' | 'Kiper' | 'Bek' | 'Gelandang' | 'Penyerang'>('Semua');
  const [sortBy, setSortBy] = useState<'pos' | 'salary' | 'marketValue'>('pos');

  // Fetch data dari Wikipedia via API internal
  useEffect(() => {
    async function fetchSquad() {
      try {
        setLoading(true);
        const res = await fetch('/api/squad');
        const json = await res.json();
        if (json.success && json.data) {
          setPlayers(json.data);
        }
      } catch (err) {
        console.error('Error loading squad:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSquad();
  }, []);

  // Perhitungan statistik ringkasan
  const totalPlayers = players.length;
  const kiperCount = players.filter(p => p.positionCategory === 'Kiper').length;
  const bekCount = players.filter(p => p.positionCategory === 'Bek').length;
  const gelCount = players.filter(p => p.positionCategory === 'Gelandang').length;
  const penCount = players.filter(p => p.positionCategory === 'Penyerang').length;

  const avgAge = totalPlayers > 0
    ? (players.reduce((acc, p) => acc + p.age, 0) / totalPlayers).toFixed(1)
    : '0';

  const youngestPlayer = players.length > 0 ? [...players].sort((a, b) => a.age - b.age)[0] : null;
  const oldestPlayer = players.length > 0 ? [...players].sort((a, b) => b.age - a.age)[0] : null;

  const injuredCount = players.filter(p => p.status === 'CEDERA').length;
  const totalWeeklySalary = (players.reduce((acc, p) => acc + p.salaryWeeklyNum, 0) / 1000).toFixed(2);
  const totalMarketValue = players.reduce((acc, p) => acc + p.marketValueNum, 0).toFixed(1);

  // Filtering & Sorting
  const filteredAndSortedPlayers = useMemo(() => {
    let result = [...players];

    if (posFilter !== 'Semua') {
      result = result.filter(p => p.positionCategory === posFilter);
    }

    if (sortBy === 'salary') {
      result.sort((a, b) => b.salaryWeeklyNum - a.salaryWeeklyNum);
    } else if (sortBy === 'marketValue') {
      result.sort((a, b) => b.marketValueNum - a.marketValueNum);
    } else {
      result.sort((a, b) => a.number - b.number);
    }

    return result;
  }, [players, posFilter, sortBy]);

  const groupedPlayers = useMemo(() => {
    const categories: Array<'Kiper' | 'Bek' | 'Gelandang' | 'Penyerang'> = ['Kiper', 'Bek', 'Gelandang', 'Penyerang'];
    
    if (sortBy !== 'pos') {
      return [{ category: posFilter === 'Semua' ? 'HASIL URUTAN' : posFilter, list: filteredAndSortedPlayers }];
    }

    return categories
      .map(cat => ({
        category: cat,
        list: filteredAndSortedPlayers.filter(p => p.positionCategory === cat),
      }))
      .filter(group => group.list.length > 0);
  }, [filteredAndSortedPlayers, sortBy, posFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f5f8] flex items-center justify-center">
        <p className="text-gray-500 font-semibold animate-pulse">Memuat data skuad dari Wikipedia & FotMob...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f5f8] text-gray-800 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Sub-Navigasi Menu Tim */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3">
          {[
            { name: 'Skuad', badge: null },
            { name: 'Kontrak', badge: null },
            { name: 'Pelatih', badge: null },
            { name: 'Cedera', badge: injuredCount },
            { name: 'Timnas', badge: null },
            { name: 'Akademi', badge: null },
            { name: 'Women', badge: null },
          ].map(tab => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name as any)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                activeTab === tab.name
                  ? 'bg-[#111827] text-white shadow'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <span>{tab.name}</span>
              {tab.badge !== null && tab.badge > 0 && (
                <span className="bg-red-600 text-white text-xs px-1.5 py-0.2 rounded-full font-bold">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 8 Kartu Ringkasan Statistik */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#d9232e] text-white p-5 rounded-xl shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold opacity-90">Pemain tim utama</p>
              <h3 className="text-4xl font-extrabold mt-1">{totalPlayers}</h3>
            </div>
            <p className="text-xs opacity-90 mt-4 leading-relaxed">
              {kiperCount} kiper · {bekCount} bek · {gelCount} gelandang · {penCount} penyerang
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500">Rata-rata usia</p>
              <h3 className="text-3xl font-extrabold text-gray-900 mt-1">{avgAge}</h3>
            </div>
            <p className="text-xs text-gray-500 mt-4 truncate">
              {youngestPlayer && oldestPlayer ? `Termuda ${youngestPlayer.name} (${youngestPlayer.age}) · Tertua ${oldestPlayer.name} (${oldestPlayer.age})` : '-'}
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500">Rekrutan baru</p>
              <h3 className="text-3xl font-extrabold text-gray-900 mt-1">5</h3>
            </div>
            <p className="text-xs text-gray-500 mt-4">Belanja €162,8 jt · bersih €102,5 jt</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500">Cedera</p>
              <h3 className="text-3xl font-extrabold text-gray-900 mt-1">{injuredCount}</h3>
            </div>
            <div>
              <p className="text-xs text-gray-500 mt-2">Ditandai merah di daftar ·</p>
              <button onClick={() => setActiveTab('Cedera')} className="text-xs text-red-600 font-bold hover:underline">
                Lihat menu Cedera →
              </button>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500">Total gaji per pekan</p>
              <h3 className="text-3xl font-extrabold text-gray-900 mt-1">€{totalWeeklySalary} jt</h3>
            </div>
            <p className="text-xs text-gray-500 mt-4">±€101,2 jt per tahun · {totalPlayers} pemain</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500">Gaji tertinggi</p>
              <h3 className="text-3xl font-extrabold text-gray-900 mt-1">€248 rb</h3>
            </div>
            <p className="text-xs text-gray-500 mt-4 truncate">Dušan Vlahović · per pekan</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500">Total nilai transfer</p>
              <h3 className="text-3xl font-extrabold text-gray-900 mt-1">€{totalMarketValue} jt</h3>
            </div>
            <p className="text-xs text-gray-500 mt-4">{totalPlayers} pemain tim utama</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500">Nilai tertinggi</p>
              <h3 className="text-3xl font-extrabold text-gray-900 mt-1">€65 jt</h3>
            </div>
            <p className="text-xs text-gray-500 mt-4 truncate">Dušan Vlahović</p>
          </div>
        </div>

        {/* Section Daftar Skuad */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div className="flex items-center gap-3">
              <span className="w-1.5 h-6 bg-[#d9232e] rounded-full"></span>
              <h2 className="text-xl font-bold text-gray-900">Daftar skuad</h2>
              <span className="text-xs text-gray-400 hidden sm:inline">Klik pemain untuk melihat profil</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(['Semua', 'Kiper', 'Bek', 'Gelandang', 'Penyerang'] as const).map(pos => (
                <button
                  key={pos}
                  onClick={() => setPosFilter(pos)}
                  className={`px-3.5 py-1 text-xs font-medium rounded-full transition-all ${
                    posFilter === pos
                      ? 'bg-[#d9232e] text-white font-semibold'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400 font-semibold uppercase tracking-wider">URUTKAN</span>
            <button
              onClick={() => setSortBy('pos')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                sortBy === 'pos' ? 'bg-[#d9232e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Posisi & nomor
            </button>
            <button
              onClick={() => setSortBy('salary')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                sortBy === 'salary' ? 'bg-[#d9232e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Gaji tertinggi
            </button>
            <button
              onClick={() => setSortBy('marketValue')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                sortBy === 'marketValue' ? 'bg-[#d9232e] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Nilai transfer tertinggi
            </button>
          </div>

          {/* Grid Pemain */}
          <div className="space-y-6">
            {groupedPlayers.map(group => (
              <div key={group.category} className="space-y-3">
                <div className="bg-gray-100 px-3 py-1.5 rounded-md text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <span>{group.category}</span>
                  <span>·</span>
                  <span>{group.list.length}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {group.list.map(player => (
                    <div
                      key={player.id}
                      className="bg-white border border-gray-200 rounded-lg p-3 hover:border-gray-400 transition-all flex items-center gap-3 relative shadow-xs group cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100">
                        <img
                          src={player.photoUrl}
                          alt={player.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://www.fotmob.com/images/player_fallback.png';
                          }}
                        />
                      </div>

                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[#d9232e] font-extrabold text-sm">{player.number}</span>
                          <h4 className="font-bold text-gray-900 text-sm truncate group-hover:text-[#d9232e] transition-colors">
                            {player.name}
                          </h4>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-gray-500 truncate">
                          <span className="font-medium text-gray-600">{player.countryCode}</span>
                          <span>·</span>
                          <span className="truncate">{player.positionDetail}</span>
                          <span>·</span>
                          <span>{player.age} th</span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-gray-500 pt-1 border-t border-gray-100 mt-1">
                          <div>Gaji <span className="font-bold text-gray-800">{player.salaryDisplay}</span></div>
                          <div>Nilai <span className="font-bold text-gray-800">{player.marketValueDisplay}</span></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

        </div>

      </div>
    </div>
  );
}
