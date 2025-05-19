'use client'

import { useEffect, useState } from 'react'
import { db } from '../../lib/firebase'
import { collection, getDocs } from 'firebase/firestore'
import { formatScreeningDate } from '../../lib/formatScreeningDate'

interface Movie {
  id: string
  title: string
  date: string
  time: string
}

export default function PastScreeningsPage() {
  const [movies, setMovies] = useState<Movie[]>([])

  useEffect(() => {
    const fetchMovies = async () => {
      const snapshot = await getDocs(collection(db, 'movies'))
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }))
      const now = new Date()
      const past = data.filter(movie => {
        try {
          const [timePart, modifier] = movie.time.split(' ')
          const [rawHour] = timePart.split(':')
          let hour = parseInt(rawHour, 10)
          if (modifier === 'PM' && hour !== 12) hour += 12
          if (modifier === 'AM' && hour === 12) hour = 0
          const dateObj = new Date(`${movie.date}T${hour.toString().padStart(2, '0')}:00:00`)
          return dateObj <= now
        } catch {
          return false
        }
      })
      past.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      setMovies(past)
    }
    fetchMovies()
  }, [])

  return (
    <main className="min-h-screen px-4 py-8 bg-porcelain dark:bg-charcoal text-text-primary-light dark:text-text-primary-dark space-y-6">
      <h1 className="text-3xl font-serif font-bold mb-4">Past Screenings</h1>
      {movies.length === 0 ? (
        <p className="text-center text-gray-500">No past screenings found.</p>
      ) : (
        <ul className="space-y-4">
          {movies.map(movie => (
            <li key={movie.id} className="p-4 rounded-lg bg-surface-light dark:bg-surface-dark shadow">
              <h2 className="font-semibold">{movie.title}</h2>
              <p className="subtext">{formatScreeningDate(movie)}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
