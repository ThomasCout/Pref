import { useRef, type ComponentProps, type ReactNode } from 'react';
import { Button, Card, Input, TextArea } from '@heroui/react';

type Kind = 'main' | 'alt' | 'warn' | 'light' | 'ghost';
const KIND: Record<Kind, { variant: 'primary' | 'outline' | 'danger-soft' | 'secondary' | 'ghost'; cls: string }> = {
  main: { variant: 'primary', cls: '' },
  alt: { variant: 'outline', cls: 'bg-white text-[#0E1726]' },
  warn: { variant: 'outline', cls: 'bg-white text-[#B42318] border-[#F1C7C3]' },
  light: { variant: 'secondary', cls: 'bg-white text-[#0E1726]' },
  ghost: { variant: 'ghost', cls: 'bg-white/12 text-white' }
};
type BtnProps = Omit<ComponentProps<typeof Button>, 'variant' | 'onClick'> & { kind?: Kind; onClick?: () => void };
/* Bouton HeroUI pleine largeur, aux couleurs Atlas */
export function Btn({ kind = 'main', className = '', onClick, children, ...rest }: BtnProps) {
  const k = KIND[kind];
  return <Button fullWidth size="lg" variant={k.variant} onPress={onClick} className={`min-h-[50px] rounded-[14px] font-semibold ${k.cls} ${className}`} {...rest}>{children}</Button>;
}
/* Bouton qui ouvre le sélecteur de fichier (galerie / appareil photo) */
export function FileBtn({ kind = 'alt', accept = 'image/*', capture, onFile, children, className = '', id }:
  { kind?: Kind; accept?: string; capture?: 'environment'; onFile: (f: File | undefined) => void; children: ReactNode; className?: string; id?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <Btn kind={kind} className={className} onClick={() => ref.current?.click()}>{children}</Btn>
      <input ref={ref} id={id} type="file" accept={accept} capture={capture} hidden
        onChange={e => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
    </>
  );
}
export const Field = (p: ComponentProps<typeof Input>) => <Input fullWidth {...p} className={`h-12 rounded-[14px] text-[15px] px-3.5 ${p.className || ''}`} />;
export const Note = (p: ComponentProps<typeof TextArea>) => <TextArea fullWidth {...p} className={`rounded-[14px] text-base ${p.className || ''}`} />;
/* Carte HeroUI */
export function Panel({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <Card className={`panel ${className}`} style={style}><Card.Content>{children}</Card.Content></Card>;
}
export const Empty = ({ title, text, children }: { title: string; text?: string; children?: ReactNode }) => (
  <Panel className="empty"><b>{title}</b>{text && <p className="mut">{text}</p>}{children}</Panel>
);
