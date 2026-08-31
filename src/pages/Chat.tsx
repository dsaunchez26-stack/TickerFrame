import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Briefcase, Gem, Loader2, LayoutDashboard, Plus, RotateCcw, Send, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MarketOverview } from '@/components/MarketOverview';
import type { Database } from '@/integrations/supabase/types';

const QUICK_LINKS = [
  { to: '/dashboard', icon: LayoutDashboard, title: 'Dashboard', desc: 'Full trading command center' },
  { to: '/value-radar', icon: Gem, title: 'Quality Screen', desc: 'Fundamentals-ranked stocks' },
  { to: '/sector-rotation', icon: RotateCcw, title: 'Sector Rotation', desc: 'Out-of-favor sectors, still-strong names' },
  { to: '/options', icon: Zap, title: 'Options Radar', desc: 'Market pulse, top setups' },
  { to: '/portfolio', icon: Briefcase, title: 'Portfolio', desc: 'Your tracked positions' },
];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

type ConversationRow = Database['public']['Tables']['chat_conversations']['Row'];
interface Msg { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'Top 3 buy signals right now',
  'Show me the news on my portfolio',
  'What stocks would round out my portfolio?',
  'What does Sector Rotation show?',
  'Any unusual insider activity?',
  'Compare TSLA vs NVDA fundamentals',
];

// A grouping cutoff for the sidebar -- "Today" / "Yesterday" / "Previous 7
// Days" the same way most chat products bucket recent history.
function groupLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400_000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return 'Previous 7 Days';
  return 'Older';
}

const ChatPage = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const skipNextLoadRef = useRef(false);

  const loadConversations = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    setConversations(data ?? []);
    setLoadingConvs(false);
  };

  useEffect(() => { loadConversations(); }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    // send() sets activeId itself right after creating a brand-new
    // conversation, while it's still building up that conversation's first
    // exchange in local state -- without this guard, this effect's DB fetch
    // races ahead of send()'s own inserts, returns an empty result, and
    // wipes out the in-flight optimistic messages (which then silently
    // breaks the streaming update below, since it indexes into a
    // now-empty array). Skip the reload for exactly that one transition.
    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false;
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    supabase
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', activeId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        setMessages((data ?? []).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })));
        setLoadingMessages(false);
      });
    return () => { cancelled = true; };
  }, [activeId]);

  const newChat = () => {
    setActiveId(null);
    setMessages([]);
    setInput('');
  };

  const send = async (presetText?: string) => {
    const content = (presetText ?? input).trim();
    if (!content || streaming || !user) return;

    let conversationId = activeId;

    // First message of a fresh chat -- create the conversation row now so
    // it has something real to attach messages to, titled from the
    // message itself the same way most chat products name a new thread.
    if (!conversationId) {
      const { data: created } = await supabase
        .from('chat_conversations')
        .insert({ user_id: user.id, title: content.slice(0, 60) })
        .select()
        .single();
      if (!created) return;
      conversationId = created.id;
      skipNextLoadRef.current = true;
      setActiveId(created.id);
      setConversations(prev => [created, ...prev]);
    }

    const next: Msg[] = [...messages, { role: 'user', content }];
    setMessages([...next, { role: 'assistant', content: '' }]);
    setInput('');
    setStreaming(true);

    await supabase.from('chat_messages').insert({ conversation_id: conversationId, role: 'user', content });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/market-chat`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          'Authorization': `Bearer ${session?.access_token ?? (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string)}`,
        },
        body: JSON.stringify({ messages: next }),
      });

      let assistantText = '';
      if (!res.ok || !res.body) {
        assistantText = `Error: ${(await res.text()).slice(0, 200)}`;
        setMessages(m => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: assistantText }; return c; });
      } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (!data || data === '[DONE]') continue;
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                assistantText += delta;
                setMessages(m => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: assistantText }; return c; });
              }
            } catch { /* partial chunk */ }
          }
        }
      }

      if (assistantText) {
        await supabase.from('chat_messages').insert({ conversation_id: conversationId, role: 'assistant', content: assistantText });
      }
      await supabase.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
      setConversations(prev => {
        const updated = prev.map(c => c.id === conversationId ? { ...c, updated_at: new Date().toISOString() } : c);
        return [...updated].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      });
    } catch (e) {
      const errText = `Error: ${(e as Error).message}`;
      setMessages(m => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: errText }; return c; });
    } finally {
      setStreaming(false);
    }
  };

  const groups: Array<{ name: string; items: ConversationRow[] }> = [];
  for (const c of conversations) {
    const label = groupLabel(c.updated_at);
    let group = groups.find(g => g.name === label);
    if (!group) { group = { name: label, items: [] }; groups.push(group); }
    group.items.push(c);
  }

  return (
    <div className="flex h-[calc(100vh-97px)] min-h-[420px] w-full">
      {/* Sidebar */}
      <div className="flex w-64 flex-none flex-col border-r border-border bg-card">
        <div className="p-3">
          <Button variant="outline" size="sm" onClick={newChat} className="w-full justify-start gap-2">
            <Plus className="h-3.5 w-3.5" />
            New chat
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {loadingConvs ? (
            <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : conversations.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">No conversations yet.</p>
          ) : (
            groups.map(group => (
              <div key={group.name} className="mb-3">
                <div className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{group.name}</div>
                {group.items.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`mb-0.5 block w-full truncate rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                      activeId === c.id ? 'bg-secondary font-medium' : 'text-muted-foreground hover:bg-secondary/50'
                    }`}
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main column */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex h-12 flex-none items-center gap-2 border-b border-border px-4">
          <Link to="/dashboard" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-heading text-sm font-semibold">Market Intelligence</span>
          <span className="ml-auto text-[10px] text-muted-foreground">Answers use cached market data only</span>
        </div>

        {!activeId && !loadingMessages ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-6 py-10">
              <div className="mb-8">
                <div className="font-heading text-2xl font-bold">{greeting()}{user?.email ? `, ${user.email.split('@')[0]}` : ''}</div>
                <p className="mt-1 text-sm text-muted-foreground">Here's the market right now, quick links to jump in, or just ask me anything below.</p>
              </div>

              <MarketOverview />

              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {QUICK_LINKS.map(q => (
                  <Link key={q.to} to={q.to} className="group rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-secondary/30">
                    <q.icon className="h-4 w-4 text-primary" />
                    <div className="mt-1.5 font-heading text-xs font-semibold">{q.title}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">{q.desc}</div>
                  </Link>
                ))}
              </div>

              <div className="mt-8">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                    <Sparkles className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">Or ask me anything</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-lg border border-border bg-card px-3 py-2.5 text-left text-xs hover:bg-secondary/50 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
            {loadingMessages ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="mx-auto flex max-w-2xl flex-col gap-4">
                {messages.map((m, i) => (
                  m.role === 'user' ? (
                    <div key={i} className="flex justify-end">
                      <div className="max-w-[70%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                        {m.content}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-md bg-primary/10">
                        <Sparkles className="h-3 w-3 text-primary" />
                      </div>
                      <div className="max-w-[70%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-2.5 text-sm">
                        {m.content || (streaming && i === messages.length - 1 ? <Loader2 className="h-3 w-3 animate-spin" /> : null)}
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex-none px-4 pb-5 pt-2">
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="mx-auto flex max-w-2xl items-end gap-2 rounded-2xl border border-border bg-card p-2 pl-4">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask about a stock, signal, or insider…"
              disabled={streaming}
              rows={1}
              className="max-h-32 min-h-0 flex-1 resize-none border-0 bg-transparent px-0 py-1.5 text-sm shadow-none focus-visible:ring-0"
            />
            <Button type="submit" size="icon" className="h-8 w-8 flex-none rounded-lg" disabled={streaming || !input.trim()}>
              {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </form>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            Research & education only — not investment advice. Data may be delayed or inaccurate.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
