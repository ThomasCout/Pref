import raw from '../data/places.json';

export interface Place {
  id: string; type: 'prefecture' | 'sous_pref'; nom: string; codeInsee: string; dept: string; deptNom: string;
  region: string; arrondissement: string; adresse: string; codePostal: string; lat: number; lng: number; recherche: string;
}
export const PLACES = raw as Place[];
export const TOTAL = PLACES.length;
export const BY_ID: Record<string, Place> = Object.fromEntries(PLACES.map(p => [p.id, p]));
export const BY_DEPT: Record<string, Place[]> = {};
PLACES.forEach(p => (BY_DEPT[p.dept] = BY_DEPT[p.dept] || []).push(p));
export const PREFS = PLACES.filter(p => p.type === 'prefecture');
export const SOUS = PLACES.filter(p => p.type === 'sous_pref');
export type Grade = readonly [number, string, number];
export const GRADES: Grade[] = [
  [1, 'Adjoint administratif', 1], [2, 'Secrétaire administratif', 5], [3, "Attaché d'administration", 15],
  [4, 'Attaché principal', 30], [5, 'Chef de bureau', 50], [6, 'Secrétaire général de sous-préfecture', 80],
  [7, "Sous-préfet d'arrondissement", 120], [8, 'Sous-préfet hors classe', 170], [9, 'Préfet de département', 230],
  [10, 'Préfet de région', 300], [11, 'Préfet de police de Paris', TOTAL]
];
export const gradeOf = (n: number): Grade | null => { let g: Grade | null = null; for (const x of GRADES) if (n >= x[2]) g = x; return g; };
export const nextGrade = (n: number): Grade | null => GRADES.find(x => n < x[2]) || null;
export const typeLabel = (p: Place) => p.type === 'prefecture' ? 'Préfecture' : 'Sous-préfecture';
export const ACC = '#1B3FD6', INK = '#0E1726', MUTED = '#6B7691', ACC_LIGHT = '#98A9ED';
