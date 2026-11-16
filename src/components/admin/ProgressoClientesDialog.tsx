import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { FidelidadeRegra } from "@/services/fidelidadeService";

type Linha = {
  id: string;
  nome: string;
  telefone: string;
  regraNome: string;
  contagem: number;
  meta: number;
  ultima: string | null;
  primeira: string | null;
  premios: number;
};

const fetchAll = async (table: string, cols: string) => {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await (supabase.from(table as any) as any).select(cols).range(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
};

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

export function ProgressoClientesDialog({ open, onOpenChange, regras }: { open: boolean; onOpenChange: (o: boolean) => void; regras: FidelidadeRegra[] }) {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const [prog, hist] = await Promise.all([
          fetchAll("fidelidade_progresso", "id, telefone_cliente, nome_cliente, regra_id, contagem_pizzas, eventos, ultima_atualizacao, criado_em"),
          fetchAll("fidelidade_historico", "telefone_cliente, regra_id, premio_concedido"),
        ]);
        const premios = new Map<string, number>();
        hist.forEach((h: any) => {
          if (!h.premio_concedido) return;
          const k = `${h.telefone_cliente}|${h.regra_id}`;
          premios.set(k, (premios.get(k) || 0) + 1);
        });
        setLinhas(
          prog.map((p: any) => {
            const regra = regras.find((r) => r.id === p.regra_id);
            const ev = Array.isArray(p.eventos) ? p.eventos : [];
            const soma = ev.reduce((s: number, e: any) => s + (Number(e?.qtd) || 0), 0);
            return {
              id: p.id,
              nome: p.nome_cliente || "—",
              telefone: p.telefone_cliente,
              regraNome: regra?.nome || "Regra removida",
              contagem: soma || Number(p.contagem_pizzas || 0),
              meta: regra?.quantidade_necessaria || 0,
              ultima: p.ultima_atualizacao,
              primeira: p.criado_em,
              premios: premios.get(`${p.telefone_cliente}|${p.regra_id}`) || 0,
            };
          }).sort((a, b) => (b.meta ? b.contagem / b.meta : 0) - (a.meta ? a.contagem / a.meta : 0))
        );
      } catch (e) {
        console.error("Erro ao carregar progresso de fidelidade:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, regras]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return linhas;
    return linhas.filter((l) => l.nome.toLowerCase().includes(q) || l.telefone.includes(q.replace(/\D/g, "") || q));
  }, [linhas, busca]);

  const clientes = new Set(linhas.map((l) => l.telefone)).size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Progresso dos clientes</DialogTitle>
          <DialogDescription>
            {clientes} cliente(s) participando · {linhas.reduce((s, l) => s + l.premios, 0)} prêmio(s) já concedido(s)
          </DialogDescription>
        </DialogHeader>
        <Input placeholder="Buscar por nome ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} />
        {loading ? (
          <p className="p-6 text-center text-muted-foreground">Carregando...</p>
        ) : filtradas.length === 0 ? (
          <p className="p-6 text-center text-muted-foreground">Nenhum cliente participando ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Regra</TableHead>
                <TableHead className="min-w-[160px]">Progresso</TableHead>
                <TableHead>Faltam</TableHead>
                <TableHead>Prêmios</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Última compra</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <div className="font-medium">{l.nome}</div>
                    <a className="text-xs text-primary underline" href={`https://wa.me/${l.telefone.startsWith("55") ? l.telefone : "55" + l.telefone}`} target="_blank" rel="noreferrer">{l.telefone}</a>
                  </TableCell>
                  <TableCell>{l.regraNome}</TableCell>
                  <TableCell>
                    <div className="text-sm mb-1">{l.contagem} / {l.meta || "—"}</div>
                    <Progress value={l.meta ? Math.min(100, (l.contagem / l.meta) * 100) : 0} />
                  </TableCell>
                  <TableCell>{l.meta ? Math.max(0, l.meta - l.contagem) : "—"}</TableCell>
                  <TableCell>{l.premios}</TableCell>
                  <TableCell>{fmt(l.primeira)}</TableCell>
                  <TableCell>{fmt(l.ultima)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
