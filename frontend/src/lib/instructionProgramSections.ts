export interface ParsedSubsection {
  anchorId: string;
  title: string;
  level: 2 | 3;
}

export interface ParsedSection {
  id: string;
  num: string;
  title: string;
  html: string;
  plainText: string;
  hasPg: boolean;
  subs: ParsedSubsection[];
}

export function parseProgramSections(
  rawHtml: string | null | undefined,
  fallbackTitle = 'Conteúdo Principal'
): ParsedSection[] {
  const html = (rawHtml || '').trim();
  if (!html) {
    return [
      {
        id: 'sec-0',
        num: '1',
        title: fallbackTitle,
        html: '',
        plainText: '',
        hasPg: false,
        subs: [],
      },
    ];
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div id="__root">${html}</div>`, 'text/html');
    const root = doc.getElementById('__root');
    if (!root) return [];

    const directSections = Array.from(root.children).filter(
      (el) => el.tagName.toLowerCase() === 'section' || el.tagName.toLowerCase() === 'article'
    );

    const blocks: Element[] = [];
    if (directSections.length > 0) {
      blocks.push(...directSections);
    } else {
      const h1Count = root.querySelectorAll('h1').length;
      if (h1Count > 1) {
        let wrapper = doc.createElement('section');
        Array.from(root.childNodes).forEach((node) => {
          if (
            node.nodeType === Node.ELEMENT_NODE &&
            (node as Element).tagName.toLowerCase() === 'h1' &&
            wrapper.childNodes.length > 0
          ) {
            blocks.push(wrapper);
            wrapper = doc.createElement('section');
          }
          wrapper.appendChild(node.cloneNode(true));
        });
        if (wrapper.childNodes.length > 0) blocks.push(wrapper);
      } else {
        blocks.push(root);
      }
    }

    return blocks.map((block, idx) => {
      const secId = `sec-${idx}`;
      const firstH = block.querySelector('h1, h2, h3');
      const rawHeading = (firstH?.textContent || '').replace(/\s+/g, ' ').trim();

      let num = String(idx + 1);
      let title = rawHeading || `Seção ${idx + 1}`;

      const numMatch = title.match(/^(\d+(?:\.\d+)?)\s*[.\-–—:]\s*(.+)$/);
      if (numMatch) {
        num = numMatch[1];
        title = numMatch[2].trim();
      } else if (idx === 0 && /folha de rosto|preliminar|sum[áa]rio|controle de revis/i.test(title)) {
        num = 'P';
        if (/folha de rosto/i.test(title)) title = 'Preliminares';
      } else if (/^complemento/i.test(title)) {
        num = 'C';
      } else if (/^anexo/i.test(title)) {
        num = 'A';
      }

      const subs: ParsedSubsection[] = [];
      const seenHeadings = new Set<string>();
      const headingEls = Array.from(block.querySelectorAll('h1, h2, h3'));
      headingEls.forEach((hEl, hIdx) => {
        const text = (hEl.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text) return;
        const anchorId = `${secId}-h-${hIdx}`;
        hEl.setAttribute('id', anchorId);

        const tag = hEl.tagName.toLowerCase();
        const key = `${tag}:${text.toLowerCase()}`;
        if ((tag === 'h2' || tag === 'h3') && !seenHeadings.has(key) && subs.length < 35) {
          seenHeadings.add(key);
          subs.push({
            anchorId,
            title: text,
            level: tag === 'h2' ? 2 : 3,
          });
        }
      });

      const plainText = (block.textContent || '').replace(/\s+/g, ' ').trim();
      const hasPg = Boolean(block.querySelector('.pg'));

      return {
        id: secId,
        num,
        title,
        html: block.innerHTML,
        plainText,
        hasPg,
        subs,
      };
    });
  } catch {
    return [
      {
        id: 'sec-0',
        num: '1',
        title: fallbackTitle,
        html,
        plainText: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
        hasPg: html.includes('class="pg"'),
        subs: [],
      },
    ];
  }
}

export function rebuildProgramHtml(sections: Pick<ParsedSection, 'html'>[]): string {
  return sections
    .map((s) => `<section>\n${(s.html || '').trim()}\n</section>`)
    .join('\n\n');
}
