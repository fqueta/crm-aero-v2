import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle, Loader2, Copy as LucideCopy } from "lucide-react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { proposalService, ProposalData } from "@/services/proposalService";

/**
 * ProposalApproved
 * pt-BR: Página pública que exibe o estado "Aguardando Assinatura Digital" somente quando a proposta está aprovada.
 *        Rota: /aluno/matricula/:compositeId/2/aprovado
 * en-US: Public page that shows the "Waiting for Digital Signature" state only when proposal is approved.
 *        Route: /aluno/matricula/:compositeId/2/aprovado
 */
export default function ProposalApproved() {
  const { compositeId } = useParams<{ compositeId: string }>();
  const [clientId, matriculaId] = compositeId
    ? compositeId.split("_")
    : [null, null];
  const [loading, setLoading] = useState(true);
  const [proposal, setProposal] = useState<ProposalData | null>(null);

  useEffect(() => {
    async function load() {
      if (!clientId || !matriculaId) {
        toast.error("Link inválido");
        setLoading(false);
        return;
      }
      try {
        const data = await proposalService.getProposal(clientId, matriculaId);
        const statusAssinatura = (data as any)?.status;
        const step2Done = data?.config?.step2_done;
        console.log(statusAssinatura, step2Done);

        if (
          statusAssinatura !== "aprovado" &&
          statusAssinatura !== "assinado" &&
          !step2Done
        ) {
          toast.error("Proposta não está aprovada.");
          if (data?.redirect) {
            window.location.href = data?.redirect;
          } else {
            window.location.href = `/aluno/matricula/${clientId}_${matriculaId}/1`;
          }
          return;
        }
        setProposal(data);
      } catch (err) {
        toast.error("Erro ao carregar dados da proposta.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [clientId, matriculaId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Proposta não encontrada</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <PublicHeader />
      <div className="flex-1 container mx-auto px-4 py-8 flex flex-col items-center justify-center max-w-2xl">
        <Card className="w-full">
          <CardHeader className="text-center">
            <div className="mx-auto bg-green-100 text-green-600 rounded-full p-3 w-16 h-16 flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <CardTitle className="text-2xl text-green-800">
              Proposta Aguardando Assinatura Digital!
            </CardTitle>
            <CardDescription>
              A proposta foi aprovada e está aguardando assinatura digital.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              Obrigado{" "}
              <strong>
                {proposal.client?.name ||
                  proposal.student_name ||
                  proposal.name ||
                  "Aluno"}
              </strong>
              . Em breve você receberá uma mensagem com o link para assinar a
              proposta.
            </p>

            {(proposal as any)?.processo_assinatura?.signers?.[0]?.sign_url && (
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4 text-left">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 block">
                  Link para Assinatura
                </label>
                <div className="flex gap-2 items-center">
                  <code className="flex-1 bg-white border border-slate-200 rounded px-3 py-2 text-sm text-slate-600 overflow-hidden text-ellipsis whitespace-nowrap h-10 flex items-center">
                    {(proposal as any).processo_assinatura.signers[0].sign_url}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        (proposal as any).processo_assinatura.signers[0]
                          .sign_url,
                      );
                      toast.success("Link copiado!");
                    }}
                    title="Copiar Link"
                  >
                    <LucideCopy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="default"
                    className="h-10 shrink-0 bg-blue-600 hover:bg-blue-700"
                    onClick={() =>
                      window.open(
                        (proposal as any).processo_assinatura.signers[0]
                          .sign_url,
                        "_blank",
                      )
                    }
                    title="Abrir Assinatura"
                  >
                    Assinar
                  </Button>
                </div>
              </div>
            )}

            <div className="pt-4">
              <Button
                variant="outline"
                onClick={() =>
                  window.open("https://aeroclubejf.com.br", "_blank")
                }
              >
                Voltar ao site
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <PublicFooter />
    </div>
  );
}
