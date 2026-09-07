<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class EmbeddingService
{
    private const BATCH_SIZE = 100;

    private string $apiKey;

    private string $model;

    private int $dimensions;

    private int $timeout = 15;

    public function __construct()
    {
        $this->apiKey = config('services.gemini.api_key', '');
        $this->model = config('services.gemini.embedding_model', 'text-embedding-004');
        $this->dimensions = (int) config('services.gemini.embedding_dimensions', 768);
    }

    /**
     * Generate an embedding for a single text (used for user queries).
     *
     * @return array<float>|null
     */
    public function embedQuery(string $text): ?array
    {
        return $this->embedSingle($text, 'RETRIEVAL_QUERY');
    }

    /**
     * Generate embeddings for multiple document texts (used during ingestion).
     * Batches internally to respect API limits.
     *
     * @param  array<string>  $texts
     * @return array<array<float>>|null
     */
    public function embedDocuments(array $texts): ?array
    {
        if (empty($this->apiKey)) {
            Log::error('GEMINI_API_KEY not configured for embeddings');

            return null;
        }

        $allEmbeddings = [];

        $batches = array_chunk($texts, self::BATCH_SIZE);

        foreach ($batches as $batch) {
            $embeddings = $this->embedBatch($batch);

            if ($embeddings === null) {
                return null;
            }

            $allEmbeddings = array_merge($allEmbeddings, $embeddings);
        }

        return $allEmbeddings;
    }

    /**
     * Embed a single text with a given task type.
     *
     * @return array<float>|null
     */
    private function embedSingle(string $text, string $taskType): ?array
    {
        if (empty($this->apiKey)) {
            Log::error('GEMINI_API_KEY not configured for embeddings');

            return null;
        }

        try {
            $url = sprintf(
                'https://generativelanguage.googleapis.com/v1beta/models/%s:embedContent?key=%s',
                $this->model,
                $this->apiKey,
            );

            $response = Http::timeout($this->timeout)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post($url, [
                    'content' => [
                        'parts' => [
                            ['text' => $text],
                        ],
                    ],
                    'taskType' => $taskType,
                    'outputDimensionality' => $this->dimensions,
                ]);

            if ($response->failed()) {
                Log::error('Gemini embedContent failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return null;
            }

            $values = $response->json('embedding.values');

            if (! is_array($values)) {
                return null;
            }

            // gemini-embedding-001 does NOT auto-normalize truncated
            // (<3072) vectors, so we normalize manually to keep cosine
            // distance semantics correct.
            return $this->normalize($values);
        } catch (\Exception $e) {
            Log::error('Gemini embedContent exception', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Embed a batch of document texts via batchEmbedContents.
     *
     * @param  array<string>  $texts
     * @return array<array<float>>|null
     */
    private function embedBatch(array $texts): ?array
    {
        try {
            $url = sprintf(
                'https://generativelanguage.googleapis.com/v1beta/models/%s:batchEmbedContents?key=%s',
                $this->model,
                $this->apiKey,
            );

            $requests = array_map(fn ($text) => [
                'model' => "models/{$this->model}",
                'content' => [
                    'parts' => [
                        ['text' => $text],
                    ],
                ],
                'taskType' => 'RETRIEVAL_DOCUMENT',
            ], $texts);

            $response = Http::timeout($this->timeout * 2)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post($url, [
                    'requests' => $requests,
                    'outputDimensionality' => $this->dimensions,
                ]);

            if ($response->failed()) {
                Log::error('Gemini batchEmbedContents failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return null;
            }

            $embeddings = $response->json('embeddings');

            return array_map(fn ($e) => $this->normalize($e['values']), $embeddings);
        } catch (\Exception $e) {
            Log::error('Gemini batchEmbedContents exception', [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * L2-normalize a vector so cosine distance equals Euclidean distance on
     * the unit sphere. Required because gemini-embedding-001 does not
     * auto-normalize truncated (<3072) embeddings.
     *
     * @param  array<mixed>  $values
     * @return array<float>|null
     */
    private function normalize(array $values): ?array
    {
        $vector = array_map(fn ($v) => (float) $v, $values);

        $norm = sqrt(array_sum(array_map(fn ($v) => $v * $v, $vector)));

        if ($norm <= 0.0) {
            return null;
        }

        return array_map(fn ($v) => $v / $norm, $vector);
    }
}
