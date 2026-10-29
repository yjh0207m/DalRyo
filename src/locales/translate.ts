import standard from './ko-std.json';
import gyeong from './ko-gyeong.json';
import jeon from './ko-jeon.json';
import chung from './ko-chung.json';
import jeju from './ko-jeju.json';

export type MessageKey = keyof typeof standard;
export type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;
export const messages = {std: standard, gyeong, jeon, chung, jeju};

export function createTranslator(dialect: unknown): Translate {
  const catalog =
    typeof dialect === 'string' && Object.prototype.hasOwnProperty.call(messages, dialect)
      ? messages[dialect as keyof typeof messages]
      : standard;
  return (key, values = {}) =>
    (catalog[key] || standard[key]).replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
      values[name] === undefined ? match : String(values[name]),
    );
}
