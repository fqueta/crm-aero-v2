<?php

namespace App\Services\Ai\Rag\Chunking;

use App\Contracts\ChunkingStrategyInterface;

class PlainTextChunkingStrategy implements ChunkingStrategyInterface
{
    public function chunk(string $content, array $options = []): array
    {
        $maxChars = max(200, (int) ($options['max_chars'] ?? 900));
        $overlap = max(0, min($maxChars - 50, (int) ($options['overlap'] ?? 120)));
        $sectionTitle = isset($options['section_title']) ? (string) $options['section_title'] : null;

        $text = trim(preg_replace("/\r\n|\r/", "\n", $content) ?? '');
        if ($text === '') {
            return [];
        }

        if (mb_strlen($text) <= $maxChars) {
            return [[
                'section_title' => $sectionTitle,
                'content' => $text,
            ]];
        }

        $paragraphs = preg_split("/\n{2,}/", $text) ?: [$text];
        $chunks = [];
        $current = '';

        foreach ($paragraphs as $para) {
            $para = trim($para);
            if ($para === '') {
                continue;
            }

            if ($current !== '' && (mb_strlen($current) + 2 + mb_strlen($para)) > $maxChars) {
                $chunks[] = [
                    'section_title' => $sectionTitle,
                    'content' => trim($current),
                ];
                $tail = $overlap > 0 ? mb_substr($current, -$overlap) : '';
                $current = trim($tail . "\n\n" . $para);
            } else {
                $current = $current === '' ? $para : ($current . "\n\n" . $para);
            }

            while (mb_strlen($current) > $maxChars) {
                $slice = mb_substr($current, 0, $maxChars);
                $lastSpace = mb_strrpos($slice, ' ');
                if ($lastSpace !== false && $lastSpace > (int) ($maxChars * 0.6)) {
                    $slice = mb_substr($slice, 0, $lastSpace);
                }
                $chunks[] = [
                    'section_title' => $sectionTitle,
                    'content' => trim($slice),
                ];
                $step = max(1, mb_strlen($slice) - $overlap);
                $current = trim(mb_substr($current, $step));
            }
        }

        if (trim($current) !== '') {
            $chunks[] = [
                'section_title' => $sectionTitle,
                'content' => trim($current),
            ];
        }

        return $chunks;
    }
}
