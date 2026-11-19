import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { ACC, BY_ID, INK, MUTED, PLACES, type Place } from '../lib/data';
import { getVisits } from '../lib/store';
import { useNav } from '../lib/nav';
import { Fiche } from '../components/Fiche';

/* Fond de carte : OpenStreetMap (sans clé). Si aucune tuile ne se charge, bascule sur le Plan IGN. */
const TILES = {
  main: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' },
  backup: { url: 'https://data.geopf.fr/wmts?REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}', attr: '&copy; <a href="https://www.ign.fr/">IGN</a>' }
};
const METRO: L.LatLngBoundsLiteral = [[41.2, -5.3], [51.3, 9.8]];
const pinStyle = (p: Place, sel: boolean): L.CircleMarkerOptions => {
  if (sel) return { radius: 11, color: INK, weight: 3, fillColor: ACC, fillOpacity: 1 };
  return getVisits()[p.id]
    ? { radius: 7, color: '#fff', weight: 2, fillColor: ACC, fillOpacity: 1 }
    : { radius: 5, color: MUTED, weight: 2, fillColor: '#fff', fillOpacity: 1 };
};

export function Carte() {
  const { ui, setUi, openDetail } = useNav();
  const visits = getVisits();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null), layer = useRef<L.LayerGroup | null>(null), markers = useRef<Record<string, L.CircleMarker>>({});
  const pinRef = useRef(ui.pin); pinRef.current = ui.pin;
  const doms = useMemo(() => {
    const m: Record<string, { name: string; pts: [number, number][] }> = {};
    PLACES.forEach(p => { if (p.dept.length === 3) (m[p.dept] = m[p.dept] || { name: p.deptNom, pts: [] }).pts.push([p.lat, p.lng]); });
    return m;
  }, []);
  const fitMetro = () => map.current?.fitBounds(METRO, { paddingTopLeft: [8, 118], paddingBottomRight: [8, 150], maxZoom: 7 });

  /* création unique de la carte */
  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: false, renderer: L.canvas({ tolerance: 10 }), zoomSnap: .5, minZoom: 3, maxZoom: 18 });
    map.current = m;
    L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(m);
    const mk = (t: { url: string; attr: string }) => L.tileLayer(t.url, { attribution: t.attr, maxZoom: 19 });
    const main = mk(TILES.main).addTo(m);
    let ok = false, bad = 0, swapped = false;
    main.on('tileload', () => { ok = true; });
    main.on('tileerror', () => {
      if (ok || swapped || map.current !== m || ++bad < 3) return;   // rien n'a chargé : on change de source
      swapped = true; m.removeLayer(main); mk(TILES.backup).addTo(m);
    });
    layer.current = L.layerGroup().addTo(m);
    fitMetro();
    if (pinRef.current) { const p = BY_ID[pinRef.current]; m.setView([p.lat, p.lng], 9); }
    requestAnimationFrame(() => map.current?.invalidateSize());
    return () => { m.remove(); map.current = null; layer.current = null; markers.current = {}; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* repères : refaits quand le filtre ou les visites changent */
  useEffect(() => {
    const lg = layer.current; if (!lg) return;
    lg.clearLayers(); markers.current = {};
    const keep = (p: Place) => ui.filter === 'all' ? true : ui.filter === 'seen' ? !!visits[p.id] : !visits[p.id];
    if (ui.pin && !keep(BY_ID[ui.pin])) { setUi({ pin: null }); return; }
    const shown = PLACES.filter(keep).sort((a, b) => (visits[a.id] ? 1 : 0) - (visits[b.id] ? 1 : 0));
    for (const p of shown) {
      const m = L.circleMarker([p.lat, p.lng], pinStyle(p, p.id === ui.pin));
      m.on('click', () => setUi({ pin: p.id }));
      m.addTo(lg); markers.current[p.id] = m;
    }
    if (ui.pin && markers.current[ui.pin]) markers.current[ui.pin].bringToFront();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.filter, ui.pin, visits]);

  const pin = ui.pin ? BY_ID[ui.pin] : null;
  return (
    <>
      <div id="map" ref={el} />
      <div className="map-top">
        <div className="mchips" id="m-filters">
          {([['all', 'Toutes'], ['seen', 'Vues'], ['todo', 'Restantes']] as const).map(x =>
            <button key={x[0]} type="button" data-f={x[0]} className={ui.filter === x[0] ? 'on' : ''} onClick={() => setUi({ filter: x[0] })}>{x[1]}</button>)}
        </div>
        <div className="mchips sm" id="m-terr">
          <button type="button" data-t="fr" onClick={fitMetro}>France</button>
          {Object.keys(doms).sort().map(k =>
            <button key={k} type="button" data-t={k} onClick={() => map.current?.fitBounds(doms[k].pts, { padding: [40, 40], maxZoom: 11 })}>{doms[k].name}</button>)}
        </div>
      </div>
      <div className="map-zoom">
        <button type="button" id="z-in" aria-label="Zoom avant" onClick={() => map.current?.zoomIn()}>+</button>
        <button type="button" id="z-out" aria-label="Zoom arrière" onClick={() => map.current?.zoomOut()}>−</button>
      </div>
      <div className="map-panel" id="m-panel">
        {pin ? <Fiche p={pin} onOpen={openDetail} /> : <div className="hint">Touchez un repère pour ouvrir sa fiche.</div>}
        <div className="legend"><span><i className="on" />Visitée</span><span><i />À voir</span></div>
      </div>
    </>
  );
}
