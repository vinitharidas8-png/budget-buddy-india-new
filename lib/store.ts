import { Profile, Transaction, Budget, Goal } from "./types";

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export interface StoreData {
  profiles: Record<string, Profile>;
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  nextId: number;
}

declare global {
   
  var __BUDGET_STORE__: StoreData | undefined;
}

export function initStore(): StoreData {
  const period = currentPeriod();
  const store: StoreData = {
    profiles: {
      default: {
        user_id: "default",
        display_name: "Vinit",
        monthly_income: 25000,
        income_day: 1,
        min_balance: 500,
        xp: 320,
        level: 4,
        streak: 6,
        quest_count: 1,
        quest_done: false,
      },
    },
    transactions: [
      {
        id: 1,
        user_id: "default",
        type: "income",
        amount: 25000,
        description: "Monthly salary",
        category: "Income",
        transaction_date: `${period}-01`,
        source: "manual",
        created_at: new Date().toISOString(),
      },
      {
        id: 2,
        user_id: "default",
        type: "expense",
        amount: 150,
        description: "Lunch at canteen",
        category: "Food",
        transaction_date: `${period}-02`,
        source: "manual",
        created_at: new Date().toISOString(),
      },
      {
        id: 3,
        user_id: "default",
        type: "expense",
        amount: 80,
        description: "Bus pass",
        category: "Transport",
        transaction_date: `${period}-03`,
        source: "manual",
        created_at: new Date().toISOString(),
      },
      {
        id: 4,
        user_id: "default",
        type: "expense",
        amount: 299,
        description: "Netflix subscription",
        category: "Fun",
        transaction_date: `${period}-04`,
        source: "manual",
        created_at: new Date().toISOString(),
      },
      {
        id: 5,
        user_id: "default",
        type: "expense",
        amount: 500,
        description: "Grocery shopping",
        category: "Food",
        transaction_date: `${period}-05`,
        source: "manual",
        created_at: new Date().toISOString(),
      },
      {
        id: 6,
        user_id: "default",
        type: "expense",
        amount: 120,
        description: "Auto to office",
        category: "Transport",
        transaction_date: `${period}-06`,
        source: "manual",
        created_at: new Date().toISOString(),
      },
      {
        id: 7,
        user_id: "default",
        type: "expense",
        amount: 400,
        description: "Movie tickets",
        category: "Fun",
        transaction_date: `${period}-07`,
        source: "manual",
        created_at: new Date().toISOString(),
      },
      {
        id: 8,
        user_id: "default",
        type: "expense",
        amount: 200,
        description: "Electricity bill",
        category: "Housing",
        transaction_date: `${period}-08`,
        source: "manual",
        created_at: new Date().toISOString(),
      },
      {
        id: 9,
        user_id: "default",
        type: "expense",
        amount: 60,
        description: "Chai and snacks",
        category: "Food",
        transaction_date: `${period}-09`,
        source: "manual",
        created_at: new Date().toISOString(),
      },
    ],
    budgets: [
      { id: 1, user_id: "default", category: "Food", planned_amount: 3000, period },
      { id: 2, user_id: "default", category: "Transport", planned_amount: 1000, period },
      { id: 3, user_id: "default", category: "Fun", planned_amount: 1000, period },
      { id: 4, user_id: "default", category: "Other", planned_amount: 800, period },
    ],
    goals: [
      {
        id: 1,
        user_id: "default",
        name: "Laptop",
        target_amount: 40000,
        current_amount: 8000,
        monthly_contribution: 2000,
        status: "active",
      },
    ],
    nextId: 100,
  };
  return store;
}

export function getStore(): StoreData {
  if (!global.__BUDGET_STORE__) {
    global.__BUDGET_STORE__ = initStore();
  }
  return global.__BUDGET_STORE__;
}

export function syncStore(clientStore: StoreData) {
  if (clientStore && clientStore.profiles) {
    global.__BUDGET_STORE__ = clientStore;
  }
  return getStore();
}

export function getProfile(userId: string): Profile {
  const store = getStore();
  if (!store.profiles[userId]) {
    store.profiles[userId] = {
      user_id: userId,
      display_name: "Vinit",
      monthly_income: 25000,
      income_day: 1,
      min_balance: 500,
      xp: 0,
      level: 1,
      streak: 1,
      quest_count: 0,
      quest_done: false,
    };
  }
  return store.profiles[userId];
}
