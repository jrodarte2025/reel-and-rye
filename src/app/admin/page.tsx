'use client'

import { useEffect, useState } from 'react'
import { db } from '../../lib/firebase'
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where
} from 'firebase/firestore'

type Movie = {
  id: string
  title: string
  date: string
  time: string
  pairing?: string
  [key: string]: any
}

export default function AdminPage() {
  console.log('🔧 AdminPage loaded');
  const [passwordEntered, setPasswordEntered] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [pairing, setPairing] = useState('')
  const [preview, setPreview] = useState<any>(null)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [upcomingMovies, setUpcomingMovies] = useState<Movie[]>([])
  const [watchedMovies, setWatchedMovies] = useState<Movie[]>([])
  const [suggestedMovies, setSuggestedMovies] = useState<Record<string, any[]>>({})
  const [pairingUpdateStatus, setPairingUpdateStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({})
  const [rsvps, setRsvps] = useState<Record<string, any[]>>({})
  const [confirmRemove, setConfirmRemove] = useState<{ movieId: string; seat: number } | null>(null)
  const [recommendedMovies, setRecommendedMovies] = useState<any[]>([])
  const [editingMovieId, setEditingMovieId] = useState<string | null>(null)
  const [editSearchResults, setEditSearchResults] = useState<any[]>([])
  const [justUpdatedId, setJustUpdatedId] = useState<string | null>(null)
  const [addGuestForms, setAddGuestForms] = useState<Record<string, { name: string; email: string; seat: number | null }>>({})
  const [addGuestStatus, setAddGuestStatus] = useState<Record<string, 'idle' | 'adding' | 'success' | 'error'>>({})
  
  const fetchRecommendedMovies = async () => {
    const snapshot = await getDocs(collection(db, 'recommendedMovies'))
    const sorted = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => (b.votes || 0) - (a.votes || 0))
    setRecommendedMovies(sorted)
  }

  const getMovieDateTime = (movie: { date: string; time: string }) => {
    try {
      const [timePart, modifier] = movie.time.split(' ')
      const [rawHour] = timePart.split(':')
      let hour = parseInt(rawHour)
      if (modifier === 'PM' && hour !== 12) hour += 12
      if (modifier === 'AM' && hour === 12) hour = 0
      const formattedHour = hour.toString().padStart(2, '0')
      return new Date(`${movie.date}T${formattedHour}:00:00`)
    } catch {
      return new Date(`${movie.date}T12:00:00`) // Default to noon if parsing fails
    }
  }
  
  // Build Google Calendar & ICS links for a movie
  const getCalendarLinks = (movie: Movie) => {
    const start = getMovieDateTime(movie)
    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000) // 3‑hour duration
    const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, '')
    const dates = `${fmt(start)}/${fmt(end)}`
    const text = encodeURIComponent(movie.title)
    const details = encodeURIComponent('Reels & Rye – Movie Night')
    const location = encodeURIComponent('6760 Woodland Reserve Ct. Cincinnati, OH 45243')
  
    return `https://www.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`
  }
  
  const fetchAllMovies = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'movies'))
      const data: Movie[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Movie))
      const now = new Date()
      const upcoming = data.filter(movie => getMovieDateTime(movie) > now)
      const watched = data.filter(movie => getMovieDateTime(movie) <= now)
      setUpcomingMovies(upcoming)
      setWatchedMovies(watched)
  
      const rsvpMap: Record<string, any[]> = {}
      for (const movie of data) {
        const q = query(collection(db, 'rsvps'), where('movieId', '==', movie.id))
        const snapshot = await getDocs(q)
        rsvpMap[movie.id] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      }
      setRsvps(rsvpMap)
    } catch (err) {
      console.error('Failed to fetch movie data:', err)
    }
  }

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const res = await fetch('/api/suggestedMovies')
        const data = await res.json()
        setSuggestedMovies(data)
      } catch (err) {
        console.error('Failed to fetch suggestions:', err)
      }
    }

    fetchAllMovies()
    fetchSuggestions()
    fetchRecommendedMovies()
  }, [])

  useEffect(() => {
    if (title.length < 2) return setSearchResults([])
    const delay = setTimeout(async () => {
      const res = await fetch(`/api/searchMovie?query=${encodeURIComponent(title)}`)
      const data = await res.json()
      setSearchResults(data)
    }, 400)
    return () => clearTimeout(delay)
  }, [title])
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordInput === 'salud') {
      setPasswordEntered(true)
    } else {
      alert('Incorrect password')
    }
  }
  const handleSelectSearch = async (movie: any) => {
    setTitle(movie.title)
      
    try {
      const res = await fetch(`/api/fetchMovie?title=${encodeURIComponent(movie.title)}`)
      const data = await res.json()
      setPreview({
        ...movie,
        ...data,
      })
    } catch (err) {
      console.error('Failed to fetch movie metadata:', err)
    }
  }
  const handleAddMovie = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !date || !time) return alert('Title, Date, and Time are required')
    setStatus('loading')

    try {
      const tmdbData = await fetch(`/api/fetchMovie?title=${encodeURIComponent(title)}`).then(res => res.json())
      const { poster, synopsis, genre, runtime, imdb } = tmdbData

      const calendarRes = await fetch('/api/addToCalendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          date,
          time,
          pairing,
          runtime,
          imdb,
          mode: 'create',
        }),
      })
      const calendarData = await calendarRes.json()

      await addDoc(collection(db, 'movies'), {
        title,
        date,
        time,
        pairing,
        poster,
        synopsis,
        genre,
        runtime,
        imdb,
        calendarEventId: calendarData.eventId || null,
        createdAt: new Date(),
      })

      setTitle('')
      setDate('')
      setTime('')
      setPairing('')
      setPreview(null)
      setSearchResults([])
      setStatus('success')
      await fetchAllMovies() // 👈 Add this line
      // setTimeout(() => setStatus('idle'), 3000)
    } catch (error) {
      console.error('Error adding movie:', error)
      setStatus('error')
    }
  }

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'movies', id))
    await fetchAllMovies()
  }

  const handleEdit = async (id: string, newDate: string, newTime: string) => {
    const ref = doc(db, 'movies', id)
    await updateDoc(ref, { date: newDate, time: newTime })
    // Refresh the list from Firestore
    await fetchAllMovies()
    // Optionally highlight the updated item
    setJustUpdatedId(id)
    setTimeout(() => setJustUpdatedId(null), 3000)
  }

  const handleEditSearch = async (query: string) => {
    const res = await fetch(`/api/searchMovie?query=${encodeURIComponent(query)}`)
    const data = await res.json()
    setEditSearchResults(data)
  }

  const handleRemoveRsvp = async (movieId: string, seat: number) => {
    const match = rsvps[movieId]?.find(r => r.seat === seat)
    console.log('🔍 RSVP removal triggered:', { movieId, seat, match })

    if (match && match.id) {
      try {
        console.log('🗑️ Deleting RSVP with ID:', match.id)
        await deleteDoc(doc(db, 'rsvps', match.id))
        setRsvps(prev => ({
          ...prev,
          [movieId]: prev[movieId].filter(r => r.id !== match.id),
        }))
        setConfirmRemove(null)
      } catch (err) {
        console.error('❌ Error deleting RSVP:', err)
      }
    } else {
      console.warn('⚠️ No valid RSVP match found for removal', { movieId, seat })
    }
  }

  const handleAddGuest = async (movieId: string) => {
    const formData = addGuestForms[movieId]

    if (!formData?.name || !formData?.email || !formData?.seat) {
      alert('Please fill in all fields')
      return
    }

    // Check if seat is already taken
    const seatTaken = rsvps[movieId]?.find(r => r.seat === formData.seat)
    if (seatTaken) {
      alert('This seat is already taken')
      return
    }

    setAddGuestStatus(prev => ({ ...prev, [movieId]: 'adding' }))

    try {
      // Add RSVP to Firebase with email field
      await addDoc(collection(db, 'rsvps'), {
        movieId,
        seat: formData.seat,
        name: formData.name,
        email: formData.email,
        createdAt: new Date()
      })

      // Refresh RSVPs
      await fetchAllMovies()

      // Clear form and show success
      setAddGuestForms(prev => ({ ...prev, [movieId]: { name: '', email: '', seat: null } }))
      setAddGuestStatus(prev => ({ ...prev, [movieId]: 'success' }))
      setTimeout(() => setAddGuestStatus(prev => ({ ...prev, [movieId]: 'idle' })), 3000)
    } catch (err) {
      console.error('Failed to add guest:', err)
      setAddGuestStatus(prev => ({ ...prev, [movieId]: 'error' }))
    }
  }

  const getNotifyEmailLink = (movie: Movie, guest: { name: string; email: string; seat: number }) => {
    const subject = `Your seat for ${movie.title} - Reels & Rye`
    const body = `Hey ${guest.name},

I just grabbed your seat for the upcoming showing of ${movie.title} on ${movie.date} at ${movie.time}. You can reserve your own seat for future shows here: https://reelsandrye.netlify.app

Sign up and grab a spot at future shows - see you soon!

Cheers,

Jim`

    return `mailto:${guest.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  if (!passwordEntered) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-900 px-4">
        <div className="bg-white/30 backdrop-blur-md border border-white/40 shadow-xl rounded-2xl p-8 w-full max-w-sm dark:bg-gray-800/50">
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <h1 className="text-2xl font-semibold text-center text-black dark:text-white">🔒 Admin Login</h1>
            <input
              type="password"
              placeholder="Enter password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:ring-2 focus:ring-black focus:outline-none transition"
            />
            <button className="w-full bg-black text-white py-2 rounded-md hover:bg-gray-800 transition dark:bg-white dark:text-black dark:hover:bg-gray-200">
              Enter
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 md:px-10 bg-white dark:bg-gray-900 text-black dark:text-white space-y-12">
      {/* Add Movie Section */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md space-y-4">
          <h2 className="text-2xl font-bold">🎬 Add Movie Night</h2>
          <form onSubmit={handleAddMovie} className="space-y-4">
            <input
              type="text"
              placeholder="Movie Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              required
            />
            {searchResults.length > 0 && (
  <ul className="bg-white dark:bg-gray-800 border rounded shadow max-h-48 overflow-auto">
    {searchResults.map((movie) => (
      <li
        key={movie.id}
        onClick={() => handleSelectSearch(movie)}
        className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
      >
        {movie.title}
      </li>
    ))}
  </ul>
)}
            <input
              type="text"
              placeholder="🥃 Sip of the Night"
              value={pairing}
              onChange={(e) => setPairing(e.target.value)}
              className="w-full px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              required
            />
            <select
  value={time}
  onChange={(e) => setTime(e.target.value)}
  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded-md"
  required
>
  <option value="">Select Time</option>
  {['5 PM', '6 PM', '7 PM', '8 PM', '9 PM', '10 PM'].map((label) => (
    <option key={label} value={label}>{label}</option>
  ))}
</select>
            <button type="submit" className="w-full bg-black text-white py-2 rounded-md hover:bg-gray-900 dark:bg-white dark:text-black dark:hover:bg-gray-200">
              Add Movie
            </button>
            {status === 'loading' && <p className="text-gray-500 dark:text-gray-400 animate-pulse">Adding movie...</p>}
            {status === 'success' && <p className="text-green-600">✅ Movie added successfully!</p>}
            {status === 'error' && <p className="text-red-600">❌ Something went wrong.</p>}
          </form>
        </div>
        {preview && (
  <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md space-y-3">
    <h4 className="text-xl font-semibold">🎞️ Preview</h4>
    <img src={preview.poster} alt={preview.title} className="w-40 rounded mb-4" />
    <p className="text-sm text-gray-700 dark:text-gray-300">
      <strong>Synopsis:</strong> {preview.synopsis || preview.overview || 'N/A'}
    </p>
    <p className="text-sm text-gray-700 dark:text-gray-300">
      <strong>Genre:</strong> {preview.genre || preview.genres || 'N/A'}
    </p>
    <p className="text-sm text-gray-700 dark:text-gray-300">
      <strong>Runtime:</strong> {preview.runtime ? `${preview.runtime} minutes` : 'N/A'}
    </p>
    <p className="text-sm">
      <a href={preview.imdb} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
        View on IMDB →
      </a>
    </p>
  </div>
)}
      </div>

      {/* Upcoming Movies + Seat Management */}
      <div className="space-y-10">
      {[...upcomingMovies]
  .sort((a, b) => getMovieDateTime(a).getTime() - getMovieDateTime(b).getTime())
  .map((movie) => (
          <div
            key={movie.id}
            className={`rounded-2xl p-6 shadow-md space-y-4 transition duration-500 ${
              justUpdatedId === movie.id
                ? 'bg-green-100 dark:bg-green-900 border border-green-400'
                : 'bg-white dark:bg-gray-800'
            }`}
          >
            <div className="flex flex-col md:flex-row justify-between gap-4 md:items-center">
              <div>
                <h3 className="text-lg font-semibold">{movie.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">🥃 {movie.pairing || 'No pairing listed'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="date"
                  value={movie.date}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setUpcomingMovies(prev =>
                      prev.map(m => m.id === movie.id ? { ...m, date: newDate } : m)
                    );
                  }}
                  className="border px-2 py-1 rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                />
                <select
                  value={movie.time}
                  onChange={(e) => {
                    const newTime = e.target.value;
                    setUpcomingMovies(prev =>
                      prev.map(m => m.id === movie.id ? { ...m, time: newTime } : m)
                    );
                  }}
                  className="border px-2 py-1 rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                >
                  {[...Array(10)].map((_, i) => {
                    const hour = i + 12
                    const label = hour <= 12 ? `${hour} PM` : `${hour - 12} PM`
                    return <option key={hour} value={label}>{label}</option>
                  })}
                </select>
                <button
                  onClick={async () => {
                    await handleEdit(movie.id, movie.date, movie.time);
                  }}
                  className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                >
                  Save Date/Time
                </button>
                <input
                  type="text"
                  placeholder="Edit pairing"
                  value={movie.pairing || ''}
                  onChange={(e) => {
                    const updated = upcomingMovies.map(m =>
                      m.id === movie.id ? { ...m, pairing: e.target.value } : m
                    )
                    setUpcomingMovies(updated)
                    setPairingUpdateStatus(prev => ({ ...prev, [movie.id]: 'idle' }))
                  }}
                  className="text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded px-2 py-1"
                />
                <button
                  onClick={async () => {
                    setPairingUpdateStatus(prev => ({ ...prev, [movie.id]: 'saving' }))
                    const ref = doc(db, 'movies', movie.id)
                    const latestMovie = upcomingMovies.find(m => m.id === movie.id)
                    await updateDoc(ref, { pairing: latestMovie?.pairing || '' })
                    setPairingUpdateStatus(prev => ({ ...prev, [movie.id]: 'saved' }))
                    setTimeout(() => {
                      setPairingUpdateStatus(prev => ({ ...prev, [movie.id]: 'idle' }))
                    }, 3000)
                  }}
                  className="text-sm bg-black text-white px-3 py-1 rounded hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                >
                  Save
                </button>
                <button onClick={() => handleDelete(movie.id)} className="text-red-600 text-sm hover:underline">
                  Delete
                </button>
                <button
                  onClick={() => window.open(getCalendarLinks(movie), '_blank', 'noopener,noreferrer')}
                  className="text-sm bg-amber-700 text-white px-3 py-1 rounded hover:bg-amber-800 dark:bg-amber-500 dark:hover:bg-amber-600"
                  title="Add to Google Calendar"
                >
                  Add&nbsp;to&nbsp;Calendar
                </button>
                <button
                  onClick={() => setEditingMovieId(movie.id)}
                  className="text-sm bg-slate-600 text-white px-3 py-1 rounded hover:bg-slate-700"
                >
                  Change Movie
                </button>
              </div>
              {editingMovieId === movie.id && (
                <div className="mt-4 space-y-2">
                  <input
                    type="text"
                    placeholder="Search for a new movie..."
                    onChange={(e) => handleEditSearch(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                  />
                  {editSearchResults.length > 0 && (
                    <ul className="space-y-2 bg-white dark:bg-gray-700 rounded shadow max-h-48 overflow-auto px-2 py-1">
                      {editSearchResults.map((result) => (
                        <li
                          key={result.id}
                          className="cursor-pointer px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                          onClick={async () => {
                            const tmdb = await fetch(`/api/fetchMovie?title=${encodeURIComponent(result.title)}`).then(res => res.json())
                            const ref = doc(db, 'movies', movie.id)
                            await updateDoc(ref, {
                              title: result.title,
                              poster: tmdb.poster,
                              synopsis: tmdb.synopsis,
                              genre: tmdb.genre,
                              runtime: tmdb.runtime,
                              imdb: tmdb.imdb,
                            })
                            await fetchAllMovies()
                            setEditingMovieId(null)
                            setEditSearchResults([])
                          }}
                        >
                          {result.title}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* RSVP Seats */}
            <div className="flex gap-3 mt-3">
              {[1, 2, 3, 4, 5].map((seat) => {
                const guest = rsvps[movie.id]?.find(r => r.seat === seat)
                const isTaken = !!guest
                const isConfirming = confirmRemove?.movieId === movie.id && confirmRemove.seat === seat

                return (
                  <div key={seat} className="text-center group relative">
                    <button
                      disabled={!isTaken}
                      onClick={() => guest && setConfirmRemove({ movieId: movie.id, seat })}
                      className={`w-12 h-12 sm:w-14 sm:h-14 text-sm sm:text-base rounded-lg flex items-center justify-center font-semibold transition
                        ${isTaken
                          ? isConfirming
                            ? 'bg-red-700 text-white'
                            : 'bg-gray-800 text-white group-hover:bg-red-600'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-default'
                        }`}
                      title={isTaken ? `Seat ${seat} - ${guest.name}` : `Seat ${seat} (Available)`}
                    >
                      {isTaken ? (isConfirming ? '❌' : guest.name.split(' ')[0]) : seat}
                    </button>

                    {/* Notify Button */}
                    {isTaken && guest?.email && (
                      <a
                        href={getNotifyEmailLink(movie, { name: guest.name, email: guest.email, seat })}
                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mt-1 block"
                        title="Send email notification"
                      >
                        📧
                      </a>
                    )}

                    {isConfirming && guest && (
                      <div className="absolute top-16 left-1/2 -translate-x-1/2 w-52 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm rounded shadow-md z-10">
                        <p className="mb-2 text-center">
                          Remove <strong>{guest.name}</strong> from Seat {seat}?
                        </p>
                        <div className="flex justify-center gap-2">
                          <button
                            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                            onClick={() => handleRemoveRsvp(movie.id, seat)}
                          >
                            Confirm
                          </button>
                          <button
                            className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-700"
                            onClick={() => setConfirmRemove(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Add Guest Form */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 mt-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Add Guest to Seat</h4>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  placeholder="Guest Name"
                  value={addGuestForms[movie.id]?.name || ''}
                  onChange={(e) => setAddGuestForms(prev => ({
                    ...prev,
                    [movie.id]: { ...prev[movie.id], name: e.target.value, email: prev[movie.id]?.email || '', seat: prev[movie.id]?.seat || null }
                  }))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm"
                />

                <input
                  type="email"
                  placeholder="Guest Email"
                  value={addGuestForms[movie.id]?.email || ''}
                  onChange={(e) => setAddGuestForms(prev => ({
                    ...prev,
                    [movie.id]: { ...prev[movie.id], email: e.target.value, name: prev[movie.id]?.name || '', seat: prev[movie.id]?.seat || null }
                  }))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm"
                />

                <select
                  value={addGuestForms[movie.id]?.seat || ''}
                  onChange={(e) => setAddGuestForms(prev => ({
                    ...prev,
                    [movie.id]: { ...prev[movie.id], seat: e.target.value ? parseInt(e.target.value) : null, name: prev[movie.id]?.name || '', email: prev[movie.id]?.email || '' }
                  }))}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm"
                >
                  <option value="">Select Seat</option>
                  {[1, 2, 3, 4, 5].map(seatNum => {
                    const isTaken = rsvps[movie.id]?.find(r => r.seat === seatNum)
                    if (isTaken) return null
                    return <option key={seatNum} value={seatNum}>Seat {seatNum}</option>
                  })}
                </select>

                <button
                  onClick={() => handleAddGuest(movie.id)}
                  disabled={addGuestStatus[movie.id] === 'adding'}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium"
                >
                  {addGuestStatus[movie.id] === 'adding' ? 'Adding...' : 'Add Guest'}
                </button>
              </div>

              {addGuestStatus[movie.id] === 'success' && (
                <p className="text-green-600 text-sm">✅ Guest added successfully!</p>
              )}
              {addGuestStatus[movie.id] === 'error' && (
                <p className="text-red-600 text-sm">❌ Failed to add guest</p>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow space-y-4">
        <h2 className="text-xl font-semibold">User Recommended Movies</h2>
        {recommendedMovies.length === 0 ? (
          <p className="text-gray-400">No recommended movies yet.</p>
        ) : (
          <ul className="space-y-3">
            {recommendedMovies.map((movie) => (
              <li key={movie.id} className="flex justify-between items-center gap-2">
                <div className="flex-1">
                  <span className="font-medium">{movie.title}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">👍 {movie.votes || 0}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setTitle(movie.title)
                      const res = await fetch(`/api/fetchMovie?title=${encodeURIComponent(movie.title)}`)
                      const data = await res.json()
                      setPreview({
                        ...movie,
                        ...data,
                      })
                      await deleteDoc(doc(db, 'recommendedMovies', movie.id))
                      setRecommendedMovies(prev => prev.filter(m => m.id !== movie.id))
                    }}
                    className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                  >
                    Schedule
                  </button>
                  <button
                    onClick={async () => {
                      await deleteDoc(doc(db, 'recommendedMovies', movie.id))
                      setRecommendedMovies(prev => prev.filter(m => m.id !== movie.id))
                    }}
                    className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
// Trigger redeploy - restoring April 18 commit (10cb965a)