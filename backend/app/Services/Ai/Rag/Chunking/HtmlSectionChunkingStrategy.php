<?php

namespace App\Services\Ai\Rag\Chunking;

use App\Contracts\ChunkingStrategyInterface;

class HtmlSectionChunkingStrategy implements ChunkingStrategyInterface
{
    public function chunk(string $content, array $options = []): array
    {
        $maxChars = (int) ($options['max_chars'] ?? 900);
        $overlap = (int) ($options['overlap'] ?? 120);

        $html = trim($content);
        if ($html === '') {
            return [];
        }

        // Separa o HTML por headings h1-h4 mantendo o título de cada seção
        $parts = preg_split('/(<h[1-4][^>]*>.*?<\/h[1-4]>)/is', $html, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY);
        if (!is_array($parts)) {
            $parts = [$html];
        }

        $sections = [];
        $currentTitle = null;
        $buffer = '';

        foreach ($parts as $part) {
            if (preg_match('/^<h[1-4][^>]*>(.*?)<\/h[1-4]>$/is', trim($part), $m)) {
                if (trim($buffer) !== '') {
                    $sections[] = ['section_title' => $currentTitle, 'text' => $this->htmlToCleanText($buffer)];
                    $buffer = '';
                }
                $currentTitle = trim(html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            } else {
                $buffer .= "\n" . $part;
            }
        }

        if (trim($buffer) !== '') {
            $sections[] = ['section_title' => $currentTitle, 'text' => $this->htmlToCleanText($buffer)];
        }

        $plainStrategy = new PlainTextChunkingStrategy();
        $chunks = [];

        foreach ($sections as $sec) {
            $text = trim($sec['text']);
            if ($text === '') {
                continue;
            }
            $subChunks = $plainStrategy->chunk($text, [
                'max_chars' => $maxChars,
                'overlap' => $overlap,
                'section_title' => $sec['section_title'],
            ]);
            foreach ($subChunks as $sc) {
                $chunks[] = $sc;
            }
        }

        return $chunks;
    }

    protected function htmlToCleanText(string $html): string
    {
        $normalized = preg_replace('/<(br|\/p|\/div|\/li|\/tr)[^>]*>/i', "\n", $html);
        $normalized = preg_replace('/<li[^>]*>/i', '- ', (string) $normalized);
        $text = strip_tags((string) $normalized);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace("/[ \t]+/", ' ', $text);
        $text = preg_replace("/\n{3,}/", "\n\n", (string) $text);

        return trim((string) $text);
    }
}
