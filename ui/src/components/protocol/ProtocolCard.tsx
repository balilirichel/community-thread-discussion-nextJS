import React from 'react';
import { useRouter } from 'next/router';
import {  Star, BookOpen } from 'lucide-react';
import Avatar from '../ui/Avatar';

interface ProtocolCardProps {
  id: number;
  title: string;
  description: string;
  author: string;
  category: string;
  rating: number;
  reviews: number;
  comments: number;
  upvotes: number;
  steps: number;
  gradientIndex?: number;
  slug: string;
  createdAt?: string;
}

const gradients = [
  'from-[#118451] via-[#18ac6a] to-emerald-300',
  'from-[#065c38] via-[#118451] to-teal-400',
  'from-emerald-700 via-[#18ac6a] to-lime-300',
  'from-[#118451] via-teal-500 to-cyan-400',
  'from-[#065c38] via-emerald-600 to-emerald-300',
  'from-teal-700 via-[#118451] to-emerald-300',
];

const ProtocolCard: React.FC<ProtocolCardProps> = ({
  id,
  title,
  description,
  author,
  category,
  rating,
  reviews,
  //comments,
  // upvotes,
  steps,
  gradientIndex = 0,
  slug,
}) => {
  const router = useRouter();
  const gradient = gradients[gradientIndex % gradients.length];

  return (
    <article
      id={`protocol-card-${id}`}
      onClick={() => router.push(`/protocols/${slug}`)}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden group"
    >
      {/* Gradient Hero Header */}
      <div className={`relative h-28 bg-gradient-to-br ${gradient} p-4 flex flex-col justify-between overflow-hidden`}>
        {/* Decorative blobs */}
        <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
        <div className="absolute -right-2 bottom-2 w-16 h-16 rounded-full bg-white/5" />

        <div className="relative z-10 flex items-start justify-between">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[2rem] bg-white/20 backdrop-blur-sm text-white text-xs font-semibold">
            {category}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[2rem] bg-white/20 backdrop-blur-sm text-white text-xs">
            <BookOpen size={11} strokeWidth={2} />
            {steps} tags
          </span>
        </div>

        <div className="relative z-10">
          <h3 className="text-white font-bold text-base leading-tight line-clamp-2 group-hover:text-white/90 transition-colors">
            {title}
          </h3>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4">
        <p className="text-gray-500 text-sm leading-relaxed line-clamp-2 mb-3">
          {description}
        </p>

        {/* Author row */}
        <div className="flex items-center gap-2 mb-3">
          <Avatar name={author} size="xs" />
          <span className="text-xs text-gray-500 font-medium truncate">{author}</span>
        </div>

        {/* Metrics row */}
        <div className="flex items-center gap-3 pt-3 border-t border-gray-50">
          {/* Rating chip */}
          <div className="flex items-center gap-1 text-amber-500">
            <Star size={13} fill="#f59e0b" strokeWidth={0} />
            <span className="text-xs font-bold text-gray-700 tabular-nums">{rating}</span>
            <span className="text-xs text-gray-400 tabular-nums">({reviews})</span>
          </div>

          {/* <div className="w-px h-3 bg-gray-200" /> */}

          {/* Comments chip */}
          {/* <div className="flex items-center gap-1 text-gray-400">
            <MessageSquare size={13} />
            <span className="text-xs font-medium text-gray-600 tabular-nums">{comments}</span>
          </div> */}

          {/* <div className="w-px h-3 bg-gray-200" /> */}

       
        </div>
      </div>
    </article>
  );
};

export default ProtocolCard;
