import React from 'react'

type BourbonRatingProps = {
  rating: number
  label?: string
  className?: string
}

const BourbonGlass: React.FC<{ filled: boolean }> = ({ filled }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className={`w-5 h-5 ${filled ? 'text-bourbon dark:text-leather' : 'text-gray-300 dark:text-gray-600'}`}
    fill="currentColor"
    aria-hidden="true"
  >
    <rect x="4" y="3" width="16" height="2" rx="1" />
    <path d="M6 6h12l-1 10a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3L6 6Z" />
    <rect x="7" y="18" width="10" height="2" rx="1" />
    {filled && <path className="fill-porcelain" d="M8 12h8v4H8z" />}
  </svg>
)

export default function BourbonRating({ rating, label, className }: BourbonRatingProps) {
  const value = Math.max(0, Math.min(5, Math.round(rating)))
  return (
    <div className={`flex items-center space-x-1 ${className ?? ''}`.trim()}>
      {label && <span className="text-sm mr-1">{label}</span>}
      <div className="flex space-x-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <BourbonGlass key={i} filled={i < value} />
        ))}
      </div>
    </div>
  )
}
