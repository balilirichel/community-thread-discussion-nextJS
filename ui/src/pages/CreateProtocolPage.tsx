import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import DesktopSidebar from '../components/layout/DesktopSidebar';
import BottomNav from '../components/layout/BottomNav';
import ProtocolFormHeader from '../components/protocol/create/ProtocolFormHeader';
import ProtocolForm from '../components/protocol/create/ProtocolForm';
import ProtocolCreatedSuccess from '../components/protocol/create/ProtocolCreatedSuccess';
import type { Protocol } from '../types/protocol';

// ****Slug helper (mirrors HomePage) ─────────────────────────────────────
const SLUGIFY_RE = /[^a-z0-9]+/g;
const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(SLUGIFY_RE, '-')
    .replace(/(^-|-$)/g, '');

// ****Tips panel (desktop right column) ───────────────────────────────────────
const TipsPanel: React.FC = () => (
  <aside className="hidden lg:flex flex-col gap-5 flex-shrink-0 w-[280px] xl:w-[300px] sticky top-0 h-screen overflow-y-auto border-l border-gray-100 bg-[#f8faf9] px-5 py-8">
    {/* Writing tips */}
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
        Writing Tips
      </p>
      <ul className="space-y-4">
        {[
          {
            emoji: '📝',
            title: 'Clear title',
            desc: 'Use a specific, descriptive title that tells readers exactly what the protocol covers.',
          },
          {
            emoji: '🔍',
            title: 'Detailed content',
            desc: 'Include step-by-step instructions, expected outcomes, and common pitfalls.',
          },
          {
            emoji: '🏷️',
            title: 'Relevant tags',
            desc: 'Add tags that reflect your domain (e.g. "cardiology", "nutrition", "clinical").',
          },
          {
            emoji: '✅',
            title: 'Evidence-based',
            desc: 'Reference established guidelines or studies where possible to build trust.',
          },
        ].map(({ emoji, title, desc }) => (
          <li key={title} className="flex gap-3">
            <span className="text-lg flex-shrink-0 mt-0.5">{emoji}</span>
            <div>
              <p className="text-sm font-semibold text-gray-800">{title}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>

    {/* Divider */}
    <div className="border-t border-gray-200" />

    {/* Community guidelines */}
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
        Community Guidelines
      </p>
      <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-2.5">
        {[
          'Be accurate and honest',
          'Avoid duplicate protocols',
          'Respect community standards',
          'Keep content professional',
        ].map((rule) => (
          <div key={rule} className="flex items-center gap-2 text-sm text-gray-600">
            <span className="w-4 h-4 rounded-full bg-[#e8f5f0] flex items-center justify-center flex-shrink-0">
              <span className="text-[#118451] text-[9px] font-bold">✓</span>
            </span>
            {rule}
          </div>
        ))}
      </div>
    </div>
  </aside>
);

// ****Create Protocol Page ***********//
const CreateProtocolPage: React.FC = () => {
  const router = useRouter();
  const [createdProtocol, setCreatedProtocol] = useState<Protocol | null>(null);

  const handleBack = useCallback(() => router.back(), [router]);

  const handleSuccess = useCallback((protocol: Protocol) => {
    setCreatedProtocol(protocol);
    // Scroll to top to reveal the success state
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleViewProtocol = useCallback(() => {
    if (!createdProtocol) return;
    router.push(`/protocols/${slugify(createdProtocol.title)}`);
  }, [createdProtocol, router]);

  const handleCreateAnother = useCallback(() => {
    setCreatedProtocol(null);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  return (
    <div className="flex min-h-screen bg-[#f8faf9]">
      {/* ── Desktop Sidebar ── */}
      <DesktopSidebar />

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col lg:flex-row min-w-0 overflow-hidden">

        {/* ══ LEFT / MAIN COLUMN ══════════════════════════════════════════════ */}
        <main
          id="create-protocol-main"
          className="flex-1 flex flex-col min-w-0 bg-white lg:border-r lg:border-gray-100"
        >
          {/* ── Hero header ── */}
          <ProtocolFormHeader onBack={handleBack} />

          {/* ── Form / Success area ── */}
          <div className="flex-1 overflow-y-auto pb-28 lg:pb-10">
            {createdProtocol ? (
              /* Success state */
              <ProtocolCreatedSuccess
                protocol={createdProtocol}
                onViewProtocol={handleViewProtocol}
                onCreateAnother={handleCreateAnother}
              />
            ) : (
              /* Form state */
              <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-8">
                {/* Progress indicator */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#118451] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      1
                    </div>
                    <span className="text-sm font-semibold text-[#118451]">Fill in details</span>
                  </div>
                  <div className="flex-1 h-px bg-gray-200" />
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs font-bold flex-shrink-0">
                      2
                    </div>
                    <span className="text-sm text-gray-400">Published</span>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100" />

                {/* Required field hint */}
                <p className="text-xs text-gray-400">
                  Fields marked with <span className="text-red-400 font-semibold">*</span> are required.
                </p>

                {/* The form */}
                <ProtocolForm
                  onSuccess={handleSuccess}
                  onCancel={handleBack}
                />
              </div>
            )}
          </div>
        </main>

        {/* ══ RIGHT / TIPS PANEL ══════════════════════════════════════════════ */}
        <TipsPanel />
      </div>

      {/* ── Mobile bottom nav ── */}
      <BottomNav />
    </div>
  );
};

export default CreateProtocolPage;
