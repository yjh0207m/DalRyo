import React, {createContext, useContext, useMemo} from 'react';
import {createTranslator, type Translate} from './translate';

const DialectContext = createContext<Translate>(createTranslator('std'));

export function DialectProvider({dialect, children}: React.PropsWithChildren<{dialect: unknown}>) {
  const t = useMemo(() => createTranslator(dialect), [dialect]);
  return <DialectContext.Provider value={t}>{children}</DialectContext.Provider>;
}

export function useDialect() {
  return useContext(DialectContext);
}
