/* Réduit une image à 1000 px max, JPEG 0,7 (data URL). */
export function shrink(file: File | undefined | null): Promise<string | null> {
  return new Promise(resolve => {
    if (!file) { resolve(null); return; }
    const fail = () => { alert('Impossible de lire cette image.'); resolve(null); };
    const img = new Image(), rd = new FileReader();
    rd.onerror = fail; img.onerror = fail;
    rd.onload = () => {
      img.onload = () => {
        const s = Math.min(1, 1000 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', .7));
      };
      img.src = rd.result as string;
    };
    rd.readAsDataURL(file);
  });
}
