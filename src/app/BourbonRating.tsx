'use client'

import { useState } from 'react'
import { db } from '../lib/firebase'
import { doc, updateDoc } from 'firebase/firestore'

interface Props {
  movieId: string
  rating?: number
}

export default function BourbonRating({ movieId, rating = 0 }: Props) {
  const [value, setValue] = useState(rating)

  const handleRate = async (newValue: number) => {
    setValue(newValue)
    try {
      await updateDoc(doc(db, 'movies', movieId), { rating: newValue })
    } catch (err) {
      console.error('Failed to update rating', err)
    }
  }

  return (
    <div className="flex space-x-1" aria-label="Bourbon rating">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          onClick={() => handleRate(i)}
          className={
            i <= value
              ? 'text-bourbon dark:text-leather'
              : 'text-gray-300 dark:text-gray-600'
          }
          aria-label={`${i} bourbon${i === 1 ? '' : 's'}`}
        >
          🥃
        </button>
      ))}
    </div>
  )
}
