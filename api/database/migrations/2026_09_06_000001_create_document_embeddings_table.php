<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Creates the pgvector-backed table that replaces the ChromaDB
     * `pdf_documents` collection used by the RAG pipeline.
     *
     * - The `vector` extension must exist on the target (Supabase) database.
     *   It is enabled on the `supabase` connection explicitly so this runs
     *   regardless of which connection is the app default.
     * - Column layout mirrors the old ChromaDB shape: content (documents),
     *   embedding (pre-computed by Gemini), and source/page/chunk_index (metadata).
     */
    public function up(): void
    {
        $connection = config('pdf-ingestion.connection', DB::getDefaultConnection());

        // Enable the pgvector extension. On Supabase this should already be
        // enabled via the dashboard (Database → Extensions → "vector").
        // The IF NOT EXISTS is a safety net; the try/catch handles the case
        // where Supabase's transaction-mode pooler (port 6543) doesn't
        // support CREATE EXTENSION — the extension is already global.
        try {
            DB::connection($connection)->statement('CREATE EXTENSION IF NOT EXISTS vector');
        } catch (Exception $e) {
            Log::info('CREATE EXTENSION vector skipped (likely already enabled)', [
                'error' => $e->getMessage(),
            ]);
        }

        Schema::connection($connection)->create('document_embeddings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('chunk_id')->unique();
            $table->text('content');
            // Gemini `gemini-embedding-001` with outputDimensionality=768.
            // Matches config('pdf-ingestion.vector_dimensions').
            $table->addColumn('vector', 'embedding', ['dimensions' => 768])
                ->nullable(false);
            $table->string('source');
            $table->integer('page');
            $table->integer('chunk_index');
            $table->timestamps();

            // Speed up lookups for delete-by-source (re-ingestion).
            $table->index('source');
        });

        // HNSW index for approximate nearest-neighbor search over cosine
        // distance (pgvector `<=>` operator). Raw DDL required because
        // Laravel's Blueprint has no native vector-index type.
        //
        // HNSW is chosen over IVFFlat because:
        //  - It can be built on an empty table (no training step) so the
        //    incremental PDF re-ingestion pipeline stays optimal as rows are
        //    added; IVFFlat must be built on representative data and rebuilt
        //    as the corpus grows.
        //  - Its accuracy is insensitive to the `lists`/`probes` tuning that
        //    IVFFlat requires relative to row count.
        // Via DB::statement (pgvector operator syntax, not standard SQL).
        DB::connection($connection)->statement(
            'CREATE INDEX document_embeddings_embedding_hnsw_idx
             ON document_embeddings
             USING hnsw (embedding vector_cosine_ops)'
        );
    }

    public function down(): void
    {
        $connection = config('pdf-ingestion.connection', DB::getDefaultConnection());

        Schema::connection($connection)->dropIfExists('document_embeddings');
    }
};
