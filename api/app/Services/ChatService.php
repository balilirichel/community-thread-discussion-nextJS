<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\KnowledgeBaseEntry;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ChatService
{
    private VectorStoreService $vectorStore;

    private EmbeddingService $embedding;

    public function __construct(VectorStoreService $vectorStore, EmbeddingService $embedding)
    {
        $this->vectorStore = $vectorStore;
        $this->embedding = $embedding;
    }

    private const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';

    private const GUARDRAIL_PROMPT = <<<'PROMPT'
You are the assistant for {platform}, a community discussion platform.
Answer ONLY using the knowledge base content provided below.
If the question is unrelated to the platform, do not answer it — instead say
you can only help with questions about {platform}, and suggest a few
things you can help with.
If the knowledge base doesn't cover the specific detail, say so rather than guessing.
Keep answers concise.

KNOWLEDGE BASE:
"""
{kb_content}
"""
PROMPT;

    private const OFF_TOPIC_REPLY = "I can only help with questions about {platform}. Here are some things I can assist with:\n\n• How to create and join protocols\n• How discussion threads work\n• Platform features and guidelines\n• Booking a consultation";

    /**
     * Create a new chat session for a visitor.
     */
    public function createSession(?int $userId): array
    {
        $sessionToken = Str::random(64);

        $conversation = ChatConversation::create([
            'user_id' => $userId,
            'session_token' => $sessionToken,
        ]);

        return [
            'session_token' => $sessionToken,
            'conversation_id' => $conversation->id,
        ];
    }

    /**
     * Get message history for a conversation.
     */
    public function getMessages(string $conversationId)
    {
        return ChatMessage::where('conversation_id', $conversationId)
            ->orderBy('created_at')
            ->get();
    }

    /**
     * Process a user message and get an AI reply.
     */
    public function sendMessage(string $conversationId, string $message): array
    {
        $conversation = ChatConversation::findOrFail($conversationId);

        $conversation->messages()->create([
            'role' => 'user',
            'content' => $message,
        ]);

        $kbEntries = $this->retrieveRelevantEntries($message);
        $pdfChunks = $this->retrievePdfChunks($message);

        if ($kbEntries->isEmpty() && empty($pdfChunks)) {
            $reply = $this->buildOffTopicReply();

            $conversation->messages()->create([
                'role' => 'assistant',
                'content' => $reply,
                'flagged_off_topic' => true,
            ]);

            return [
                'reply' => $reply,
                'conversation_id' => $conversationId,
            ];
        }

        $recentMessages = $conversation->messages()
            ->orderByDesc('created_at')
            ->limit(10)
            ->get()
            ->reverse()
            ->values();

        $reply = $this->callGemini($message, $kbEntries, $recentMessages, $pdfChunks);

        $conversation->messages()->create([
            'role' => 'assistant',
            'content' => $reply,
        ]);

        return [
            'reply' => $reply,
            'conversation_id' => $conversationId,
        ];
    }

    /**
     * Create a booking and trigger Make.com webhook.
     */
    public function createBooking(array $data): Booking
    {
        $booking = Booking::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'date' => $data['date'],
            'time' => $data['time'],
            'topic' => $data['topic'],
            'status' => 'pending',
            'synced_to_sheet' => false,
        ]);

        $this->triggerMakeWebhook($booking);

        return $booking;
    }

    /**
     * Search knowledge base entries relevant to the user's message.
     */
    private function retrieveRelevantEntries(string $message): Collection
    {
        $searchTerms = $this->buildSearchQuery($message);

        $entries = KnowledgeBaseEntry::published()
            ->searchRelevant($searchTerms)
            ->limit(5)
            ->get();

        if ($entries->isEmpty()) {
            $entries = KnowledgeBaseEntry::published()
                ->where('title', 'LIKE', '%'.$message.'%')
                ->orWhere('content', 'LIKE', '%'.$message.'%')
                ->limit(3)
                ->get();
        }

        return $entries;
    }

    /**
     * Retrieve relevant PDF chunks from the vector store via semantic search.
     * Returns an empty array on any failure (graceful degradation).
     *
     * @return array<string>
     */
    private function retrievePdfChunks(string $message): array
    {
        try {
            $queryEmbedding = $this->embedding->embedQuery($message);

            if ($queryEmbedding === null) {
                return [];
            }

            $topK = (int) config('pdf-ingestion.top_k', 5);

            return $this->vectorStore->queryRelevant($queryEmbedding, $topK);
        } catch (\Exception $e) {
            Log::warning('PDF chunk retrieval failed, falling back to DB-only', [
                'message' => $e->getMessage(),
            ]);

            return [];
        }
    }

    /**
     * Build a FULLTEXT boolean mode search query from user input.
     */
    private function buildSearchQuery(string $message): string
    {
        $words = explode(' ', Str::limit($message, 200));
        $stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'how', 'what', 'where', 'when', 'why', 'can', 'do', 'does', 'i', 'you', 'we', 'they', 'it', 'to', 'in', 'on', 'at', 'for', 'of', 'and', 'or', 'my', 'your'];

        $terms = array_filter(
            array_map(fn ($w) => strtolower(trim($w)), $words),
            fn ($w) => strlen($w) > 2 && ! in_array($w, $stopWords)
        );

        return implode(' ', array_map(fn ($t) => '+*', $terms));
    }

    /**
     * Build the prompt and call the Gemini API.
     */
    private function callGemini(string $userMessage, Collection $kbEntries, $recentMessages, array $pdfChunks = []): string
    {
        $apiKey = config('services.gemini.api_key');
        $platformName = config('services.gemini.platform_name', 'this platform');

        if (! $apiKey) {
            Log::error('GEMINI_API_KEY not configured');

            return 'I\'m having trouble answering right now. Please try again shortly.';
        }

        $kbContent = $kbEntries->map(fn ($e) => "## {$e->title}\n{$e->content}")->implode("\n\n");

        $pdfContent = '';
        if (! empty($pdfChunks)) {
            $numberedChunks = array_map(
                fn ($chunk, $i) => '[PDF '.($i + 1)."] {$chunk}",
                $pdfChunks,
                array_keys($pdfChunks),
            );
            $pdfContent = implode("\n\n", $numberedChunks);
        }

        $systemPrompt = str_replace(
            ['{platform}', '{kb_content}'],
            [$platformName, $kbContent],
            self::GUARDRAIL_PROMPT
        );

        if ($pdfContent !== '') {
            $systemPrompt .= "\n\nPDF REFERENCES:\n\"\"\"\n{$pdfContent}\n\"\"\"";
        }

        $historyText = '';
        foreach ($recentMessages as $msg) {
            $role = $msg->role === 'user' ? 'User' : 'Assistant';
            $historyText .= "{$role}: {$msg->content}\n";
        }

        $fullPrompt = $systemPrompt."\n\nCONVERSATION HISTORY:\n{$historyText}\nUser: {$userMessage}\nAssistant:";

        try {
            $response = Http::timeout(60)
                ->withHeaders([
                    'Content-Type' => 'application/json',
                ])
                ->post(self::GEMINI_API_URL.'?key='.$apiKey, [
                    'contents' => [
                        [
                            'parts' => [
                                ['text' => $fullPrompt],
                            ],
                        ],
                    ],
                    'generationConfig' => [
                        'temperature' => 0.3,
                        'maxOutputTokens' => 500,
                    ],
                ]);

            if ($response->failed()) {
                Log::error('Gemini API error', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return 'I\'m having trouble answering right now. Please try again shortly.';
            }

            $data = $response->json();
            $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? null;

            if (! $text) {
                Log::warning('Gemini returned empty response', ['data' => $data]);

                return 'I\'m having trouble answering right now. Please try again shortly.';
            }

            return trim($text);
        } catch (\Exception $e) {
            Log::error('Gemini API exception', ['message' => $e->getMessage()]);

            return 'I\'m having trouble answering right now. Please try again shortly.';
        }
    }

    /**
     * Build the off-topic fallback reply.
     */
    private function buildOffTopicReply(): string
    {
        $platformName = config('services.gemini.platform_name', 'this platform');

        return str_replace('{platform}', $platformName, self::OFF_TOPIC_REPLY);
    }

    /**
     * Fire the Make.com webhook for a new booking.
     */
    private function triggerMakeWebhook(Booking $booking): void
    {
        $webhookUrl = config('services.make.webhook_url');

        if (! $webhookUrl) {
            Log::warning('MAKE_WEBHOOK_URL not configured, skipping webhook for booking '.$booking->id);

            return;
        }

        try {
            Http::timeout(5)->post($webhookUrl, [
                'booking_id' => $booking->id,
                'name' => $booking->name,
                'email' => $booking->email,
                'date' => $booking->date->format('Y-m-d'),
                'time' => $booking->time,
                'topic' => $booking->topic,
                'status' => $booking->status,
                'created_at' => $booking->created_at->toISOString(),
            ]);
        } catch (\Exception $e) {
            Log::error('Make.com webhook failed for booking '.$booking->id, [
                'message' => $e->getMessage(),
            ]);
        }
    }
}
