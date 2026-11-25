import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Store } from 'lucide-react';
import { useLayoutSettings } from '@/hooks/useLayoutSettings';

export default function AuthBrandHeader({ subtitle }: { subtitle?: string }) {
  const { settings } = useLayoutSettings();
  const [logoFailed, setLogoFailed] = useState(false);
  const nome = settings.empresa_nome?.trim() || 'nossa loja';
  const logo = settings.empresa_logo_url?.trim();
  return (
    <div className="flex flex-col items-center text-center space-y-2">
      <Link to="/" aria-label={`Voltar ao cardápio de ${nome}`} className="block">
        {logo && !logoFailed ? (
          <img src={logo} alt={nome} onError={() => setLogoFailed(true)} className="h-16 max-w-[180px] object-contain" />
        ) : (
          <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center"><Store className="h-8 w-8" /></div>
        )}
      </Link>
      <p className="text-base font-bold">Bem-vindo ao {nome}</p>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><ArrowLeft className="h-3 w-3" />Voltar ao cardápio</Link>
    </div>
  );
}
