import { ShieldCheck, MessageSquareCode, Home } from 'lucide-react';
import Link from 'next/link';

export default function CardBanner() {
    return (
        <Link
            href="/"
            title="Back to Home"
            className="group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#118451]/40 rounded-xl"
        >
            <div className="w-full flex justify-center mb-6">
                <div className="w-full max-w-[400px] flex items-center justify-center gap-3 py-1.5 px-2
                                rounded-xl transition-colors duration-150
                                group-hover:bg-[#118451]/5 active:bg-[#118451]/10">

                    {/* Minimalist Branded Icon Configuration */}
                    <div className="relative flex-shrink-0 flex items-center justify-center">
                        <div className="p-2 bg-[#118451]/8 rounded-xl text-[#118451]">
                            <ShieldCheck className="h-5 w-5 stroke-[1.5]" />
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 bg-white p-0.5 rounded-md shadow-xs">
                            <MessageSquareCode className="h-3 w-3 text-[#18ac6a]" />
                        </div>
                    </div>

                    {/* Inline Structural Context Labeled Content */}
                    <div className="flex flex-col">
                        <p className="text-[13px] font-bold text-gray-900 tracking-tight leading-none">
                            Community-Powered Protocol
                        </p>
                        <p className="text-[12px] text-gray-500 font-normal tracking-normal mt-0.5">
                            &amp; Discussion Platform
                        </p>
                    </div>

                    {/* ← Always-visible home pill, works on touch & desktop */}
                    <span className="ml-auto inline-flex items-center gap-1 px-2 py-1
                                     bg-[#118451]/7 rounded-full
                                     text-[11px] font-semibold text-[#118451]
                                     whitespace-nowrap flex-shrink-0">
                        <Home className="h-3 w-3 stroke-[2]" />
                        Home
                    </span>

                </div>
            </div>
        </Link>
    );
}