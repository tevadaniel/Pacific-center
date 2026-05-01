'use client';
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Loader2, Sparkles, Trash2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api } from '@/lib/auth-client';

// Minimal markdown → HTML (gras, italique, listes, titres, retours ligne)
function mdToHtml(md) {
  if (!md) return '';
  let h = md;
  // Escape HTML
  h = h.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Headers
  h = h.replace(/^### (.+)$/gm, '<h4 class="text-sm font-bold mt-2 mb-1">$1</h4>');
  h = h.replace(/^## (.+)$/gm, '<h3 class="text-base font-bold mt-2 mb-1">$1</h3>');
  h = h.replace(/^# (.+)$/gm, '<h2 class="text-lg font-bold mt-2 mb-1">$1</h2>');
  // Bold / italic / code
  h = h.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  h = h.replace(/\*(.+?)\*/g, '<i>$1</i>');
  h = h.replace(/`([^`]+)`/g, '<code class="bg-slate-200 px-1 rounded text-[11px]">$1</code>');
  // Lists (bullet)
  h = h.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
  h = h.replace(/^• (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
  // Paragraph breaks
  h = h.replace(/\n{2,}/g, '</p><p class="mt-1.5">');
  h = `<p>${h.replace(/\n/g, '<br>')}</p>`;
  // Clean empty lis inside p
  return h;
}

const ROLE_META = {
  aracom_admin: {
    title: 'Assistant ARACOM',
    subtitle: 'Accès complet aux données de l\'événement',
    gradient: 'from-blue-600 to-indigo-600',
    accent: 'bg-blue-600 hover:bg-blue-700',
    suggestions: [
      'Quels exposants sont à risque ?',
      'Combien de cautions reçues ce mois ?',
      'Résume l\'état des inscriptions par site',
      'Quelles deadlines arrivent dans les 7 jours ?',
    ],
  },
  exposant: {
    title: 'Assistant Exposant',
    subtitle: 'Conseils sur votre dossier et l\'événement',
    gradient: 'from-emerald-600 to-teal-600',
    accent: 'bg-emerald-600 hover:bg-emerald-700',
    suggestions: [
      'Comment payer ma caution ?',
      'Quand dois-je déposer mes documents ?',
      'Comment fonctionne le verrouillage du stand ?',
      'Mes prochaines étapes à compléter',
    ],
  },
  pacific_centers_readonly: {
    title: 'Assistant Pacific Centers',
    subtitle: 'Explications sur vos stats et vos outils',
    gradient: 'from-cyan-600 to-sky-600',
    accent: 'bg-cyan-600 hover:bg-cyan-700',
    suggestions: [
      'Explique-moi ce que mesure le graphique engagement',
      'Combien d\'exposants sur mes sites ?',
      'À quoi sert le filtre par site ?',
      'Répartition des disciplines sur nos centres',
    ],
  },
};

export function ChatbotPanel({ role, embedded = false, onClose }) {
  const meta = ROLE_META[role] || ROLE_META.aracom_admin;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    const userMsg = { role: 'user', content: msg };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setLoading(true);
    try {
      const r = await api('/api/chatbot', {
        method: 'POST',
        body: JSON.stringify({
          message: msg,
          // Envoi des N-1 messages précédents (sans le nouveau) pour multi-turn
          history: messages.slice(-10),
        }),
      });
      setMessages((m) => [...m, { role: 'assistant', content: r.reply || '(Réponse vide)' }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: `⚠️ Erreur : ${e.message}`, error: true }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const copyMessage = async (content, idx) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch { toast.info('Impossible de copier'); }
  };

  const clearConversation = () => {
    if (messages.length === 0) return;
    if (!confirm('Effacer la conversation ?')) return;
    setMessages([]);
  };

  return (
    <div className={embedded ? 'flex flex-col h-[520px] bg-white rounded-lg' : 'flex flex-col h-full bg-white'}>
      {/* Header */}
      <div className={`px-4 py-3 bg-gradient-to-r ${meta.gradient} text-white flex items-center justify-between ${embedded ? 'rounded-t-lg' : ''}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{meta.title}</div>
            <div className="text-[11px] opacity-80 truncate">{meta.subtitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {messages.length > 0 && (
            <Button size="icon" variant="ghost" className="text-white hover:bg-white/20 h-8 w-8" onClick={clearConversation} title="Effacer la conversation">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          {!embedded && onClose && (
            <Button size="icon" variant="ghost" className="text-white hover:bg-white/20 h-8 w-8" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-slate-50">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="text-center py-4">
              <div className={`inline-flex w-12 h-12 rounded-full bg-gradient-to-r ${meta.gradient} items-center justify-center mb-2`}>
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div className="text-sm font-semibold text-slate-800">Bonjour 👋</div>
              <div className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Posez-moi une question sur {role === 'exposant' ? 'votre dossier ou l\'événement' : role === 'pacific_centers_readonly' ? 'vos stats ou les outils' : 'l\'événement, les exposants, les KPIs'}.
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="text-[11px] uppercase tracking-wide text-slate-400 px-1 font-semibold">Suggestions</div>
              {meta.suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition text-slate-700"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex items-start gap-2 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-slate-700' : `bg-gradient-to-r ${meta.gradient}`}`}>
                {m.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
              </div>
              <div className={`rounded-lg px-3 py-2 text-sm ${m.role === 'user' ? 'bg-blue-600 text-white' : m.error ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-white border border-slate-200 text-slate-800'} shadow-sm`}>
                {m.role === 'assistant' && !m.error ? (
                  <>
                    <div className="prose prose-sm max-w-none [&_p]:my-0 [&_h2]:mt-2 [&_h3]:mt-2 [&_h4]:mt-2 [&_ul]:my-1" dangerouslySetInnerHTML={{ __html: mdToHtml(m.content) }} />
                    <button onClick={() => copyMessage(m.content, idx)} className="mt-1.5 text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-1">
                      {copiedIdx === idx ? <><Check className="w-3 h-3" /> Copié</> : <><Copy className="w-3 h-3" /> Copier</>}
                    </button>
                  </>
                ) : (
                  <div className="whitespace-pre-wrap">{m.content}</div>
                )}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-start gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-r ${meta.gradient}`}>
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="rounded-lg px-3 py-2 text-sm bg-white border border-slate-200 shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400 inline" /> <span className="text-xs text-slate-500 ml-1">En train d'écrire…</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className={`border-t bg-white px-3 py-2.5 ${embedded ? 'rounded-b-lg' : ''}`}>
        <div className="flex gap-2 items-center">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Posez votre question…"
            disabled={loading}
            className="flex-1 h-9 text-sm"
            data-testid="chatbot-input"
          />
          <Button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            size="icon"
            className={`${meta.accent} shrink-0 h-9 w-9`}
            data-testid="chatbot-send"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="text-[10px] text-slate-400 mt-1.5 text-center">
          💡 Propulsé par Claude Sonnet 4.5 · Réponses non contractuelles
        </div>
      </div>
    </div>
  );
}

// Floating button + popover panel — utilisable sur tous les portails
export function ChatbotFloating({ role }) {
  const [open, setOpen] = useState(false);
  const meta = ROLE_META[role] || ROLE_META.aracom_admin;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={`fixed bottom-5 right-5 z-[900] w-14 h-14 rounded-full bg-gradient-to-r ${meta.gradient} text-white shadow-2xl flex items-center justify-center hover:scale-105 transition-transform`}
          aria-label="Ouvrir l'assistant IA"
          data-testid="chatbot-open"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">AI</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-[900] w-[380px] max-w-[calc(100vw-24px)] h-[600px] max-h-[calc(100vh-40px)] rounded-xl shadow-2xl border border-slate-200 overflow-hidden bg-white animate-in slide-in-from-bottom-4 duration-150">
          <ChatbotPanel role={role} onClose={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}

// Embedded card — utilisable dans le dashboard (taille fixe)
export function ChatbotCard({ role }) {
  const meta = ROLE_META[role] || ROLE_META.aracom_admin;
  return (
    <Card className="overflow-hidden border-slate-200">
      <CardHeader className="pb-2 pt-3 px-4 bg-slate-50">
        <CardTitle className="text-sm flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full bg-gradient-to-r ${meta.gradient} flex items-center justify-center`}>
            <Bot className="w-4 h-4 text-white" />
          </div>
          Assistant IA
          <Badge variant="secondary" className="text-[10px] ml-auto">Claude Sonnet 4.5</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ChatbotPanel role={role} embedded />
      </CardContent>
    </Card>
  );
}
