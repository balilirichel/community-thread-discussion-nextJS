<?php

namespace App\Services;

use App\Models\DocumentEmbedding;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Abstraction over the vector store used by the RAG pipeline.
 *
 * Intentionally mirrors the behavior contract that ChromaDBService once
 * provided (store chunks + embeddings, nearest-neighbor query, delete by
 * source), so that PdfIngestionService and ChatService remain agnostic to the
 * concrete backing store. Today it is implemented on pgvector (Supabase), but
 * swapping to another store only requires changing this class.
 */
class VectorStoreService
{
    /**
     * Store document chunks with their pre-computed embeddings.
     *
     * @param  array<string>  $chunkIds  deterministic IDs (upsert key)
     * @param  array<string>  $contents
     * @param  array<array<float>>  $embeddings
     * @param  array<array<string, mixed>>  $metadatas  source/page/chunk_index
     */
    public function storeDocuments(
        array $chunkIds,
        array $contents,
        array $embeddings,
        array $metadatas,
    ): bool {
        try {
            $rows = [];

            foreach ($chunkIds as $i => $chunkId) {
                $vector = '['
                    .implode(',', array_map(fn ($v) => sprintf('%.6f', (float) $v), $embeddings[$i]))
                    .']';

                $rows[] = [
                    'id' => (string) Str::uuid(),
                    'chunk_id' => $chunkId,
                    'content' => $contents[$i],
                    'embedding' => $vector,
                    'source' => $metadatas[$i]['source'] ?? '',
                    'page' => (int) ($metadatas[$i]['page'] ?? 1),
                    'chunk_index' => (int) ($metadatas[$i]['chunk_index'] ?? 0),
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }

            // Upsert on chunk_id so re-ingesting the same PDF replaces old rows.
            $connection = DB::connection(config('pdf-ingestion.connection', 'supabase'));
            $table = $connection->getTablePrefix().'document_embeddings';

            $columns = ['id', 'chunk_id', 'content', 'embedding', 'source', 'page', 'chunk_index', 'created_at', 'updated_at'];
            $columnList = implode(', ', $columns);
            $placeholders = rtrim(str_repeat('?, ', count($columns)), ', ');

            foreach ($rows as $row) {
                $connection->statement(
                    "INSERT INTO {$table} ({$columnList}) VALUES ({$placeholders})
                     ON CONFLICT (chunk_id) DO UPDATE SET
                         content = EXCLUDED.content,
                         embedding = EXCLUDED.embedding,
                         source = EXCLUDED.source,
                         page = EXCLUDED.page,
                         chunk_index = EXCLUDED.chunk_index,
                         updated_at = EXCLUDED.updated_at",
                    array_values($row)
                );
            }

            return true;
        } catch (\Exception $e) {
            Log::error('VectorStoreService::storeDocuments failed', [
                'message' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Return the top-K nearest chunk contents for a query embedding,
     * ranked by cosine similarity (pgvector `<=>` operator).
     *
     * @param  array<float>  $queryEmbedding
     * @return array<string>
     */
    public function queryRelevant(array $queryEmbedding, int $topK): array
    {
        try {
            $vectorLiteral = '['
                .implode(',', array_map(fn ($v) => sprintf('%.6f', (float) $v), $queryEmbedding))
                .']';

            $connection = DB::connection(config('pdf-ingestion.connection', 'supabase'));
            $table = $connection->getTablePrefix().'document_embeddings';

            $results = $connection->select(
                "SELECT content
                 FROM {$table}
                 ORDER BY embedding <=> ?::vector
                 LIMIT ?",
                [$vectorLiteral, max(1, $topK)]
            );

            return array_map(fn ($row) => $row->content, $results);
        } catch (\Exception $e) {
            Log::warning('VectorStoreService::queryRelevant failed (PDF context will be skipped)', [
                'message' => $e->getMessage(),
            ]);

            return [];
        }
    }

    /**
     * Delete all chunks belonging to a given source filename.
     */
    public function deleteBySource(string $filename): bool
    {
        try {
            $deleted = DocumentEmbedding::where('source', $filename)->delete();

            Log::info('VectorStoreService::deleteBySource deleted rows', [
                'source' => $filename,
                'count' => $deleted,
            ]);

            return true;
        } catch (\Exception $e) {
            Log::error('VectorStoreService::deleteBySource failed', [
                'source' => $filename,
                'message' => $e->getMessage(),
            ]);

            return false;
        }
    }
}
