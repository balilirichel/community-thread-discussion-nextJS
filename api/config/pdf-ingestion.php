<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Vector Store Connection
    |--------------------------------------------------------------------------
    |
    | The database connection that holds the pgvector `document_embeddings`
    | table. In production this is the `supabase` connection defined in
    | config/database.php. Injecting the name here (rather than hard-coding)
    | keeps the rest of the code swap-friendly.
    |
    */

    'connection' => env('VECTOR_STORE_CONNECTION', 'supabase'),

    /*
    |--------------------------------------------------------------------------
    | Embedding Dimensions
    |--------------------------------------------------------------------------
    |
    | Dimensionality of the Gemini embeddings produced by EmbeddingService
    | (outputDimensionality=768). Must match the `vector(N)` column and the
    | index operator class used in the migration. Keep in sync with
    | config/services.php.gemini.embedding_dimensions.
    |
    */

    'vector_dimensions' => (int) env('VECTOR_DIMENSIONS', 768),

    /*
    |--------------------------------------------------------------------------
    | Collection
    |--------------------------------------------------------------------------
    |
    | Retained for compatibility: the pgvector table effectively replaces the
    | ChromaDB collection. Used by the migration name when running on the
    | non-default connection.
    |
    */

    'collection' => env('VECTOR_STORE_COLLECTION', 'document_embeddings'),

    /*
    |--------------------------------------------------------------------------
    | Retrieval
    |--------------------------------------------------------------------------
    |
    | How many PDF chunks to retrieve per query. This is additive to the
    | existing knowledge-base entry retrieval — both are sent to Gemini.
    |
    */

    'top_k' => (int) env('VECTOR_TOP_K', 5),

    /*
    |--------------------------------------------------------------------------
    | Chunking
    |--------------------------------------------------------------------------
    |
    | Controls how PDF text is split before embedding. Tune these based on
    | your PDF content: technical docs may benefit from larger chunks,
    | conversational content from smaller ones.
    |
    */

    'chunk_size' => (int) env('VECTOR_CHUNK_SIZE', 500),

    'chunk_overlap' => (int) env('VECTOR_CHUNK_OVERLAP', 50),

];
