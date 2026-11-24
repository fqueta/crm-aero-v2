<?php

namespace App\Services\Ai\Rag\Retrieval;

use App\Contracts\RetrievalStrategyInterface;

class HybridVectorLexicalRetrievalStrategy implements RetrievalStrategyInterface
{
    protected LexicalFallbackRetrievalStrategy $lexical;

    public function __construct(?LexicalFallbackRetrievalStrategy $lexical = null)
    {
        $this->lexical = $lexical ?? new LexicalFallbackRetrievalStrategy();
    }

    public function retrieve(string $query, array $candidates, ?array $queryEmbedding = null, int $limit = 5): array
    {
        if (empty($candidates)) {
            return [];
        }

        if (empty($queryEmbedding)) {
            return $this->lexical->retrieve($query, $candidates, null, $limit);
        }

        $tokens = $this->lexical->tokenize($query);
        $scored = [];

        foreach ($candidates as $candidate) {
            $chunkVec = $candidate['embedding'] ?? null;
            $lexicalScore = $this->lexical->scoreCandidate($tokens, $candidate);

            if (is_array($chunkVec) && count($chunkVec) === count($queryEmbedding) && count($chunkVec) > 0) {
                $vecScore = max(0.0, $this->cosineSimilarity($queryEmbedding, $chunkVec));
                $finalScore = ($vecScore * 0.75) + ($lexicalScore * 0.25);
            } else {
                $finalScore = $lexicalScore * 0.65;
            }

            if ($finalScore > 0.05) {
                $candidate['score'] = round($finalScore, 4);
                $scored[] = $candidate;
            }
        }

        usort($scored, fn (array $a, array $b) => ($b['score'] <=> $a['score']));

        return array_slice($scored, 0, $limit);
    }

    /**
     * Similaridade de cosseno entre dois vetores de mesma dimensão.
     *
     * @param float[] $a
     * @param float[] $b
     */
    public function cosineSimilarity(array $a, array $b): float
    {
        $dot = 0.0;
        $normA = 0.0;
        $normB = 0.0;
        $len = count($a);

        for ($i = 0; $i < $len; $i++) {
            $va = (float) $a[$i];
            $vb = (float) $b[$i];
            $dot += $va * $vb;
            $normA += $va * $va;
            $normB += $vb * $vb;
        }

        if ($normA <= 0.0 || $normB <= 0.0) {
            return 0.0;
        }

        return $dot / (sqrt($normA) * sqrt($normB));
    }
}
