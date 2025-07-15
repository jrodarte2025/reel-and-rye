import React from 'react'

interface BourbonRatingProps {
  value: number
  onChange?: (value: number) => void
}

const BourbonGlass = ({ filled }: { filled: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className={`w-6 h-6 ${filled ? 'text-bourbon dark:text-leather' : 'text-gray-400'}`}
    fill="currentColor"
    aria-hidden="true"
  >
    <rect x="4" y="3" width="16" height="2" rx="1" />
    <path d="M6 6h12l-1 10a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3L6 6Z" />
    <rect x="7" y="18" width="10" height="2" rx="1" />
    {filled && <path className="fill-current" d="M8 12h8v4H8z" />}
  </svg>
)

export default function BourbonRating({ value, onChange }: BourbonRatingProps) {
  const stars = [1, 2, 3, 4, 5]
  return (
    <div className="flex space-x-1">
      {stars.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          className="focus:outline-none"
        >
          <BourbonGlass filled={n <= value} />
        </button>
      ))}
    </div>
  )
}
