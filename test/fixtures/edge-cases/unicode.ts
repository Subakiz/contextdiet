/**
 * Unicode and internationalization edge case fixture.
 * 🌍 🚀 💻 日本語 中文 العربية Español Français
 */

export interface ユーザー {
  名前: string;
  年齢: number;
  通貨: '€' | '¥' | '£' | '$';
}

export function greetUser(user: ユーザー): string {
  const greeting = `こんにちは、${user.名前}さん！ 残高: ${user.通貨}1000`;
  return greeting;
}

export function calculateEmojiCount(input: string): number {
  const chars = Array.from(input);
  return chars.length;
}
