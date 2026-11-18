const MONTHS = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
export const pad = (n: number) => String(n).padStart(2, '0');
export const isoOf = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
/* date locale, pas UTC : évite le décalage d'un jour après minuit */
export const today = () => isoOf(new Date());
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const fr = (iso: string) => { const [y, m, d] = iso.split('-'); return d + '/' + m + '/' + y; };
export const shortDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return (+d) + ' ' + MONTHS[+m - 1] + (+y !== new Date().getFullYear() ? ' ' + y : '');
};
export const longDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};
export const plural = (n: number, s: string, p?: string) => n + ' ' + (n > 1 ? (p || s + 's') : s);
export const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
export const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
