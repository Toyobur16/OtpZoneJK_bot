import React, { useState, useEffect } from 'react';
import { Users, DollarSign, Ban, Check, X, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { UserRecord, WithdrawRecord } from '../types';

interface UsersManagerProps {
  lang: 'bn' | 'en';
}

export const UsersManager: React.FC<UsersManagerProps> = ({ lang }) => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [withdraws, setWithdraws] = useState<WithdrawRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'withdraws'>('users');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Balance adjustment modal
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [balanceAmount, setBalanceAmount] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, withdrawsRes] = await fetch('/api/users')
        .then(r => r.json())
        .then(uData => [uData, fetch('/api/withdraws').then(r => r.json())]);
      
      const wData = await withdrawsRes;
      if (usersRes.users) setUsers(usersRes.users);
      if (wData.withdraws) setWithdraws(wData.withdraws);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateBalance = async () => {
    if (!selectedUser || !balanceAmount) return;
    try {
      const res = await fetch('/api/users/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.user_id,
          amount: Number(balanceAmount)
        })
      });
      const data = await res.json();
      if (data.success) {
        setSelectedUser(null);
        setBalanceAmount('');
        fetchData();
      }
    } catch {
      // Ignore
    }
  };

  const handleBanToggle = async (userId: string, currentBan: boolean) => {
    try {
      const res = await fetch('/api/users/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          ban: !currentBan
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch {
      // Ignore
    }
  };

  const handleWithdrawAction = async (paymentId: string, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch('/api/withdraws/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, status })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch {
      // Ignore
    }
  };

  const filteredUsers = users.filter(u =>
    u.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (u.full_name && u.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-sm p-6">
      {/* Top Tabs & Search */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-[#f1f5f9]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-[#0088cc] text-white shadow-sm'
                : 'bg-[#f8fafc] text-[#64748b] hover:text-[#1e293b] hover:bg-[#f1f5f9] border border-[#e2e8f0]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'ইউজার ম্যানেজমেন্ট' : 'Bot Users'} ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('withdraws')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'withdraws'
                ? 'bg-[#0088cc] text-white shadow-sm'
                : 'bg-[#f8fafc] text-[#64748b] hover:text-[#1e293b] hover:bg-[#f1f5f9] border border-[#e2e8f0]'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'উইথড্র রিকোয়েস্ট' : 'Withdrawals'} ({withdraws.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'users' && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#94a3b8] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={lang === 'bn' ? 'ইউজার আইডি খুঁজুন...' : 'Search User ID / Name...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl pl-8 pr-3 py-2 text-xs text-[#1e293b] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0088cc] w-56"
              />
            </div>
          )}

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#1e293b] border border-[#e2e8f0] transition-all cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content for Users */}
      {activeTab === 'users' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#1e293b]">
            <thead className="bg-[#f8fafc] text-[#64748b] font-semibold border-b border-[#e2e8f0] uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">User ID</th>
                <th className="p-3.5">Name / Username</th>
                <th className="p-3.5">Balance (BDT)</th>
                <th className="p-3.5">Numbers</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#94a3b8]">
                    {lang === 'bn' ? 'কোনো ইউজার তথ্য পাওয়া যায়নি।' : 'No users registered yet.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.user_id} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="p-3.5 font-mono text-[#1e293b] font-bold">{u.user_id}</td>
                    <td className="p-3.5">
                      <div className="font-semibold text-[#1e293b]">{u.full_name || 'N/A'}</div>
                      {u.username && <div className="text-[11px] text-[#0088cc] font-mono">@{u.username}</div>}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-emerald-600">
                      {Number(u.balance || 0).toFixed(2)} BDT
                    </td>
                    <td className="p-3.5 font-mono text-[#64748b]">{u.total_numbers || 0}</td>
                    <td className="p-3.5">
                      {u.is_banned ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          BANNED
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          ACTIVE
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        onClick={() => setSelectedUser(u)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#0088cc]/10 hover:bg-[#0088cc]/20 text-[#0088cc] border border-[#0088cc]/20 cursor-pointer transition-all"
                      >
                        {lang === 'bn' ? 'ব্যালেন্স' : 'Balance'}
                      </button>
                      <button
                        onClick={() => handleBanToggle(u.user_id, !!u.is_banned)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                          u.is_banned
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                        }`}
                      >
                        {u.is_banned ? (lang === 'bn' ? 'আনব্যান' : 'Unban') : (lang === 'bn' ? 'ব্যান' : 'Ban')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Content for Withdrawals */}
      {activeTab === 'withdraws' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#1e293b]">
            <thead className="bg-[#f8fafc] text-[#64748b] font-semibold border-b border-[#e2e8f0] uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">Payment ID</th>
                <th className="p-3.5">User ID</th>
                <th className="p-3.5">Method</th>
                <th className="p-3.5">Number</th>
                <th className="p-3.5">Amount</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {withdraws.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#94a3b8]">
                    {lang === 'bn' ? 'কোনো উইথড্র রিকোয়েস্ট নেই।' : 'No withdrawal requests found.'}
                  </td>
                </tr>
              ) : (
                withdraws.map((w) => (
                  <tr key={w.payment_id} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="p-3.5 font-mono text-[#64748b]">{w.payment_id}</td>
                    <td className="p-3.5 font-mono text-[#1e293b] font-bold">{w.user_id}</td>
                    <td className="p-3.5 font-semibold text-[#0088cc]">{w.method}</td>
                    <td className="p-3.5 font-mono text-[#1e293b]">{w.number}</td>
                    <td className="p-3.5 font-mono font-bold text-emerald-600">{Number(w.amount).toFixed(2)} BDT</td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        w.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : w.status === 'rejected'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {w.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      {w.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleWithdrawAction(w.payment_id, 'approved')}
                            className="px-3 py-1.5 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white font-semibold text-xs inline-flex items-center gap-1 shadow-sm cursor-pointer transition-all"
                          >
                            <Check className="w-3 h-3" /> Approve
                          </button>
                          <button
                            onClick={() => handleWithdrawAction(w.payment_id, 'rejected')}
                            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs inline-flex items-center gap-1 shadow-sm cursor-pointer transition-all"
                          >
                            <X className="w-3 h-3" /> Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Adjust Balance Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h4 className="text-sm font-bold text-[#1e293b] mb-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              {lang === 'bn' ? 'ব্যালেন্স পরিবর্তন করুন' : 'Adjust User Balance'}
            </h4>
            <p className="text-xs text-[#64748b] mb-4">
              User ID: <span className="font-mono text-[#1e293b] font-semibold">{selectedUser.user_id}</span>
              <br />
              Current: <span className="font-mono text-emerald-600 font-bold">{selectedUser.balance} BDT</span>
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#64748b] mb-1.5">
                {lang === 'bn' ? 'যোগ বা বিয়োগের পরিমাণ (+ বা -)' : 'Amount to add/deduct (e.g. 50 or -20):'}
              </label>
              <input
                type="number"
                placeholder="e.g. 50 or -25"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-2.5 text-xs text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#0088cc] font-mono"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 rounded-xl bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#1e293b] text-xs font-semibold border border-[#e2e8f0] cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateBalance}
                className="px-4 py-2 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
              >
                Confirm Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
