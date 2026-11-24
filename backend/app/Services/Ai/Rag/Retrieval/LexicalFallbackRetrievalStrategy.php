<?php

namespace App\Services\Ai\Rag\Retrieval;

use App\Contracts\RetrievalStrategyInterface;

class LexicalFallbackRetrievalStrategy implements RetrievalStrategyInterface
{
    public function retrieve(string $query, array $candidates, ?array $queryEmbedding = null, int $limit = 5): array
    {
        $tokens = $this->tokenize($query);
        if (empty($tokens) || empty($candidates)) {
            return array_slice($candidates, 0, $limit);
        }

        $scored = [];
        foreach ($candidates as $candidate) {
            $score = $this->scoreCandidate($tokens, $candidate);
            if ($score > 0) {
                $candidate['score'] = round($score, 4);
                $scored[] = $candidate;
            }
        }

        usort($scored, fn (array $a, array $b) => ($b['score'] <=> $a['score']));

        return array_slice($scored, 0, $limit);
    }

    /**
     * Calcula pontuação lexical normalizada (0..1) considerando título, seção e corpo.
     */
    public function scoreCandidate(array $queryTokens, array $candidate): float
    {
        if (empty($queryTokens)) {
            return 0.0;
        }

        $title = $this->normalize((string) ($candidate['title'] ?? ''));
        $section = $this->normalize((string) ($candidate['section_title'] ?? ''));
        $body = $this->normalize((string) ($candidate['content'] ?? ''));

        $hits = 0.0;
        foreach ($queryTokens as $token) {
            if (str_contains($title, $token) || str_contains($section, $token)) {
                $hits += 1.5;
            }
            if (str_contains($body, $token)) {
                $hits += 1.0;
            }
        }

        $maxPossible = count($queryTokens) * 2.5;

        return $maxPossible > 0 ? min(1.0, $hits / $maxPossible) : 0.0;
    }

    /**
     * @return string[]
     */
    public function tokenize(string $text): array
    {
        $normalized = $this->normalize($text);
        $raw = preg_split('/[^a-z0-9]+/', $normalized) ?: [];

        $stopwords = [
            'a', 'o', 'e', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
            'um', 'uma', 'para', 'por', 'com', 'sem', 'que', 'qual', 'quais', 'como', 'onde',
            'se', 'ao', 'aos', 'ou', 'as', 'os', 'ser', 'ter', 'tem', 'sao', 'esta', 'este',
        ];

        $tokens = [];
        foreach ($raw as $word) {
            if (strlen($word) >= 2 && !in_array($word, $stopwords, true)) {
                $tokens[] = $word;
            }
        }

        return array_values(array_unique($tokens));
    }

    protected function normalize(string $text): string
    {
        $lower = mb_strtolower($text, 'UTF-8');
        $trans = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $lower);

        return $trans !== false ? $trans : $lower;
    }
}
