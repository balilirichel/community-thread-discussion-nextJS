<?php

namespace App\Console\Commands;

use App\Services\PdfIngestionService;
use Illuminate\Console\Command;
use RuntimeException;

class IngestPdf extends Command
{
    protected $signature = 'pdf:ingest
                            {path : Path to PDF file (absolute or relative to storage/app/public/knowledgebase)}
                            {--delete : Delete existing chunks for this file before re-ingesting}';

    protected $description = 'Ingest a PDF file into the vector store for semantic search';

    public function handle(PdfIngestionService $ingestion): int
    {
        $path = $this->argument('path');

        if (! str_starts_with($path, '/')) {
            $basePath = storage_path('app/public/knowledgebase');
            $path = $basePath.DIRECTORY_SEPARATOR.$path;
        }

        if (! is_file($path)) {
            $this->error("File not found: {$path}");

            return self::FAILURE;
        }

        $filename = basename($path);

        if ($this->option('delete')) {
            $this->info("Deleting existing chunks for '{$filename}'...");
            $ingestion->deleteByFilename($filename);
        }

        $this->info("Ingesting PDF: {$filename}");

        try {
            $result = $ingestion->ingest($path);
        } catch (RuntimeException $e) {
            $this->error("Ingestion failed: {$e->getMessage()}");

            return self::FAILURE;
        }

        $this->info("Done. Ingested {$result['chunks']} chunks from {$result['pages']} pages.");

        return self::SUCCESS;
    }
}
