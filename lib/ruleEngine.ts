/**
 * Deterministic Financial Intelligence & Rule-Based AI Engine
 * Provides mathematical analysis, 50/30/20 audits, safe burn rates,
 * emergency mode triage, and structured HTML cards.
 */

import * as fin from "./finance";
import { getProfile, getStore } from "./store";
import { ParsedInput } from "./nlp";

export interface AIResponse {
  reply: string;
  pending: any | null;
  tool_calls: Array<{ tool: string; args: any; result: any }>;
  xp_gained: number;
  level_up: boolean;
  profile: {
    xp: number;
    level: number;
    streak: number;
    quest_count: number;
  };
}

const R = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

function checkLevelUp(profile: any): boolean {
  let up = false;
  while (profile.xp >= 500) {
    profile.xp -= 500;
    profile.level += 1;
    up = true;
  }
  return up;
}

export function processRuleBasedAI(parsed: ParsedInput, userId: string, rawMessage: string): AIResponse {
  const profile = getProfile(userId);
  const bal = fin.getBalance(userId);
  const budget = fin.getBudgetStatus(userId);
  const goals = fin.getGoalsProgress(userId);

  const toolCalls: Array<{ tool: string; args: any; result: any }> = [];
  let pending: any = null;
  let reply = "";
  let xpGained = 0;
  let levelUp = false;

  switch (parsed.intent) {
    // ── 1. LOG EXPENSE ────────────────────────────────────────────────────────
    case "LOG_EXPENSE": {
      const cat = parsed.category || "Other";
      const catStatus = budget[cat];
      const newSpent = (catStatus ? catStatus.spent : 0) + parsed.amount;
      const planned = catStatus ? catStatus.planned : 0;
      const newPct = planned > 0 ? Math.round((newSpent / planned) * 100) : 0;

      pending = {
        status: "pending_confirmation",
        amount: parsed.amount,
        description: parsed.description,
        category: cat,
        type: "expense",
      };

      toolCalls.push({
        tool: "log_expense",
        args: pending,
        result: pending,
      });

      profile.xp += 10;
      xpGained += 10;
      profile.quest_count = Math.min(profile.quest_count + 1, 3);
      if (checkLevelUp(profile)) levelUp = true;

      const smsBadge = parsed.isBankSms
        ? `<span class="band" style="font-size:11px;margin-bottom:6px">⚡ Auto-detected from ${parsed.smsBank} SMS</span><br>`
        : "";

      let warning = "";
      if (newPct >= 100) {
        warning = `<br>⚠️ <b>Caution:</b> This purchase will put your <b>${cat}</b> budget at <b>${newPct}%</b> (exceeding limit by ${R(newSpent - planned)}).`;
      } else if (newPct >= 85) {
        warning = `<br>⚡ <b>Heads up:</b> This brings <b>${cat}</b> to <b>${newPct}%</b> of its monthly limit.`;
      }

      reply = `${smsBadge}Save this <b>${R(parsed.amount)}</b> expense for <i>${parsed.description}</i> in <b>${cat}</b>?${warning}<br>Confirm on the card below:`;
      break;
    }

    // ── 2. LOG INCOME ─────────────────────────────────────────────────────────
    case "LOG_INCOME": {
      const store = getStore();
      const now = new Date();
      store.transactions.unshift({
        id: store.nextId++,
        user_id: userId,
        type: "income",
        amount: parsed.amount,
        description: parsed.description,
        category: "Income",
        transaction_date: now.toISOString().split("T")[0],
        source: "chat",
        created_at: now.toISOString(),
      });

      profile.xp += 15;
      xpGained += 15;
      if (checkLevelUp(profile)) levelUp = true;

      const newBal = fin.getBalance(userId);
      toolCalls.push({
        tool: "log_income",
        args: { amount: parsed.amount, description: parsed.description },
        result: { status: "saved", new_balance: newBal.balance },
      });

      reply = `🎉 <b>Income credited!</b> Recorded <b>+${R(parsed.amount)}</b> for <i>${parsed.description}</i>.<br><br>` +
        `• New spendable balance: <b>${R(newBal.balance)}</b><br>` +
        `• Safe to spend: <b>${R(newBal.safe_to_spend)}</b><br>` +
        `• Reward: <b>+15 XP</b> earned!`;
      break;
    }

    // ── 3. AFFORDABILITY CHECK ────────────────────────────────────────────────
    case "CHECK_AFFORDABILITY": {
      const res = fin.checkAffordability(userId, parsed.amount);
      toolCalls.push({ tool: "check_affordability", args: { amount: parsed.amount }, result: res });

      const dailyAllowance = Math.max(1, Math.round(res.safe_to_spend / Math.max(1, bal.days_remaining)));
      const daysEquivalent = Math.round((parsed.amount / dailyAllowance) * 10) / 10;

      const badgeClass = "band";
      let advice = "";

      if (res.verdict === "Safe") {
        advice = `You can comfortably make this purchase! It consumes only <b>${Math.round((parsed.amount / res.safe_to_spend) * 100)}%</b> of your safe buffer, leaving you with <b>${R(res.safe_to_spend - parsed.amount)}</b> for the remaining ${bal.days_remaining} days.`;
      } else if (res.verdict === "Risky") {
        advice = `You have the cash, but this equals <b>${daysEquivalent} days</b> of your daily safe spending allowance (${R(dailyAllowance)}/day). Consider waiting or picking a lower-cost option.`;
      } else {
        advice = `This purchase is <b>${R(parsed.amount - res.safe_to_spend)}</b> above your safe spending margin. Spending this risks dipping into your ₹${res.min_balance} emergency reserve.`;
      }

      reply = `Here is your affordability verdict for <b>${R(parsed.amount)}</b> (${parsed.description}):<br><br>` +
        `<div class="card" style="margin:6px 0 10px">` +
        `<div class="row"><span>Item</span><b>${parsed.description}</b></div>` +
        `<div class="row"><span>Amount</span><b>${R(parsed.amount)}</b></div>` +
        `<div class="row"><span>Safe to spend</span><b>${R(res.safe_to_spend)}</b></div>` +
        `<div class="row"><span>Days remaining</span><b>${bal.days_remaining} days</b></div>` +
        `<span class="${badgeClass}" style="margin-top:6px">${res.verdict.toUpperCase()}</span>` +
        `</div>` +
        `${advice}`;
      break;
    }

    // ── 4. DAILY SAFE BURN RATE ───────────────────────────────────────────────
    case "DAILY_SAFE_LIMIT": {
      const days = Math.max(1, bal.days_remaining);
      const safeDaily = Math.round(bal.safe_to_spend / days);
      const strictDaily = Math.round(bal.balance / days);

      reply = `🎯 <b>Your Daily Safe Spending Allowance:</b><br><br>` +
        `• Safe daily limit: <b>${R(safeDaily)} / day</b> (protecting ₹${bal.min_balance} reserve)<br>` +
        `• Absolute cap: <b>${R(strictDaily)} / day</b><br>` +
        `• Days remaining in month: <b>${days} days</b><br><br>` +
        `<i>💡 Tip: If you stay under ${R(safeDaily)} today, the surplus rolls over to make your weekend buffer bigger!</i>`;
      break;
    }

    // ── 5. WEEKEND BUDGET ─────────────────────────────────────────────────────
    case "WEEKEND_BUDGET": {
      const days = Math.max(1, bal.days_remaining);
      const daily = bal.safe_to_spend / days;
      // Allocate 40% of weekly allowance for 2 weekend days
      const weekendCap = Math.round(daily * 2.8);

      reply = `🍻 <b>Safe Weekend Spending Cap (Fri–Sun):</b><br><br>` +
        `Based on your remaining buffer of <b>${R(bal.safe_to_spend)}</b>, your safe weekend budget is:<br>` +
        `<span class="band" style="font-size:16px;padding:4px 10px">${R(weekendCap)} for the weekend</span><br><br>` +
        `• Per weekend day cap: ~<b>${R(Math.round(weekendCap / 2))}</b><br>` +
        `• Still leaves: <b>${R(Math.max(0, bal.safe_to_spend - weekendCap))}</b> for weekdays<br>` +
        `Enjoy, but keep track of dining & transport!`;
      break;
    }

    // ── 6. 50/30/20 FINANCIAL AUDIT ───────────────────────────────────────────
    case "FINANCIAL_AUDIT_50_30_20": {
      const store = getStore();
      const period = fin.currentPeriod();
      const txns = store.transactions.filter(
        (t) => t.user_id === userId && t.transaction_date.startsWith(period) && t.type === "expense"
      );

      const needsCats = ["Food", "Transport", "Housing", "Education", "Healthcare"];
      const wantsCats = ["Fun", "Subscriptions", "Other"];

      let needsSpent = 0;
      let wantsSpent = 0;
      for (const t of txns) {
        if (needsCats.includes(t.category)) needsSpent += t.amount;
        else wantsSpent += t.amount;
      }

      const totalSpent = Math.max(1, needsSpent + wantsSpent);
      const needsPct = Math.round((needsSpent / totalSpent) * 100);
      const wantsPct = Math.round((wantsSpent / totalSpent) * 100);
      const savingsEstimate = Math.max(0, bal.total_income - totalSpent);
      const savingsPct = bal.total_income > 0 ? Math.round((savingsEstimate / bal.total_income) * 100) : 0;

      reply = `📊 <b>50 / 30 / 20 Financial Health Audit</b><br><br>` +
        `Here is how your actual spending compares to the golden rule:<br><br>` +
        `• <b>Needs (Target: 50%)</b>: ${R(needsSpent)} (${needsPct}%) ${needsPct > 60 ? "⚠️ High" : "✅ Good"}<br>` +
        `• <b>Wants (Target: 30%)</b>: ${R(wantsSpent)} (${wantsPct}%) ${wantsPct > 35 ? "⚠️ Watch out" : "✅ Healthy"}<br>` +
        `• <b>Savings (Target: 20%)</b>: ${R(savingsEstimate)} (${savingsPct}%) ${savingsPct >= 20 ? "🎉 On track" : "⚡ Room to improve"}<br><br>` +
        `<i>${needsPct > 60 ? "Your essentials take up most of your income. Look for recurring fixed costs you can trim." : "Great discipline! Your needs and wants balance is in great shape."}</i>`;
      break;
    }

    // ── 7. FINANCIAL EMERGENCY MODE ───────────────────────────────────────────
    case "FINANCIAL_EMERGENCY": {
      const days = Math.max(1, bal.days_remaining);
      const survivalDaily = Math.round(bal.balance / days);

      reply = `🚨 <b>Financial Emergency Mode Activated</b><br><br>` +
        `Don't panic — let's triage your situation immediately:<br><br>` +
        `1. <b>Available Cash Reserve</b>: You have <b>${R(bal.balance)}</b> to survive for <b>${days} days</b>.<br>` +
        `2. <b>Survival Daily Burn Rate</b>: Strict limit of <b>${R(survivalDaily)} / day</b>.<br>` +
        `3. <b>Immediate Action Plan:</b><br>` +
        `   • 🛑 <b>Freeze All Wants</b>: Zero spend on Fun, dining out, and online shopping.<br>` +
        `   • ⏸️ <b>Pause Subscriptions</b>: Defer any recurring digital memberships this month.<br>` +
        `   • 🍲 <b>Canteen / Mess Only</b>: Restrict food strictly to home/canteen groceries.<br>` +
        `   • 🚲 <b>Public Transport</b>: Switch from cabs/autos to metro/bus.<br><br>` +
        `Would you like me to lower your discretionary budget limits to help you stay accountable?`;
      break;
    }

    // ── 8. WHAT-IF SIMULATOR ──────────────────────────────────────────────────
    case "WHAT_IF": {
      const res = fin.runWhatIf(userId, parsed.scenario || rawMessage, parsed.amount);
      toolCalls.push({ tool: "run_whatif", args: { scenario: parsed.scenario, amount: parsed.amount }, result: res });

      const items = res.results.map((r: any) => {
        if (r.goal && r.months_saved !== undefined) {
          return `• <b>${r.goal}</b>: Saving ${R(r.new_monthly)}/mo instead of ${R(r.current_monthly)}/mo reaches your target in <b>${r.months_new} months</b> (<b>${r.months_saved} months sooner!</b>).`;
        }
        return `• ${r.note}`;
      });

      reply = `🔮 <b>What-If Financial Simulation:</b><br><br>` +
        `If you adjust savings by <b>+${R(parsed.amount)}</b> per month:<br><br>` +
        items.join("<br><br>") +
        `<br><br><i>Would you like to turn this adjustment into your active goal contribution?</i>`;
      break;
    }

    // ── 9. BUDGET HEALTH ──────────────────────────────────────────────────────
    case "BUDGET_HEALTH": {
      const lines = [
        `You have <b>${R(bal.balance)}</b> remaining for the next <b>${bal.days_remaining} days</b>.<br>`,
      ];
      const hotCats = [];
      for (const [cat, d] of Object.entries(budget)) {
        lines.push(`• <b>${cat}</b>: ${R(d.spent)} / ${R(d.planned)} (${d.pct}%) ${d.pct >= 90 ? "🔥" : ""}`);
        if (d.pct >= 85) hotCats.push(cat);
      }

      const alert = hotCats.length > 0
        ? `<br>⚠️ <b>${hotCats.join(" & ")}</b> is running close to the monthly ceiling.`
        : `<br>✅ All categories look healthy and well within limits!`;

      reply = `📊 <b>Current Budget Health:</b><br><br>` + lines.join("<br>") + alert;
      break;
    }

    // ── 10. GOALS PROGRESS ────────────────────────────────────────────────────
    case "GOALS_QUERY": {
      if (goals.length === 0) {
        reply = `You don't have any active savings goals yet. You can create one from the <b>Goals</b> tab or tell me: <i>"Create goal Laptop target 40000 saving 2000 per month"</i>.`;
      } else {
        const lines = goals.map((g: any) => {
          return `• <b>${g.name}</b>: ${R(g.current)} / ${R(g.target)} (<b>${g.pct}%</b>)<br>` +
            `  Monthly SIP: ${R(g.monthly_contribution)} · ~${g.months_to_goal} months to go`;
        });
        reply = `🎯 <b>Your Active Savings Goals:</b><br><br>` + lines.join("<br><br>");
      }
      break;
    }

    // ── 11. SAVINGS TIPS ──────────────────────────────────────────────────────
    case "SAVINGS_TIPS": {
      const cat = parsed.category || "Food";
      const tips: Record<string, string[]> = {
        Food: [
          "Swap 2 food delivery orders (Swiggy/Zomato) a week for hostel mess or cooking — saves ~₹800/week.",
          "Chai and snacks add up fast: 2 ₹30 chais/day = ₹1,800/month. Pick campus spots with student pricing.",
          "Buy snacks/fruits in bulk from local mandi or Blinkit/Zepto super saver hours.",
        ],
        Transport: [
          "Use Metro smart cards or bus monthly passes instead of autos/cabs for regular commutes — saves 40-60%.",
          "For short trips (< 3km), use Rapido bike taxis or walking instead of full autos.",
          "Carpool with colleagues or classmates if you commute on the same route.",
        ],
        Fun: [
          "Share family plans for Netflix/Spotify with 4 friends to cut costs by 75%.",
          "Book movie tickets on weekday afternoon shows (often 50% cheaper than Friday night).",
        ],
      };

      const catTips = tips[cat] || tips.Food;
      reply = `💡 <b>Smart Savings Tips for ${cat}:</b><br><br>` +
        catTips.map((t) => `• ${t}`).join("<br><br>");
      break;
    }

    // ── 12. CONFIRM & CANCEL ACTIONS ──────────────────────────────────────────
    case "CONFIRM": {
      reply = `✅ To confirm, please tap the <b>Confirm</b> button on the entry card above! That updates your budget, balance, and awards you +10 XP.`;
      break;
    }
    case "CANCEL": {
      reply = `Entry dismissed. No money was deducted and your balance remains untouched. What else can I help with?`;
      break;
    }

    // ── 13. UNKNOWN / GENERAL COACHING ────────────────────────────────────────
    default: {
      reply = `Hey! I'm your Budget Coach. Here are a few things you can ask me right now:<br><br>` +
        `• <b>Log an expense</b>: <i>"I spent ₹150 on biryani"</i> or paste a bank SMS<br>` +
        `• <b>Affordability check</b>: <i>"Can I afford ₹1,500 headphones?"</i><br>` +
        `• <b>Daily spend cap</b>: <i>"How much can I spend today?"</i><br>` +
        `• <b>Weekend budget</b>: <i>"What is my weekend budget?"</i><br>` +
        `• <b>50/30/20 audit</b>: <i>"Analyze my budget health"</i><br>` +
        `• <b>What-if simulation</b>: <i>"What if I save ₹1,000 more?"</i>`;
      break;
    }
  }

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
