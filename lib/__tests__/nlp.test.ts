import { parseFinancialInput, parseBankSms } from '../nlp';

describe('Financial input parser', () => {
  test('detects income from natural language', () => {
    const result = parseFinancialInput('I received ₹20,000 salary this month');
    expect(result.intent).toBe('LOG_INCOME');
    expect(result.amount).toBe(20000);
    expect(result.description).toContain('salary');
    expect(result.category).toBe('Income');
  });

  test('detects income from bank SMS', () => {
    const sms = 'Your account credited with INR 5,000 on 01-01-2024';
    const parsed = parseBankSms(sms);
    expect(parsed.isSms).toBe(true);
    expect(parsed.type).toBe('income');
    expect(parsed.amount).toBe(5000);
    expect(parsed.bank).toBe('Bank');
    const result = parseFinancialInput(sms);
    expect(result.intent).toBe('LOG_INCOME');
    expect(result.amount).toBe(5000);
  });

  test('detects expense from natural language', () => {
    const result = parseFinancialInput('I spent ₹150 on lunch');
    expect(result.intent).toBe('LOG_EXPENSE');
    expect(result.amount).toBe(150);
    expect(result.category).toBe('Food');
  });
});
