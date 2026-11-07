"use client";
import { useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "";


// ── Types ────────────────────────────────────────────────────────────────────
interface ProfileData {
  display_name: string;
  xp: number;
  level: number;
  streak: number;
  quest_count: number;
  quest_done: boolean;
  balance: {
    balance: number;
    safe_to_spend: number;
    days_remaining: number;
    min_balance: number;
  };
}

interface Message {
  role: "user" | "coach";
  content: string;
  pending?: PendingEntry | null;
  isTyping?: boolean;
}

interface PendingEntry {
  amount: number;
  description: string;
  category: string;
  type: string;
}

interface BudgetStatus {
  [cat: string]: {
    planned: number;
    spent: number;
    remaining: number;
    pct: number;
    over_budget: boolean;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const R = (n: number) =>
  "₹" + Math.round(n).toLocaleString("en-IN");

// ── Sub-components ────────────────────────────────────────────────────────────

function SVGFilter() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <filter id="rough">
        <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="3" result="t" />
        <feDisplacementMap in="SourceGraphic" in2="t" scale="3" />
      </filter>
    </svg>
  );
}

function XPBar({ xp, className }: { xp: number; className?: string }) {
  return (
    <div className={`xp-bar ${className || ""}`}>
      <span className="xp-fill" style={{ width: `${Math.min(xp / 5, 100)}%` }} />
    </div>
  );
}

function BudgetRows({ budget }: { budget: BudgetStatus }) {
  return (
    <>
      {Object.entries(budget).map(([cat, d]) => (
        <div key={cat} className={`br ${d.pct >= 90 ? "hot" : ""}`}>
          <span>{cat}</span>
          <i><b style={{ width: `${Math.min(d.pct, 100)}%` }} /></i>
          <span>{d.pct}%</span>
        </div>
      ))}
    </>
  );
}

function PassCard({ profile, budget }: { profile: ProfileData; budget: BudgetStatus }) {
  return (
    <section className="pass">
      <span className="tag" style={{ position: "absolute", top: -10, right: 12 }}>a. Pass card</span>
      <h2>{profile.display_name}</h2>
      <div className="lvl-band">
        <span>LEVEL {profile.level}</span>
        <span>STREAK: {profile.streak}D</span>
      </div>
      <XPBar xp={profile.xp} />
      <div className="foot" style={{ paddingTop: 4 }}>{profile.xp} / 500 XP</div>
      <div className="row" style={{ marginTop: 8 }}>
        <span>Left to spend</span>
        <b>{R(profile.balance?.balance ?? 0)}</b>
      </div>
      <div className="row">
        <span>Days remaining</span>
        <b>{profile.balance?.days_remaining ?? "N/A"}</b>
      </div>
      <div className="hatched" aria-hidden />
    </section>
  );
}

function QuestNote({ questCount }: { questCount: number }) {
  const done = Math.min(questCount, 3);
  return (
    <section className="note y">
      <span className="pin" />
      <div className="hand">Today&apos;s quest</div>
      <div>Log 3 expenses ({done}/3)</div>
      <XPBar xp={(done / 3) * 500} />
    </section>
  );
}

function BudgetNote({ budget }: { budget: BudgetStatus }) {
  return (
    <section className="note u">
      <span className="pin" />
      <div className="hand">Budget health</div>
      <BudgetRows budget={budget} />
    </section>
  );
}

// ── Pending expense confirmation card ─────────────────────────────────────────
function PendingCard({
  entry,
  onConfirm,
  onCancel,
}: {
  entry: PendingEntry;
  onConfirm: (e: PendingEntry, cat: string) => void;
  onCancel: () => void;
}) {
  const CATS = ["Food", "Transport", "Fun", "Housing", "Education", "Healthcare", "Savings", "Subscriptions", "Other"];
  const [cat, setCat] = useState(entry.category);
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="card">
      <h3>Entry card</h3>
      <div className="row"><span>Amount</span><b>{R(entry.amount)}</b></div>
      <div className="row"><span>Note</span><b>{entry.description}</b></div>
      <div className="row">
        <span>Category</span>
        <b>{cat}</b>
      </div>
      <span className="band">{confirmed ? "Saved ✓" : "Not saved yet"}</span>
      {!confirmed && (
        <div className="btns">
          <button className="btn go" onClick={() => { setConfirmed(true); onConfirm(entry, cat); }}>
            Confirm
          </button>
          <button className="btn" onClick={() => {
            const i = CATS.indexOf(cat);
            setCat(CATS[(i + 1) % CATS.length]);
          }}>
            Change category
          </button>
          <button className="btn" onClick={onCancel}>Cancel</button>
        </div>
      )}
      <div className="hatched" aria-hidden />
    </div>
  );
}

// ── Chat message ──────────────────────────────────────────────────────────────
function ChatMessage({
  msg,
  onConfirm,
  onCancelPending,
}: {
  msg: Message;
  onConfirm: (e: PendingEntry, cat: string) => void;
  onCancelPending: () => void;
}) {
  return (
    <div className={`msg ${msg.role}`}>
      <div className="bubble">
        {msg.isTyping ? (
          <div className="skeleton-tape" aria-label="Calculating financial runway">
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--mute)" }}>
              [CALCULATING RUNWAY...]
            </span>
            <div className="skeleton-line" />
            <div className="skeleton-line mid" />
            <div className="skeleton-line short" />
          </div>
        ) : (
          <>
            <span dangerouslySetInnerHTML={{ __html: msg.content }} />
            {msg.pending && (
              <PendingCard
                entry={msg.pending}
                onConfirm={onConfirm}
                onCancel={onCancelPending}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ text, show }: { text: string; show: boolean }) {
  return <div className={`toast ${show ? "on" : ""}`}>{text}</div>;
}

// ── Confetti ──────────────────────────────────────────────────────────────────
function boom() {
  const colors = ["#f0481f", "#ffe27a", "#c3d7ff", "#161616"];
  for (let i = 0; i < 28; i++) {
    const c = document.createElement("i");
    c.className = "conf";
    c.style.left = Math.random() * 100 + "vw";
    c.style.background = colors[i % 4];
    c.style.animationDelay = Math.random() * 0.4 + "s";
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 2200);
  }
}

function TransactionsPanel({ userId, onUpdate }: { userId: string; onUpdate?: () => void }) {
  const [txns, setTxns] = useState<any[]>([]);

  const load = () => {
    fetch(`${API}/api/transactions/${userId}`)
      .then((r) => r.json())
      .then(setTxns)
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, [userId]);

  const remove = async (id: number) => {
    try {
      await fetch(`${API}/api/transactions/${userId}?id=${id}`, { method: "DELETE" });
      load();
      if (onUpdate) onUpdate();
    } catch {}
  };

  return (
    <div className="panel active" style={{ gap: 8 }}>
      <div className="section-title">Recent Transactions</div>
      {txns.length === 0 && (
        <div style={{ color: "var(--mute)", fontSize: 13 }}>No transactions yet. Chat to log one!</div>
      )}
      {txns.map((t) => (
        <div key={t.id} className="txn-item">
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{t.description}</div>
            <div className="cat">{t.category} · {t.transaction_date}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className={`amount ${t.type}`}>{t.type === "income" ? "+" : "-"}{R(t.amount)}</div>
            <button
              onClick={() => remove(t.id)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                opacity: 0.6,
                padding: "2px 4px",
              }}
              title="Delete transaction"
            >
              🗑️
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Budget Panel ──────────────────────────────────────────────────────────────
function BudgetPanel({ userId }: { userId: string }) {
  const CATS = ["Food", "Transport", "Fun", "Housing", "Education", "Healthcare", "Savings", "Subscriptions", "Other"];
  const [budget, setBudget] = useState<BudgetStatus>({});
  const [cat, setCat] = useState("Food");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () =>
    fetch(`${API}/api/budget/${userId}`).then((r) => r.json()).then(setBudget).catch(() => {});

  useEffect(() => { load(); }, [userId]);

  const save = async () => {
    if (!amount || isNaN(+amount)) return;
    setSaving(true);
    await fetch(`${API}/api/budget`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, category: cat, planned_amount: +amount }),
    });
    setSaving(false);
    setAmount("");
    load();
  };

  return (
    <div className="panel active" style={{ gap: 10 }}>
      <div className="section-title">Budget Planner</div>

      {/* Set budget form */}
      <div style={{ background: "var(--paper)", border: "2px solid var(--ink)", padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>Set monthly limit</div>
        <div className="form-row">
          <label>Category</label>
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            {CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Amount (₹)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 3000" />
        </div>
        <button className="btn go" onClick={save} disabled={saving} style={{ marginTop: 4 }}>
          {saving ? "Saving…" : "Set Budget"}
        </button>
      </div>

      {/* Budget status */}
      {Object.entries(budget).map(([c, d]) => (
        <div key={c} style={{ background: "var(--paper)", border: "2px solid var(--ink)", padding: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontWeight: 700 }}>{c}</span>
            <span style={{ fontSize: 12, color: d.over_budget ? "var(--acc)" : "var(--mute)" }}>
              {R(d.spent)} / {R(d.planned)}
            </span>
          </div>
          <div className="progress-bar">
            <div className="fill" style={{ width: `${Math.min(d.pct, 100)}%`, background: d.pct >= 90 ? "var(--acc)" : "var(--ink)" }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--mute)", marginTop: 4 }}>{d.pct}% used</div>
        </div>
      ))}
    </div>
  );
}

// ── Goals Panel ───────────────────────────────────────────────────────────────
function GoalsPanel({ userId }: { userId: string }) {
  const [goals, setGoals] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [monthly, setMonthly] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () =>
    fetch(`${API}/api/goals/${userId}`).then((r) => r.json()).then(setGoals).catch(() => {});

  useEffect(() => { load(); }, [userId]);

  const save = async () => {
    if (!name || !target) return;
    setSaving(true);
    await fetch(`${API}/api/goals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        name,
        target_amount: +target,
        monthly_contribution: +monthly || 0,
      }),
    });
    setSaving(false);
    setName(""); setTarget(""); setMonthly("");
    load();
  };

  return (
    <div className="panel active" style={{ gap: 10 }}>
      <div className="section-title">Savings Goals</div>

      {/* New goal form */}
      <div style={{ background: "var(--paper)", border: "2px solid var(--ink)", padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>New Goal</div>
        <div className="form-row"><label>Goal name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Laptop" /></div>
        <div className="form-row"><label>Target (₹)</label>
          <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. 40000" /></div>
        <div className="form-row"><label>Monthly contribution (₹)</label>
          <input type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="e.g. 2000" /></div>
        <button className="btn go" onClick={save} disabled={saving} style={{ marginTop: 4 }}>
          {saving ? "Saving…" : "Create Goal"}
        </button>
      </div>

      {goals.length === 0 && (
        <div style={{ color: "var(--mute)", fontSize: 13 }}>No goals yet. Create one above or tell the coach!</div>
      )}
      {goals.map((g) => (
        <div key={g.id} className="goal-card">
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <h3>{g.name}</h3>
            <span style={{ fontSize: 12, color: "var(--mute)" }}>{g.pct}%</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--mute)", marginTop: 4 }}>
            {R(g.current)} / {R(g.target)}
            {g.months_to_goal && ` · ~${g.months_to_goal} months`}
          </div>
          <div className="progress-bar" style={{ marginTop: 8 }}>
            <div className="fill" style={{ width: `${g.pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Insights Panel ────────────────────────────────────────────────────────────
function InsightsPanel({ userId }: { userId: string }) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`${API}/api/insights/${userId}`).then((r) => r.json()).then(setData).catch(() => {});
  }, [userId]);

  if (!data) return <div className="panel active" style={{ color: "var(--mute)", fontSize: 13 }}>Loading insights…</div>;

  return (
    <div className="panel active" style={{ gap: 10 }}>
      <div className="section-title">Spending Insights</div>

      <div style={{ background: "var(--paper)", border: "2px solid var(--ink)", padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>{data.period} Summary</div>
        <div className="insight-stat"><span>Total spent</span><b>{R(data.total_spent)}</b></div>
        <div className="insight-stat"><span>Daily average</span><b>{R(data.daily_avg)}</b></div>
        <div className="insight-stat"><span>Days elapsed</span><b>{data.days_elapsed}</b></div>
        <div className="insight-stat"><span>Days remaining</span><b>{data.days_remaining}</b></div>
        <div className="insight-stat" style={{ borderBottom: "none" }}>
          <span>Month-end forecast</span>
          <b style={{ color: "var(--acc)" }}>{R(data.forecast_month_end)}</b>
        </div>
      </div>

      <div style={{ background: "var(--paper)", border: "2px solid var(--ink)", padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>By Category</div>
        {Object.entries(data.by_category as Record<string, any>).map(([cat, d]: [string, any]) => (
          <div key={cat} className="insight-stat">
            <span>{cat} ({d.count} txns)</span>
            <b>{R(d.total)}</b>
          </div>
        ))}
      </div>

      {data.hot_categories?.length > 0 && (
        <div style={{ background: "#ffe27a", border: "2px solid var(--ink)", padding: 10, color: "#161616" }}>
          ⚠️ <b>{data.hot_categories.join(", ")}</b> — spending is high this month.
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [budget, setBudget] = useState<BudgetStatus>({});
  const [toast, setToast] = useState({ text: "", show: false });
  const [theme, setTheme] = useState("light");
  const [activeTab, setActiveTab] = useState<"chat" | "txns" | "budget" | "goals" | "insights">("chat");
  const chatRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<{ role: string; content: string }[]>([]);

  const [userId, setUserId] = useState<string>("default");
  const [userName, setUserName] = useState<string>("Vinit");

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = (text: string) => {
    setToast({ text, show: true });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 1800);
  };

  // ── Load profile & seed with LocalStorage persistence ──────────────────────
  useEffect(() => {
    const savedUid = localStorage.getItem("budget_user_id") || "default";
    const savedName = localStorage.getItem("budget_user_name") || "Vinit";
    setUserId(savedUid);
    setUserName(savedName);

    // If client has stored budget data, sync it to the API
    try {
      const savedStore = localStorage.getItem("budget_coach_store");
      if (savedStore) {
        fetch(`${API}/api/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: savedStore,
        }).catch(() => {});
      }
    } catch {}

    const loadProfile = (uid: string) =>
      fetch(`${API}/api/profile/${uid}`)
        .then((r) => r.json())
        .then(setProfile)
        .catch(() => {});

    const loadBudget = (uid: string) =>
      fetch(`${API}/api/budget/${uid}`)
        .then((r) => r.json())
        .then(setBudget)
        .catch(() => {});

    loadProfile(savedUid);
    loadBudget(savedUid);

    // Initial coach message
    setTimeout(() => {
      setMessages([
        {
          role: "coach",
          content:
            `Hey ${savedName}! 👋 I'm your Budget Coach, powered by Advanced Financial AI. Tell me what you spent, paste a bank SMS, ask if you can afford something, or tap a chip below to start!`,
        },
      ]);
    }, 300);

    // Theme from system
    const dark = matchMedia("(prefers-color-scheme:dark)").matches;
    setTheme(dark ? "dark" : "light");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  // ── Send message ──────────────────────────────────────────────────────────
  const send = async (text: string) => {
    const t = text.trim();
    if (!t || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: t };
    const typingMsg: Message = { role: "coach", content: "", isTyping: true };
    setMessages((prev) => [...prev, userMsg, typingMsg]);
    setLoading(true);

    historyRef.current.push({ role: "user", content: t });

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: t,
          history: historyRef.current.slice(-10),
          user_id: userId,
        }),
      });
      const data = await res.json();

      historyRef.current.push({ role: "assistant", content: data.reply });

      const coachMsg: Message = {
        role: "coach",
        content: data.reply,
        pending: data.pending || null,
      };
      setMessages((prev) => [...prev.slice(0, -1), coachMsg]);

      if (data.xp_gained > 0) showToast(`+${data.xp_gained} XP`);
      if (data.level_up) { showToast(`Level up! You're now level ${data.profile?.level} 🎉`); boom(); }

      if (data.profile) {
        setProfile((p) => p ? { ...p, ...data.profile } : p);
      }

      // Reload profile balance & budget after chat to instantly reflect any income credited or expense changes
      fetch(`${API}/api/profile/${userId}`).then((r) => r.json()).then(setProfile).catch(() => {});
      fetch(`${API}/api/budget/${userId}`).then((r) => r.json()).then(setBudget).catch(() => {});
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "coach", content: "⚠️ Something went wrong processing your request. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ── Confirm pending expense ───────────────────────────────────────────────
  const confirmExpense = async (entry: PendingEntry, category: string) => {
    try {
      const res = await fetch(`${API}/api/confirm-expense`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          amount: entry.amount,
          description: entry.description,
          category,
        }),
      });
      const data = await res.json();
      showToast("+10 XP");
      if (data.quest_complete) { boom(); showToast("Quest complete! +50 XP 🎉"); }
      if (data.profile) setProfile((p) => p ? { ...p, ...data.profile } : p);
      if (data.balance) setProfile((p) => p ? { ...p, balance: data.balance } : p);

      // Follow-up message from coach
      const cat = data.category_status;
      let followUp = `Saved! `;
      if (cat) followUp += `${category} is at ${cat.pct}% of its limit. `;
      if (data.balance) followUp += `You have ${R(data.balance.balance)} left this month.`;
      setMessages((prev) => [
        ...prev,
        { role: "coach", content: followUp },
      ]);

      fetch(`${API}/api/budget/${userId}`).then((r) => r.json()).then(setBudget).catch(() => {});
    } catch {
      showToast("Error saving. Try again.");
    }
  };

  // ── Cancel pending ────────────────────────────────────────────────────────
  const cancelPending = () => {
    setMessages((prev) =>
      prev.map((m, i) =>
        i === prev.length - 1 ? { ...m, pending: null } : m
      )
    );
  };

  // ── Quick chips ───────────────────────────────────────────────────────────
  const chips = [
    { label: "Received ₹5,000", text: "Received ₹5,000 from freelance client" },
    { label: "Log ₹150 lunch", text: "I spent ₹150 on lunch" },
    { label: "Can I afford ₹1,000?", text: "Can I afford ₹1,000?" },
    { label: "Daily safe limit", text: "How much can I spend today?" },
    { label: "Weekend cap", text: "What is my safe weekend budget?" },
    { label: "50/30/20 audit", text: "Analyze my budget with 50/30/20 rule" },
    { label: "Credit SMS Test", text: "Your a/c 1234 is credited with Rs 15000.00 on 30Oct26 by transfer from CLIENT" },
    { label: "Debit SMS Test", text: "Sent Rs.320 from HDFC Bank A/c 1234 to SWIGGY on 16-OCT-26 UPI:42901" },
    { label: "Emergency mode", text: "Financial emergency, help me survive" },
    { label: "Savings tips", text: "Give me smart savings tips for Food" },
  ];

  const bal = profile?.balance;

  return (
    <>
      <SVGFilter />
      <Toast text={toast.text} show={toast.show} />

      <div className="app">
        {/* ── Main column ── */}
        <main className="main">
          {/* Header */}
          <div className="head">
            <h1 aria-label="Budget Coach">
              BUDGET C<span className="dot" />ACH
            </h1>
            <span className="hand">just tell me what you spent</span>
            <svg className="arrow" width="70" height="40" viewBox="0 0 70 40" fill="none"
              stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
              <path d="M4 6 C30 2 52 12 60 32" />
              <path d="M50 28 L60 33 L63 22" />
            </svg>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "var(--paper)",
                  border: "2px solid var(--ink)",
                  padding: "4px 8px",
                  fontSize: 11,
                  fontWeight: 700,
                  boxShadow: "2px 2px 0 var(--ink)",
                }}
              >
                <span>👤 {userName}</span>
                <a
                  href="/login"
                  style={{
                    color: "var(--acc)",
                    textDecoration: "none",
                    marginLeft: 4,
                    borderLeft: "1px solid var(--line)",
                    paddingLeft: 6,
                  }}
                  title="Switch user or log out"
                >
                  Exit ↗
                </a>
              </div>
              <button className="tog" role="switch" aria-checked={theme === "dark"}
                aria-label="Toggle theme"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                <span className="knob" />
                <span>{theme === "dark" ? "Dark" : "Light"}</span>
              </button>
            </div>
          </div>

          {/* Mobile top bar */}
          {profile && (
            <div className="top">
              <span className="tag">LV {profile.level}</span>
              <XPBar xp={profile.xp} className="xp-bar" />
              <span className="tag">STREAK: {profile.streak}D</span>
              <span className="tag">QUEST {Math.min(profile.quest_count, 3)}/3</span>
            </div>
          )}

          {/* ── Panels ── */}
          <div
            className={`panel ${activeTab === "chat" ? "active" : ""}`}
            style={{ flex: 1, minHeight: 0, overflow: "hidden", display: activeTab === "chat" ? "flex" : "none", flexDirection: "column" }}
            id="chat"
            aria-live="polite"
          >
            <div
              className="chat"
              ref={chatRef}
              style={{ flex: 1, minHeight: 0, overflowY: "auto", scrollBehavior: "smooth", paddingBottom: 8 }}
            >
              {messages.map((msg, i) => (
                <ChatMessage
                  key={i}
                  msg={msg}
                  onConfirm={confirmExpense}
                  onCancelPending={cancelPending}
                />
              ))}
            </div>
          </div>

          {activeTab === "txns" && (
            <TransactionsPanel
              userId={userId}
              onUpdate={() => {
                fetch(`${API}/api/profile/${userId}`).then((r) => r.json()).then(setProfile).catch(() => {});
                fetch(`${API}/api/budget/${userId}`).then((r) => r.json()).then(setBudget).catch(() => {});
              }}
            />
          )}
          {activeTab === "budget" && <BudgetPanel userId={userId} />}
          {activeTab === "goals" && <GoalsPanel userId={userId} />}
          {activeTab === "insights" && <InsightsPanel userId={userId} />}

          {/* Decluttered Quick Chips — only on chat tab */}
          {activeTab === "chat" && (
            <div
              className="chips"
              style={{
                display: "flex",
                overflowX: "auto",
                whiteSpace: "nowrap",
                padding: "6px 2px 8px",
                gap: 6,
                scrollbarWidth: "none",
              }}
            >
              {chips.slice(0, 5).map((c) => (
                <button
                  key={c.label}
                  className="chip"
                  onClick={() => send(c.text)}
                  style={{ minHeight: 36, padding: "0 12px", fontSize: 11, flexShrink: 0 }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* Input area */}
          <div className="comp">
            <input
              id="inp"
              type="text"
              placeholder={activeTab === "chat" ? "Try: I spent ₹80 on chai" : "Ask the coach…"}
              aria-label="Message your coach"
              autoComplete="off"
              value={input}
              disabled={loading}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
            />
            <button
              className="send-btn"
              aria-label="Send"
              disabled={loading}
              onClick={() => send(input)}
            >
              ➤
            </button>
          </div>
          <p className="foot">
            {loading ? "Calculating impact…" : "Powered by Groq Llama 3.3 · zero financial hallucinations."}
          </p>
        </main>

        {/* ── Sidebar ── */}
        <aside className="side">
          {profile && <PassCard profile={profile} budget={budget} />}
          <QuestNote questCount={profile?.quest_count ?? 0} />
          {Object.keys(budget).length > 0 && <BudgetNote budget={budget} />}
        </aside>
      </div>

      {/* Mobile tab bar */}
      <nav className="tab-bar">
        {(["chat", "txns", "budget", "goals", "insights"] as const).map((tab) => (
          <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>
            <span>{
              tab === "chat" ? "💬" :
              tab === "txns" ? "📋" :
              tab === "budget" ? "📊" :
              tab === "goals" ? "🎯" : "💡"
            }</span>
            <span>{
              tab === "chat" ? "Coach" :
              tab === "txns" ? "Txns" :
              tab === "budget" ? "Budget" :
              tab === "goals" ? "Goals" : "Insights"
            }</span>
          </button>
        ))}
      </nav>
    </>
  );
}
