import Groq from "groq-sdk";
import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";
import * as fin from "./finance";
import { getStore } from "./store";
import { getProfile } from "./store";
import { parseFinancialInput } from "./nlp";
import { processRuleBasedAI, AIResponse } from "./ruleEngine";

// ── Google Gemini Tool Declarations ─────────────────────────────────────────
const GEMINI_TOOLS: FunctionDeclaration[] = [
  {
    name: "log_expense",
    description: "Log a new expense transaction after extracting amount, description, and category. Returns a pending confirmation card.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        amount: { type: Type.NUMBER, description: "Amount in INR" },
        description: { type: Type.STRING, description: "Description of expense" },
        category: { type: Type.STRING, description: "Category of expense" },
      },
      required: ["amount", "description", "category"],
    },
  },
  {
    name: "log_income",
    description: "Log received money, salary, stipend, cashback, or freelance earnings.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        amount: { type: Type.NUMBER, description: "Amount received in INR" },
        description: { type: Type.STRING, description: "Source or description of income" },
      },
      required: ["amount", "description"],
    },
  },
  {
    name: "check_affordability",
    description: "Check whether the user can afford a specific purchase amount right now.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        amount: { type: Type.NUMBER, description: "Purchase amount in INR" },
      },
      required: ["amount"],
    },
  },
  {
    name: "get_budget_status",
    description: "Get the current month's budget status by category.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "get_spending_insights",
    description: "Get spending insights, daily average, and forecast.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "run_whatif",
    description: "Simulate a what-if financial scenario.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        scenario: { type: Type.STRING, description: "Scenario description" },
        amount: { type: Type.NUMBER, description: "Relevant amount" },
      },
      required: ["scenario", "amount"],
    },
  },
  {
    name: "get_goals",
    description: "Get current savings goals and progress.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
];

// ── Groq / OpenAI Compatible Tool Declarations ──────────────────────────────
const GROQ_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "log_expense",
      description: "Log a new expense transaction after extracting amount, description, and category. Returns a pending confirmation card.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Amount in INR" },
          description: { type: "string", description: "Description of expense" },
          category: { type: "string", description: "Category of expense (Food, Transport, Fun, Housing, Education, Healthcare, Savings, Subscriptions, Other)" },
        },
        required: ["amount", "description", "category"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "log_income",
      description: "Log received money, salary, stipend, cashback, or freelance earnings directly to balance.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Amount received in INR" },
          description: { type: "string", description: "Source or description of income" },
        },
        required: ["amount", "description"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "check_affordability",
      description: "Check whether the user can afford a specific purchase amount right now.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Purchase amount in INR" },
        },
        required: ["amount"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_budget_status",
      description: "Get the current month's budget status by category.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_spending_insights",
      description: "Get spending insights, daily average, and forecast.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "run_whatif",
      description: "Simulate a what-if financial scenario.",
      parameters: {
        type: "object",
        properties: {
          scenario: { type: "string", description: "Scenario description" },
          amount: { type: "number", description: "Relevant amount" },
        },
        required: ["scenario", "amount"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_goals",
      description: "Get current savings goals and progress.",
      parameters: { type: "object", properties: {} },
    },
  },
];

const SYSTEM_PROMPT = `You are Budget Coach — an encouraging, non-judgmental, practical personal finance assistant for Indian users (students, freshers, professionals).

CORE PRINCIPLES:
1. Always use tools to fetch data or prepare an expense entry card.
2. All financial numbers must come strictly from tool results — never hallucinate or invent balances.
3. For expenses: call log_expense with the amount, description, and category.
4. For received money, salary, stipend, cashback, or income: call log_income with the amount and description.
5. Keep answers brief, clear, and friendly. Use ₹ symbol for Indian rupees.`;

function checkLevelUp(profile: any): boolean {
  let up = false;
  while (profile.xp >= 500) {
    profile.xp -= 500;
    profile.level += 1;
    up = true;
  }
  return up;
}

export function executeTool(name: string, args: any, userId: string): any {
  if (name === "get_balance") {
    return fin.getBalance(userId);
  }
  if (name === "check_affordability") {
    return fin.checkAffordability(userId, Number(args.amount));
  }
  if (name === "get_budget_status") {
    return fin.getBudgetStatus(userId);
  }
  if (name === "get_spending_insights") {
    return fin.getSpendingInsights(userId);
  }
  if (name === "run_whatif") {
    return fin.runWhatIf(userId, args.scenario || "scenario", Number(args.amount) || 500);
  }
  if (name === "get_goals") {
    return fin.getGoalsProgress(userId);
  }
  if (name === "log_expense") {
    return {
      status: "pending_confirmation",
      amount: Number(args.amount),
      description: String(args.description),
      category: String(args.category),
      type: "expense",
    };
  }
  if (name === "log_income") {
    const store = getStore();
    const now = new Date();
    store.transactions.unshift({
      id: store.nextId++,
      user_id: userId,
      type: "income",
      amount: Number(args.amount),
      description: String(args.description || "Income"),
      category: "Income",
      transaction_date: now.toISOString().split("T")[0],
      source: "chat",
      created_at: now.toISOString(),
    });
    const profile = getProfile(userId);
    profile.xp += 15;
    const newBal = fin.getBalance(userId);
    return {
      status: "saved",
      type: "income",
      amount: Number(args.amount),
      description: String(args.description || "Income"),
      balance: newBal,
    };
  }
  return { error: `Unknown tool: ${name}` };
}

// Primary models to try in order of capability on Groq
const GROQ_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant"
];

// ── Groq LLM Handler ────────────────────────────────────────────────────────
async function chatWithGroq(message: string, history: any[], userId: string, apiKey: string): Promise<AIResponse> {
  const groq = new Groq({ apiKey });

  const messages: any[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  for (const h of history.slice(-8)) {
    messages.push({
      role: h.role === "user" ? "user" : "assistant",
      content: h.content,
    });
  }
  messages.push({ role: "user", content: message });

  let response: any = null;
  let lastError: any = null;

  for (const model of GROQ_MODELS) {
    try {
      response = await groq.chat.completions.create({
        model,
        messages,
        tools: GROQ_TOOLS,
        tool_choice: "auto",
        temperature: 0.3,
      });
      if (response?.choices?.[0]) {
        break;
      }
    } catch (err: any) {
      lastError = err;
      console.error(`[Groq Error Details]: model=${model}`, err);
      // If error is 429 (rate limit) or 401 (invalid key), do not attempt same broken key across all models repeatedly
      if (err?.status === 401 || err?.status === 429) {
        break;
      }
    }
  }

  if (!response?.choices?.[0]) {
    throw lastError || new Error("All Groq models failed");
  }

  const choice = response.choices?.[0];
  const toolCallsFromLLM = choice?.message?.tool_calls;

  const profile = getProfile(userId);
  let pending: any = null;
  const toolCallsExecuted: any[] = [];
  let xpGained = 0;
  let levelUp = false;

  if (toolCallsFromLLM && toolCallsFromLLM.length > 0) {
    // 1. Push the assistant's message containing tool_calls ONCE
    messages.push(choice.message);

    for (const tc of toolCallsFromLLM) {
      if (tc.type === "function") {
        const name = tc.function.name;
        let args: any = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          args = {};
        }

        const res = executeTool(name, args, userId);
        toolCallsExecuted.push({ tool: name, args, result: res });

        if (name === "log_expense" && res?.status === "pending_confirmation") {
          pending = res;
          profile.xp += 10;
          xpGained += 10;
          profile.quest_count = Math.min(profile.quest_count + 1, 3);
          if (checkLevelUp(profile)) levelUp = true;
        }

        // 2. Push each individual tool result matching tc.id
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          name,
          content: JSON.stringify(res),
        });
      }
    }

    let reply = choice?.message?.content;

    // If model didn't return text (only tool calls), perform follow-up turn to get full advisory explanation
    if (!reply && !pending) {
      for (const followUpModel of GROQ_MODELS) {
        try {
          const followUp = await groq.chat.completions.create({
            model: followUpModel,
            messages,
            temperature: 0.3,
          });
          if (followUp.choices?.[0]?.message?.content) {
            reply = followUp.choices[0].message.content;
            break;
          }
        } catch (e: any) {
          console.warn(`Follow-up turn on ${followUpModel} failed:`, e?.message || e);
        }
      }
    }

    if (!reply) {
      reply = pending
        ? `Got it! I prepared the entry for <b>₹${pending.amount.toLocaleString("en-IN")}</b> (${pending.description}). Please confirm below:`
        : `Processed your request.`;
    }

    return {
      reply,
      pending,
      tool_calls: toolCallsExecuted,
      xp_gained: xpGained,
      level_up: levelUp,
      profile: {
        xp: profile.xp,
        level: profile.level,
        streak: profile.streak,
        quest_count: profile.quest_count,
      },
    };
  }

  return {
    reply: choice?.message?.content || "I'm here to help manage your budget!",
    pending: null,
    tool_calls: [],
    xp_gained: 0,
    level_up: false,
    profile: {
      xp: profile.xp,
      level: profile.level,
      streak: profile.streak,
      quest_count: profile.quest_count,
    },
  };
}

// ── Gemini LLM Handler ──────────────────────────────────────────────────────
async function chatWithGemini(message: string, history: any[], userId: string, apiKey: string): Promise<AIResponse> {
  const ai = new GoogleGenAI({ apiKey });

  const contents: any[] = [];
  for (const h of history.slice(-8)) {
    contents.push({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.content }],
    });
  }
  contents.push({ role: "user", parts: [{ text: message }] });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations: GEMINI_TOOLS }],
    },
  });

  const candidate = response.candidates?.[0];
  const functionCalls =
    candidate?.content?.parts
      ?.filter((p: any) => p.functionCall)
      ?.map((p: any) => p.functionCall) || [];

  const profile = getProfile(userId);
  let pending: any = null;
  const toolCalls: any[] = [];
  let xpGained = 0;
  let levelUp = false;

  if (functionCalls.length > 0) {
    for (const fc of functionCalls) {
      const res: any = executeTool(fc.name, fc.args, userId);
      toolCalls.push({ tool: fc.name, args: fc.args, result: res });

      if (fc.name === "log_expense" && res?.status === "pending_confirmation") {
        pending = res;
        profile.xp += 10;
        xpGained += 10;
        profile.quest_count = Math.min(profile.quest_count + 1, 3);
        if (checkLevelUp(profile)) levelUp = true;
      }
    }

    const textParts =
      candidate?.content?.parts
        ?.filter((p: any) => p.text)
        ?.map((p: any) => p.text)
        .join("\n") || "";

    const reply =
      textParts ||
      (pending
        ? `Got it! I prepared the entry for <b>₹${pending.amount.toLocaleString("en-IN")}</b> (${pending.description}). Please confirm below:`
        : `Processed your request successfully.`);

    return {
      reply,
      pending,
      tool_calls: toolCalls,
      xp_gained: xpGained,
      level_up: levelUp,
      profile: {
        xp: profile.xp,
        level: profile.level,
        streak: profile.streak,
        quest_count: profile.quest_count,
      },
    };
  }

  return {
    reply: response.text || "I'm here to help with your finances!",
    pending: null,
    tool_calls: [],
    xp_gained: 0,
    level_up: false,
    profile: {
      xp: profile.xp,
      level: profile.level,
      streak: profile.streak,
      quest_count: profile.quest_count,
    },
  };
}

// ── Master Chat Orchestrator ────────────────────────────────────────────────
export async function chat(message: string, history: any[], userId: string): Promise<AIResponse> {
  const parsed = parseFinancialInput(message);

  const groqKey = process.env.GROQ_API_KEY || process.env.GROQ_API_KEY_;
  const geminiKey = process.env.GEMINI_API_KEY;

  const hasGroq = groqKey && groqKey !== "YOUR_GROQ_API_KEY_HERE" && groqKey.startsWith("gsk_");
  const hasGemini = geminiKey && geminiKey !== "YOUR_GEMINI_API_KEY_HERE" && !geminiKey.includes("your_");

  // If user pasted a bank SMS or triggered a high-precision deterministic intent
  if (parsed.isBankSms || parsed.intent === "LOG_EXPENSE" || parsed.intent === "LOG_INCOME" || parsed.intent === "FINANCIAL_AUDIT_50_30_20" || parsed.intent === "DAILY_SAFE_LIMIT" || parsed.intent === "WEEKEND_BUDGET") {
    return processRuleBasedAI(parsed, userId, message);
  }

  // 1. Try Groq (Llama 3.3 70B)
  if (hasGroq) {
    try {
      return await chatWithGroq(message, history, userId, groqKey);
    } catch (err: any) {
      console.error("[Groq AI Error]:", err);
      (globalThis as any).__last_ai_err = err?.message || String(err);
      // fallback to next provider
    }
  }

  // 2. Try Gemini
  if (hasGemini) {
    try {
      return await chatWithGemini(message, history, userId, geminiKey);
    } catch (err) {
      console.error("[Gemini AI Error]:", err);
      // fallback to rule engine
    }
  }

  // 3. Robust rule-based financial engine fallback
  const fallback = processRuleBasedAI(parsed, userId, message);
  if (fallback.reply.startsWith("Hey! I'm your Budget Coach") && (parsed.intent as string) === "UNKNOWN") {
    const errDetail = (globalThis as any).__last_ai_err ? `<br><small style="opacity:0.7">Note: ${String((globalThis as any).__last_ai_err).replace(/</g, "&lt;")}</small><br>` : "";
    fallback.reply = `I couldn't reach the AI model right now.${errDetail}<br>In the meantime, here are a few things you can ask me:<br><br>` +
      `• <b>Log an expense</b>: <i>"I spent ₹150 on biryani"</i> or paste a bank SMS<br>` +
      `• <b>Affordability check</b>: <i>"Can I afford ₹1,500 headphones?"</i><br>` +
      `• <b>Daily spend cap</b>: <i>"How much can I spend today?"</i><br>` +
      `• <b>Weekend budget</b>: <i>"What is my weekend budget?"</i><br>` +
      `• <b>50/30/20 audit</b>: <i>"Analyze my budget health"</i><br>` +
      `• <b>What-if simulation</b>: <i>"What if I save ₹1,000 more?"</i>`;
  }
  return fallback;
}
