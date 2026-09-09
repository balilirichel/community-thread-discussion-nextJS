<?php

namespace App\Console\Commands;

use App\Models\Booking;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class RetryUnsyncedBookings extends Command
{
    protected $signature = 'bookings:retry-unsynced';

    protected $description = 'Retry Make.com webhook for bookings that failed to sync';

    public function handle(): int
    {
        $webhookUrl = config('services.make.webhook_url');

        if (! $webhookUrl) {
            $this->error('MAKE_WEBHOOK_URL not configured.');

            return self::FAILURE;
        }

        $bookings = Booking::where('synced_to_sheet', false)
            ->where('created_at', '<=', now()->subMinutes(5))
            ->limit(50)
            ->get();

        if ($bookings->isEmpty()) {
            $this->info('No unsynced bookings to retry.');

            return self::SUCCESS;
        }

        $synced = 0;
        $failed = 0;

        foreach ($bookings as $booking) {
            try {
                $response = Http::timeout(5)->post($webhookUrl, [
                    'booking_id' => $booking->id,
                    'name' => $booking->name,
                    'email' => $booking->email,
                    'date' => $booking->date->format('Y-m-d'),
                    'time' => $booking->time,
                    'topic' => $booking->topic,
                    'status' => $booking->status,
                    'created_at' => $booking->created_at->toISOString(),
                ]);

                if ($response->successful()) {
                    $booking->update(['synced_to_sheet' => true]);
                    $synced++;
                } else {
                    $failed++;
                    Log::warning("Webhook retry failed for booking {$booking->id}", [
                        'status' => $response->status(),
                    ]);
                }
            } catch (\Exception $e) {
                $failed++;
                Log::error("Webhook retry exception for booking {$booking->id}", [
                    'message' => $e->getMessage(),
                ]);
            }
        }

        $this->info("Retried: {$synced} synced, {$failed} failed.");

        return self::SUCCESS;
    }
}
