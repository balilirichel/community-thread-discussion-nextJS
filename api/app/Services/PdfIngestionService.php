<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Smalot\PdfParser\Parser;

class PdfIngestionService
{
    private VectorStoreService $vectorStore;

    private EmbeddingService $embedding;

    public function __construct(VectorStoreService $vectorStore, EmbeddingService $embedding)
    {
        $this->vectorStore = $vectorStore;
        $this->embedding = $embedding;
    }

    /**
     * Ingest a PDF file into the vector store.
     *
     * Steps: extract text per page → chunk → embed → store.
     * Returns a summary array with counts, or throws on critical failure.
     *
     * @return array{chunks: int, pages: int, filename: string}
     *
     * @throws \RuntimeException
     */
    public function ingest(string $pdfPath): array
    {
        if (! is_file($pdfPath)) {
            throw new \RuntimeException("PDF file not found: {$pdfPath}");
        }

        $filename = basename($pdfPath);

        $parser = new Parser;
        $pdf = $parser->parseFile($pdfPath);
        $pages = $pdf->getPages();

        $chunkSize = config('pdf-ingestion.chunk_size', 500);
        $chunkOverlap = config('pdf-ingestion.chunk_overlap', 50);

        $allChunks = [];
        $allMetadatas = [];
        $allIds = [];

        foreach ($pages as $pageIndex => $page) {
            $text = trim($page->getText());

            if (empty($text)) {
                continue;
            }

            $pageChunks = $this->chunkText($text, $chunkSize, $chunkOverlap);
            $pageNumber = $pageIndex + 1;

            foreach ($pageChunks as $chunkIndex => $chunk) {
                $id = $this->buildChunkId($filename, $pageNumber, $chunkIndex);
                $allIds[] = $id;
                $allChunks[] = $chunk;
                $allMetadatas[] = [
                    'source' => $filename,
                    'page' => $pageNumber,
                    'chunk_index' => $chunkIndex,
                ];
            }
        }

        if (empty($allChunks)) {
            throw new \RuntimeException("No text content extracted from PDF: {$filename}");
        }

        $embeddings = $this->embedding->embedDocuments($allChunks);

        if ($embeddings === null) {
            throw new \RuntimeException('Failed to generate embeddings for PDF chunks.');
        }

        if (count($embeddings) !== count($allChunks)) {
            throw new \RuntimeException(
                'Embedding count mismatch: expected '.count($allChunks).', got '.count($embeddings),
            );
        }

        $stored = $this->vectorStore->storeDocuments(
            $allIds,
            $allChunks,
            $embeddings,
            $allMetadatas,
        );

        if (! $stored) {
            throw new \RuntimeException('Failed to store PDF chunks in the vector store.');
        }

        Log::info('PDF ingested successfully', [
            'filename' => $filename,
            'pages' => count($pages),
            'chunks' => count($allChunks),
        ]);

        return [
            'chunks' => count($allChunks),
            'pages' => count($pages),
            'filename' => $filename,
        ];
    }

    /**
     * Delete all chunks from a previously ingested PDF.
     */
    public function deleteByFilename(string $filename): bool
    {
        return $this->vectorStore->deleteBySource($filename);
    }

    /**
     * Split text into overlapping chunks, preferring paragraph and sentence boundaries.
     *
     * @return array<string>
     */
    private function chunkText(string $text, int $chunkSize, int $chunkOverlap): array
    {
        if (strlen($text) <= $chunkSize) {
            return [$text];
        }

        $paragraphs = preg_split('/\n{2,}/', $text);
        $paragraphs = array_filter($paragraphs, fn ($p) => trim($p) !== '');

        $chunks = [];
        $currentChunk = '';

        foreach ($paragraphs as $paragraph) {
            $paragraph = trim($paragraph);

            if (strlen($paragraph) > $chunkSize) {
                if ($currentChunk !== '') {
                    $chunks[] = $currentChunk;
                    $currentChunk = '';
                }

                $chunks = array_merge($chunks, $this->splitLongParagraph($paragraph, $chunkSize, $chunkOverlap));

                continue;
            }

            $separator = $currentChunk !== '' ? "\n\n" : '';
            $candidate = $currentChunk.$separator.$paragraph;

            if (strlen($candidate) <= $chunkSize) {
                $currentChunk = $candidate;
            } else {
                if ($currentChunk !== '') {
                    $chunks[] = $currentChunk;
                }

                $currentChunk = $paragraph;
            }
        }

        if ($currentChunk !== '') {
            $chunks[] = $currentChunk;
        }

        return $this->applyOverlap($chunks, $chunkOverlap);
    }

    /**
     * Split a single long paragraph by sentence boundaries, then hard split if needed.
     *
     * @return array<string>
     */
    private function splitLongParagraph(string $text, int $chunkSize, int $chunkOverlap): array
    {
        $sentences = preg_split('/(?<=[.!?])\s+/', $text, -1, PREG_SPLIT_NO_EMPTY);
        $chunks = [];
        $currentChunk = '';

        foreach ($sentences as $sentence) {
            if (strlen($sentence) > $chunkSize) {
                if ($currentChunk !== '') {
                    $chunks[] = $currentChunk;
                    $currentChunk = '';
                }

                $chunks = array_merge($chunks, $this->hardSplit($sentence, $chunkSize));

                continue;
            }

            $separator = $currentChunk !== '' ? ' ' : '';
            $candidate = $currentChunk.$separator.$sentence;

            if (strlen($candidate) <= $chunkSize) {
                $currentChunk = $candidate;
            } else {
                if ($currentChunk !== '') {
                    $chunks[] = $currentChunk;
                }

                $currentChunk = $sentence;
            }
        }

        if ($currentChunk !== '') {
            $chunks[] = $currentChunk;
        }

        return $chunks;
    }

    /**
     * Hard-split text that exceeds chunk size with no good break points.
     *
     * @return array<string>
     */
    private function hardSplit(string $text, int $chunkSize): array
    {
        $chunks = [];

        while (strlen($text) > $chunkSize) {
            $splitPoint = strrpos(substr($text, 0, $chunkSize), ' ');

            if ($splitPoint === false) {
                $splitPoint = $chunkSize;
            }

            $chunks[] = substr($text, 0, $splitPoint);
            $text = trim(substr($text, $splitPoint));
        }

        if ($text !== '') {
            $chunks[] = $text;
        }

        return $chunks;
    }

    /**
     * Apply overlap between consecutive chunks.
     *
     * @param  array<string>  $chunks
     * @return array<string>
     */
    private function applyOverlap(array $chunks, int $overlap): array
    {
        if ($overlap <= 0 || count($chunks) <= 1) {
            return $chunks;
        }

        $result = [$chunks[0]];

        for ($i = 1; $i < count($chunks); $i++) {
            $prevChunk = $chunks[$i - 1];
            $overlapText = substr($prevChunk, -$overlap);

            if ($overlapText !== false && $overlapText !== '') {
                $result[] = $overlapText."\n\n".$chunks[$i];
            } else {
                $result[] = $chunks[$i];
            }
        }

        return $result;
    }

    /**
     * Build a deterministic chunk ID from source metadata.
     * This ensures re-ingesting the same PDF replaces old chunks via upsert.
     */
    private function buildChunkId(string $filename, int $pageNumber, int $chunkIndex): string
    {
        return md5("{$filename}_{$pageNumber}_{$chunkIndex}");
    }
}
