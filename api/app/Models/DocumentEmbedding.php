<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Represents a single PDF chunk + its Gemini embedding, stored in the
 * pgvector-backed `document_embeddings` table on the Supabase connection.
 *
 * The `embedding` attribute is stored as the pgvector `vector(768)` type and
 * is read/written as a JSON array of floats. Eloquent cannot translate the
 * `<=>` operator directly, so nearest-neighbor queries are delegated to
 * App\Services\VectorStoreService.
 */
class DocumentEmbedding extends Model
{
    use HasFactory, HasUuids;

    protected $connection = 'supabase';

    protected $table = 'document_embeddings';

    protected $fillable = [
        'chunk_id',
        'content',
        'embedding',
        'source',
        'page',
        'chunk_index',
    ];

    protected function casts(): array
    {
        return [
            'page' => 'integer',
            'chunk_index' => 'integer',
        ];
    }

    public function getEmbeddingAttribute($value): array
    {
        return is_array($value) ? $value : array_map('floatval', explode(',', trim((string) $value, '[]"')));
    }
}
