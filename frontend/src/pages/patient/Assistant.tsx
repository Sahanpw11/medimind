import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, CheckCircle2, MessageCircleHeart, MessageSquarePlus, Trash2, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import type { ChatMsg } from '../../lib/types';
import { Banner, Button, Card, Empty, Screen } from '../../components/ui';

const SUGGEST = ['What is a routine checkup?', 'How much sleep do adults need?', 'How should I prepare for my appointment?', 'What are vital signs?'];
const newId = () => `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
interface Conv { sessionId: string; title: string; messageCount: number; updatedAt: string }

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`; if (m < 1440) return `${Math.floor(m / 60)} h ago`; return `${Math.floor(m / 1440)} d ago`;
}

export default function Assistant() {
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const convs = useQuery({ queryKey: ['convs'], queryFn: () => api<{ data: Conv[] }>('/ai/conversations') });
  // A visit opens a fresh chat immediately (no waiting for the list); the selected chat lives in the URL so a reload keeps it.
  const [fresh] = useState(newId);
  const session = sp.get('c') ?? fresh;
  useEffect(() => { if (!sp.get('c')) setSp({ c: fresh }, { replace: true }); }, [sp, fresh, setSp]);

  const history = useQuery({ queryKey: ['chat', session], queryFn: () => api<{ data: ChatMsg[] }>(`/ai/history?sessionId=${session}`), staleTime: 0, refetchOnMount: 'always' });
  const [msgs, setMsgs] = useState<ChatMsg[]>([]), [text, setText] = useState(''), [confirmDel, setConfirmDel] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { setMsgs(history.data?.data ?? []); }, [history.data, session]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [msgs.length]);

  const ask = useMutation({
    mutationFn: (question: string) => api<ChatMsg & { answer: string }>('/ai/chat', { method: 'POST', body: { question, sessionId: session } }),
    onSuccess: (r) => {
      setMsgs((m) => [...m, { role: 'assistant', content: r.answer, sources: r.sources, mode: r.mode, degraded: r.degraded, disclaimer: r.disclaimer, emergency: r.emergency }]);
      void qc.invalidateQueries({ queryKey: ['convs'] });
      void qc.invalidateQueries({ queryKey: ['chat', session] }); // keep the cached copy of this chat current
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => api(`/ai/conversations/${id}`, { method: 'DELETE' }),
    onSuccess: (_r, id) => { setConfirmDel(null); void qc.invalidateQueries({ queryKey: ['convs'] }); if (id === session) startNew(); },
  });

  function startNew() { ask.reset(); setText(''); setSp({ c: newId() }); }
  function open(id: string) { if (id !== session) { ask.reset(); setSp({ c: id }); } }
  function send(q: string) { const question = q.trim(); if (question.length < 2 || ask.isPending) return; setMsgs((m) => [...m, { role: 'user', content: question }]); setText(''); ask.mutate(question); }

  const list = convs.data?.data ?? [];
  return (
    <Screen title="Assistant" subtitle="General health education from an approved set of passages." action={<Button type="button" className="fit" onClick={startNew}><MessageSquarePlus className="icon" aria-hidden />New chat</Button>}>
      <div className="cols">
        <div className="s8 rows2">
          <section className="card chat-shell" aria-label="Conversation">
            <div className="chat" aria-live="polite">
              {msgs.length === 0 && !history.isPending && (
                <Empty icon={<MessageCircleHeart />} title="Ask a general question">Try one of these, or type your own.
                  <div className="suggest">{SUGGEST.map((s) => <button key={s} type="button" onClick={() => send(s)}>{s}</button>)}</div>
                </Empty>
              )}
              {msgs.map((m, i) => m.role === 'user' ? <div key={i} className="bubble user">{m.content}</div> : (
                <div key={i} className="bubble bot">
                  {m.mode === 'emergency' && <Banner kind="emergency" title="This may be an emergency" />}
                  {m.degraded && <Banner kind="error" title="Assistant unavailable">The service did not respond. This is a safe fallback, not an answer.</Banner>}
                  <p>{m.content}</p>
                  {m.sources && m.sources.length > 0 && <div className="sources" aria-label="Sources">{m.sources.map((s) => <span className="chip accent" key={s}>{s}</span>)}</div>}
                  {m.mode === 'refusal' && <p className="fine">I can share general information, but a clinician should answer this.</p>}
                  <p className="fine">Not medical advice. In an emergency call 1990 or go to the nearest hospital.</p>
                </div>
              ))}
              {ask.isPending && <div className="bubble bot" aria-label="Assistant is typing"><div className="skel skel-row" style={{ width: 160 }} /></div>}
              {ask.isError && <Banner kind="error" action={<Button compact variant="secondary" onClick={() => ask.reset()}>Dismiss</Button>}>{(ask.error as Error).message}</Banner>}
              <div ref={bottom} className="chat-end" />
            </div>
            <form className="composer" onSubmit={(e: FormEvent) => { e.preventDefault(); send(text); }}>
              <label htmlFor="q" className="sr-only">Your question</label>
              <input id="q" className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask a general health question" maxLength={500} autoComplete="off" />
              <Button type="submit" className="send" aria-label="Send" disabled={text.trim().length < 2} loading={ask.isPending}><ArrowUp className="icon" aria-hidden /></Button>
            </form>
          </section>
        </div>

        <div className="s4 chats-col">
          <Card title="Chats" hint={list.length ? `${list.length} saved` : 'Your chats are saved here'} flush>
            {convs.isPending ? <div style={{ padding: 20 }}><div className="skel skel-row" /></div> : list.length === 0 ? <p className="notice-empty">No earlier chats yet. Ask your first question to start one.</p> : (
              <div className="chat-list">
                {list.map((c) => (
                  <div key={c.sessionId} className="chat-item" aria-current={c.sessionId === session ? 'true' : undefined}>
                    <button type="button" className="chat-open" onClick={() => open(c.sessionId)} aria-label={`Open chat: ${c.title}`}>
                      <span className="row-title">{c.title}</span><span className="row-sub">{ago(c.updatedAt)}, {c.messageCount / 2} {c.messageCount / 2 === 1 ? 'question' : 'questions'}</span>
                    </button>
                    {confirmDel === c.sessionId
                      ? <span className="chat-confirm"><Button compact variant="danger" loading={del.isPending} onClick={() => del.mutate(c.sessionId)}>Delete</Button><Button compact variant="secondary" onClick={() => setConfirmDel(null)}>Keep</Button></span>
                      : <button type="button" className="chat-del" aria-label={`Delete chat: ${c.title}`} onClick={() => setConfirmDel(c.sessionId)}><Trash2 className="icon" aria-hidden /></button>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
        <div className="s4 stack lg">
          <Card title="What it can do">
            <ul className="can-list">
              <li><CheckCircle2 className="icon" style={{ color: 'var(--ok)' }} aria-hidden />Explain general topics such as checkups, vital signs, sleep and allergies</li>
              <li><CheckCircle2 className="icon" style={{ color: 'var(--ok)' }} aria-hidden />Show which passage each answer came from</li>
              <li><CheckCircle2 className="icon" style={{ color: 'var(--ok)' }} aria-hidden />Say so when it does not have reliable information</li>
            </ul>
          </Card>
          <Card title="What it will not do">
            <ul className="can-list">
              <li><XCircle className="icon" style={{ color: 'var(--danger)' }} aria-hidden />Diagnose conditions or judge symptoms</li>
              <li><XCircle className="icon" style={{ color: 'var(--danger)' }} aria-hidden />Recommend medicines, doses or changes to treatment</li>
              <li><XCircle className="icon" style={{ color: 'var(--danger)' }} aria-hidden />Help in an emergency. Call 1990 or go to the nearest hospital.</li>
            </ul>
          </Card>
        </div>
      </div>
    </Screen>
  );
}
