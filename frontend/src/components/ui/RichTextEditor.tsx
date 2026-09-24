import React, { useEffect, useRef, useState } from 'react';
import type { ContractShortcode } from '@/lib/contractShortcodes';

/**
 * RichTextEditor
 * pt-BR: Editor WYSIWYG simples baseado em `contenteditable`, com toolbar básica
 * e (opcional) autocomplete de shortcodes: digitar `{` filtra o catálogo e
 * `Shift+Espaço` abre a paleta. `Enter`/`Tab` insere, `Escape` fecha.
 * en-US: Simple WYSIWYG editor using `contenteditable`, with a basic toolbar
 * and (optional) shortcode autocomplete: typing `{` filters the catalog and
 * `Shift+Space` opens the palette. `Enter`/`Tab` inserts, `Escape` closes.
 */
export interface RichTextEditorProps {
  /** Valor HTML atual do editor */
  value: string;
  /** Dispara quando o conteúdo muda; retorna HTML */
  onChange: (html: string) => void;
  /** Placeholder exibido quando vazio */
  placeholder?: string;
  /** Desabilita edição quando true */
  disabled?: boolean;
  /** Ativa as dicas de shortcode (`{` + Ctrl+Espaço) */
  enableShortcodeHints?: boolean;
  /** Catálogo exibido nas dicas (default: vazio = dicas desativadas) */
  shortcodes?: ContractShortcode[];
}

/**
 * execCmd
 * pt-BR: Executa comando de formatação do documento.
 * en-US: Executes document formatting command.
 */
function execCmd(command: string, value?: string) {
  document.execCommand(command, false, value);
}

interface CaretPos {
  x: number;
  y: number;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder,
  disabled,
  enableShortcodeHints,
  shortcodes,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [hintsOpen, setHintsOpen] = useState(false);
  const [hintsFilter, setHintsFilter] = useState('');
  const [hintsIndex, setHintsIndex] = useState(0);
  const [hintsPos, setHintsPos] = useState<CaretPos>({ x: 0, y: 0 });

  const hintsEnabled = !!enableShortcodeHints && Array.isArray(shortcodes) && shortcodes.length > 0 && !disabled;

  /**
   * useEffect sync
   * pt-BR: Sincroniza valor externo com o conteúdo do editor.
   * en-US: Sync external value with editor content.
   */
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || '')) {
      ref.current.innerHTML = value || '';
    }
  }, [value]);

  /**
   * detectTrigger
   * pt-BR: Detecta `{parcial` antes do caret (só em nó de texto) e a posição do caret.
   * en-US: Detects `{partial` before the caret (text nodes only) and the caret position.
   */
  const detectTrigger = (): { partial: string; pos: CaretPos } | null => {
    const ed = ref.current;
    const sel = window.getSelection();
    if (!ed || !sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;
    const node = sel.anchorNode;
    if (!node || node.nodeType !== Node.TEXT_NODE || !ed.contains(node)) return null;
    const before = (node.nodeValue || '').slice(0, sel.anchorOffset);
    const m = /\{([A-Za-z0-9_]*)$/.exec(before);
    if (!m) return null;
    try {
      const range = sel.getRangeAt(0).cloneRange();
      range.collapse(true);
      const rect = range.getBoundingClientRect();
      const wrap = wrapRef.current?.getBoundingClientRect();
      // Popover é absolute dentro do wrapper relative: coordenadas relativas ao wrapper.
      return {
        partial: m[1],
        pos: {
          x: wrap ? rect.left - wrap.left : 8,
          y: wrap ? rect.bottom - wrap.top : 24,
        },
      };
    } catch {
      return { partial: m[1], pos: { x: 8, y: 24 } };
    }
  };

  const filteredHints = React.useMemo(() => {
    if (!hintsEnabled) return [];
    const f = hintsFilter.toLowerCase();
    // Sem limite de itens: a paleta tem scroll (max-h-56) e o filtro refina.
    if (!f) return shortcodes!;
    return shortcodes!.filter((s) => s.tag.toLowerCase().includes(f));
  }, [hintsEnabled, hintsFilter, shortcodes]);

  React.useEffect(() => {
    setHintsIndex(0);
  }, [hintsFilter, hintsOpen]);

  const closeHints = () => setHintsOpen(false);

  /**
   * insertShortcode
   * pt-BR: Substitui `{parcial` pela tag completa na posição do caret.
   * en-US: Replaces `{partial` with the full tag at the caret position.
   */
  const insertShortcode = (tag: string) => {
    const ed = ref.current;
    if (!ed) return;
    ed.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const node = sel.anchorNode;
      if (node && node.nodeType === Node.TEXT_NODE && ed.contains(node)) {
        const before = (node.nodeValue || '').slice(0, sel.anchorOffset);
        const m = /\{([A-Za-z0-9_]*)$/.exec(before);
        if (m) {
          const r = document.createRange();
          r.setStart(node, sel.anchorOffset - m[0].length);
          r.setEnd(node, sel.anchorOffset);
          sel.removeAllRanges();
          sel.addRange(r);
        }
      }
    }
    document.execCommand('insertText', false, `{${tag}}`);
    closeHints();
    // Garante o onChange mesmo se o navegador não disparar `input`.
    window.setTimeout(() => {
      onChangeRef.current(ref.current?.innerHTML || '');
    }, 0);
  };

  /**
   * handleInput
   * pt-BR: Emite HTML atualizado e atualiza/abre/fecha as dicas de shortcode.
   * en-US: Emits updated HTML and updates/opens/closes the shortcode hints.
   */
  const handleInput = () => {
    const html = ref.current?.innerHTML || '';
    onChange(html);
    if (!hintsEnabled) return;
    const hit = detectTrigger();
    if (hit) {
      setHintsFilter(hit.partial);
      setHintsPos(hit.pos);
      setHintsOpen(true);
    } else {
      closeHints();
    }
  };

  /**
   * handleKeyDown
   * pt-BR: Navegação das dicas (setas/Enter/Tab/Escape) e paleta via Shift+Espaço
   *        (Ctrl+Espaço é da consulta rápida global). `Shift+Espaço` não insere
   *        espaço quando a paleta abre (preventDefault).
   * en-US: Hint navigation (arrows/Enter/Tab/Escape) and palette via Shift+Space
   *        (Ctrl+Space belongs to the global quick search).
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!hintsEnabled) return;
    if (e.shiftKey && e.code === 'Space' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const hit = detectTrigger();
      setHintsFilter(hit?.partial ?? '');
      if (hit) setHintsPos(hit.pos);
      setHintsOpen(true);
      return;
    }
    if (!hintsOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHintsIndex((i) => (filteredHints.length ? (i + 1) % filteredHints.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHintsIndex((i) => (filteredHints.length ? (i - 1 + filteredHints.length) % filteredHints.length : 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      const item = filteredHints[hintsIndex];
      if (item) {
        e.preventDefault();
        insertShortcode(item.tag);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeHints();
    }
  };

  return (
    <div className="border rounded-md">
      {/* Toolbar */}
      <div className="flex gap-2 p-2 border-b bg-muted">
        <button type="button" className="text-sm px-2 py-1 rounded hover:bg-muted-foreground/10" onClick={() => execCmd('bold')} disabled={disabled}>B</button>
        <button type="button" className="text-sm px-2 py-1 rounded hover:bg-muted-foreground/10" onClick={() => execCmd('italic')} disabled={disabled}>I</button>
        <button type="button" className="text-sm px-2 py-1 rounded hover:bg-muted-foreground/10" onClick={() => execCmd('underline')} disabled={disabled}>U</button>
        <button type="button" className="text-sm px-2 py-1 rounded hover:bg-muted-foreground/10" onClick={() => execCmd('insertUnorderedList')} disabled={disabled}>• Lista</button>
        <button type="button" className="text-sm px-2 py-1 rounded hover:bg-muted-foreground/10" onClick={() => execCmd('insertOrderedList')} disabled={disabled}>1. Lista</button>
        <button type="button" className="text-sm px-2 py-1 rounded hover:bg-muted-foreground/10" onClick={() => execCmd('formatBlock', 'p')} disabled={disabled}>Parágrafo</button>
        {hintsEnabled && (
          <span className="ml-auto self-center text-[10px] text-muted-foreground hidden sm:block" title="Digite { para filtrar shortcodes">
            {'{} Shift+Espaço'}
          </span>
        )}
      </div>
      {/* Editable area */}
      <div className="relative" ref={wrapRef}>
        <div
          ref={ref}
          contentEditable={!disabled}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          className="min-h-[120px] p-3 text-sm"
          data-placeholder={placeholder || ''}
          suppressContentEditableWarning
        />
        {hintsEnabled && hintsOpen && filteredHints.length > 0 && (
          <div
            className="absolute z-50 w-64 max-h-56 overflow-y-auto rounded-md border bg-popover shadow-lg"
            style={{ left: Math.max(0, hintsPos.x), top: hintsPos.y + 4 }}
            role="listbox"
            aria-label="Shortcodes disponíveis"
          >
            {filteredHints.map((s, i) => (
              <button
                key={s.tag}
                type="button"
                role="option"
                aria-selected={i === hintsIndex}
                className={`flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs ${i === hintsIndex ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}
                onMouseDown={(e) => {
                  // Evita perder a seleção do editor antes de inserir.
                  e.preventDefault();
                  insertShortcode(s.tag);
                }}
                onMouseEnter={() => setHintsIndex(i)}
              >
                <code className="font-mono">{`{${s.tag}}`}</code>
                <span className="truncate text-muted-foreground">{s.desc}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RichTextEditor;
