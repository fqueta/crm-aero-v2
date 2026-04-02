import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { BaseApiService } from "@/services/BaseApiService";
import { Loader2 } from "lucide-react";

class ImportApiService extends BaseApiService {
  public async importData(payload: Record<string, unknown>): Promise<{ imported_count?: number }> {
    return this.post('/import', payload);
  }
}
const api = new ImportApiService();

const importFormSchema = z.object({
  url: z.string().url("A URL deve ser válida"),
  method: z.string(),
  headersText: z.string().optional(),
  body: z.string().optional(),
  import_type: z.string().min(1, "Selecione o tipo de importação"),
});

type ImportFormValues = z.infer<typeof importFormSchema>;

export default function ImportData() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [curlText, setCurlText] = useState("");

  const form = useForm<ImportFormValues>({
    resolver: zodResolver(importFormSchema),
    defaultValues: {
      url: "",
      method: "GET",
      headersText: "",
      body: "",
      import_type: "contratos",
    },
  });

  // Função para tentar extrair dados de um comando cURL
  const parseCurl = () => {
    if (!curlText) return;
    
    try {
      let parsedUrl = "";
      let parsedMethod = "GET";
      const parsedHeaders: string[] = [];
      let parsedBody = "";

      // Extrair URL (geralmente entre aspas após o curl ou --location ou --request)
      const urlMatch = curlText.match(/(?:'|")?(http[^'"\s]+)(?:'|")?/);
      if (urlMatch && urlMatch[1]) {
        parsedUrl = urlMatch[1];
      }

      // Extrair Método
      const methodMatch = curlText.match(/(?:-X|--request)\s+(?:'|")?([A-Z]+)(?:'|")?/i);
      if (methodMatch && methodMatch[1]) {
        parsedMethod = methodMatch[1].toUpperCase();
      } else if (curlText.includes("--data") || curlText.includes("-d")) {
        parsedMethod = "POST";
      }

      // Extrair Headers (suporta aspas simples ou duplas)
      const headerRegex = /(?:-H|--header)\s+(['"])(.*?)\1/g;
      let match;
      while ((match = headerRegex.exec(curlText)) !== null) {
        parsedHeaders.push(match[2]);
      }

      // Extrair Body (suporta aspas simples ou duplas, incluindo quebras de linha)
      const bodyRegex = /(?:--data|-d|--data-raw)\s+(['"])([\s\S]*?)\1/g;
      const bodyMatch = bodyRegex.exec(curlText);
      if (bodyMatch && bodyMatch[2]) {
        parsedBody = bodyMatch[2];
      }

      // Atualizar form
      form.setValue("url", parsedUrl);
      form.setValue("method", parsedMethod);
      form.setValue("headersText", parsedHeaders.join("\n"));
      form.setValue("body", parsedBody);
      
      toast({
        title: "cURL processado",
        description: "Os campos foram preenchidos com base no comando fornecido.",
      });
    } catch (e) {
      toast({
        title: "Erro ao processar cURL",
        description: "Não foi possível extrair os dados. Preencha manualmente.",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: ImportFormValues) => {
    setIsLoading(true);
    try {
      // Parse headers from text
      const headers: {key: string, value: string}[] = [];
      if (data.headersText) {
        const lines = data.headersText.split("\n");
        lines.forEach(line => {
          const colonIdx = line.indexOf(":");
          if (colonIdx > 0) {
            headers.push({
              key: line.substring(0, colonIdx).trim(),
              value: line.substring(colonIdx + 1).trim()
            });
          }
        });
      }

      const payload = {
        url: data.url,
        method: data.method,
        headers,
        body: data.body,
        import_type: data.import_type
      };

      const response = await api.importData(payload);
      
      toast({
        title: "Importação concluída!",
        description: `${response.imported_count || 0} registros foram importados.`,
      });
    } catch (err: unknown) {
      const error = err as Error & { body?: { message?: string }; message?: string };
      console.error(error);
      toast({
        title: "Erro na importação",
        description: error.body?.message || error.message || "Verifique o console para mais detalhes.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Importação de Dados</h1>
      <p className="text-muted-foreground">
        Importe dados de sistemas externos (ex: CRM Antigo) através de requisições HTTP/cURL.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Extrair de cURL (Opcional)</CardTitle>
          <CardDescription>Cole um comando cURL aqui para preencher os campos automaticamente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea 
            placeholder="curl --location --request GET 'http://...'" 
            value={curlText}
            onChange={(e) => setCurlText(e.target.value)}
            className="font-mono text-sm"
            rows={4}
          />
          <Button type="button" variant="secondary" onClick={parseCurl}>
            Processar cURL
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuração da Requisição</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="import_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Importação</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="contratos">Contratos (CRM Antigo)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Método HTTP</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="POST">POST</SelectItem>
                          <SelectItem value="PUT">PUT</SelectItem>
                          <SelectItem value="PATCH">PATCH</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL</FormLabel>
                    <FormControl>
                      <Input placeholder="http://localhost:8000/api/v1/conteudo-site" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="headersText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cabeçalhos (Headers)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Content-Type: application/json&#10;Authorization: Bearer seu_token_aqui" 
                        className="font-mono text-sm whitespace-pre-wrap"
                        rows={4}
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>Um por linha no formato "Chave: Valor"</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Corpo (Body / Payload)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={'{\n  "tipo_conteudo": "9"\n}'} 
                        className="font-mono text-sm"
                        rows={6}
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>Geralmente usado para requisições POST/PUT. Deixe em branco se não houver.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Executando Importação...
                  </>
                ) : (
                  "Iniciar Importação"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
