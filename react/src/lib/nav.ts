import { createContext, useContext } from 'react';
import type { Grade } from './data';

export type Tab = 'registre' | 'carte' | 'dossier' | 'reglages';
export type Route = { k: 'detail'; id: string } | { k: 'album' } | { k: 'amis' } | { k: 'ami'; uid: string };
export interface Ui { filter: 'all' | 'seen' | 'todo'; sort: 'date' | 'alpha' | 'dept'; q: string; pin: string | null; albumAsc: boolean }
export interface Draft { id: string | null; date: string; note: string; photo: string | null }
export interface Nav {
  tab: Tab; setTab: (t: Tab) => void;
  push: (r: Route) => void; pop: () => void;
  ui: Ui; setUi: (p: Partial<Ui>) => void;
  openFlash: (id: string) => void;
  openForm: (id: string | null, pre?: Partial<Draft>) => void;
  commit: (d: Draft) => void;
  startRetro: () => void;
  openDetail: (id: string) => void;
  showPromo: (g: Grade) => void;
  setSubTitle: (t: string) => void;
}
export const NavCtx = createContext<Nav>(null as unknown as Nav);
export const useNav = () => useContext(NavCtx);
