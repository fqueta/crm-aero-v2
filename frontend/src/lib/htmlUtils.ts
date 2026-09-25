/**
 * prepareContractHtml
 * pt-BR: Prepara o HTML do contrato para exibição correta no navegador.
 *        Se partes do HTML (como notas de desconto, tabelas ou shortcodes) tiverem
 *        tags codificadas como entidades (&lt;...&gt;), decodifica essas tags para
 *        que o navegador renderize a formatação visual rica (parágrafos, negrito, cores, listas, etc.)
 *        em vez de exibir marcadores brutos como texto puro.
 * en-US: Prepares contract HTML for proper browser rendering. If portions of HTML
 *        contain entity-encoded tags (&lt;...&gt;), decodes them so the browser renders
 *        visual formatting instead of displaying raw tag text.
 */
export function prepareContractHtml(rawHtml?: string | null): string {
  if (!rawHtml) return '';
  let content = rawHtml;

  // Se o conteúdo contiver tags HTML escapadas como entidades (ex: &lt;p...&gt;, &lt;b&gt;, &lt;font...&gt;)
  if (/&lt;(!?--[\s\S]*?--|\/?[a-z][a-z0-9]*(?:[\s/][^<>]*)?)&gt;/i.test(content) || (content.includes('&lt;') && content.includes('&gt;'))) {
    // Converte tags escapadas &lt;tag...&gt; em <tag...>
    content = content.replace(/&lt;(!?--[\s\S]*?--|\/?[a-z][a-z0-9]*(?:[\s/][^<>]*)?)&gt;/gi, (_match, inner) => {
      // Decodifica entidades comuns de atributos dentro da tag
      const decodedInner = inner
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&');
      return `<${decodedInner}>`;
    });
  }

  return content;
}
