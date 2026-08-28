"use client";

import { useEffect, useState } from 'react';
import { toast } from '../../../../components/toast.js';
import {
  disconnectInstagramAccount,
  getInstagramAccounts,
  startInstagramConnection,
} from '../../../../lib/instagram-accounts.js';

const fallbackInitial = (name) => (name || '?').charAt(0).toUpperCase();

export function InstagramAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [removing, setRemoving] = useState('');

  async function load() {
    try {
      setAccounts(await getInstagramAccounts());
    } catch (error) {
      toast(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    if (params.get('instagram') === 'connected') {
      toast('Instagram 계정을 연결했습니다.');
      history.replaceState(null, '', window.location.pathname);
    } else if (params.get('instagram_error')) {
      toast(params.get('instagram_error'), 6000);
      history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  async function connect() {
    if (connecting) return;
    setConnecting(true);
    try { await startInstagramConnection(); }
    catch (error) { toast(error.message); setConnecting(false); }
  }

  async function remove(account) {
    if (!window.confirm(`@${account.username} 계정 연결을 해제할까요?`)) return;
    setRemoving(account.instagram_user_id);
    try {
      await disconnectInstagramAccount(account.instagram_user_id);
      setAccounts((current) => current.filter((item) => item.instagram_user_id !== account.instagram_user_id));
      toast('Instagram 계정 연결을 해제했습니다.');
    } catch (error) { toast(error.message); }
    finally { setRemoving(''); }
  }

  return (
    <section className="mb-12 rounded-[18px] border border-white/15 bg-white/[0.06] p-6">
      <div className="flex items-start justify-between gap-5 max-[640px]:flex-col">
        <div>
          <h2 className="text-[20px] font-bold text-white">Instagram 계정 연결</h2>
          <p className="mt-1 text-[14px] text-white/55">로그인한 Instagram 프로 계정을 여러 개 연결하고 헤더에서 전환할 수 있습니다.</p>
        </div>
        <button type="button" onClick={connect} disabled={connecting}
          className="shrink-0 rounded-full bg-[#e1306c] px-5 py-2.5 text-[14px] font-bold text-white transition hover:bg-[#c92a60] disabled:opacity-50">
          {connecting ? 'Instagram으로 이동 중…' : 'Instagram 계정 연결하기'}
        </button>
      </div>

      <div className="mt-5 space-y-2">
        {loading && <p className="py-3 text-[14px] text-white/50">연결된 계정을 확인하는 중…</p>}
        {!loading && !accounts.length && <p className="rounded-[12px] border border-dashed border-white/15 px-4 py-5 text-center text-[14px] text-white/45">아직 연결된 Instagram 계정이 없습니다.</p>}
        {accounts.map((account) => (
          <div key={account.instagram_user_id} className="flex items-center gap-3 rounded-[12px] bg-black/20 px-4 py-3">
            {account.profile_picture_url ? <img src={account.profile_picture_url} alt="" referrerPolicy="no-referrer" className="size-10 rounded-full object-cover" />
              : <span className="flex size-10 items-center justify-center rounded-full bg-white text-[14px] font-bold text-black">{fallbackInitial(account.username)}</span>}
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-[14px] text-white">@{account.username}</strong>
              <span className="text-[12px] text-white/40">{account.account_type || 'Instagram 프로 계정'}</span>
            </div>
            <button type="button" onClick={() => remove(account)} disabled={removing === account.instagram_user_id}
              className="rounded-full border border-white/20 px-3 py-1.5 text-[12px] font-semibold text-white/65 hover:bg-white/10 disabled:opacity-40">
              {removing === account.instagram_user_id ? '해제 중…' : '연결 해제'}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
