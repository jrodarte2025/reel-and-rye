'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { db } from '../lib/firebase'
import { collection, getDocs, addDoc, query, where, updateDoc, doc } from 'firebase/firestore'

function getAngerLevel(runtime: number): number {
  const min = 60
  const max = 160
  const clamped = Math.min(Math.max(runtime, min), max)
  return ((clamped - min) / (max - min)) * 100
}

function getWifeMood(runtime: number): string {
  if (runtime <= 100) return '😊'
  if (runtime <= 120) return '😐'
  return '😠'
}

function getMovieDateTime(movie: { date: string; time: string }) {
  try {
    const [timePart, modifier] = movie.time.split(' ')
    const [rawHour] = timePart.split(':')
    let hour = parseInt(rawHour)
    if (modifier === 'PM' && hour !== 12) hour += 12
    if (modifier === 'AM' && hour === 12) hour = 0
    const formattedHour = hour.toString().padStart(2, '0')
    return new Date(`${movie.date}T${formattedHour}:00:00`)
  } catch {
    return new Date(`${movie.date}T12:00:00`)
  }
}

export default function Home() {
  const [movies, setMovies] = useState<any[]>([])
  const [upcomingMovies, setUpcomingMovies] = useState<any[]>([])
  const [pastMovies, setPastMovies] = useState<any[]>([])
  const [rsvps, setRsvps] = useState<Record<string, any[]>>({})
  const [formData, setFormData] = useState<Record<string, { name: string; email: string; seat: number | null }>>({})
  const [confirmation, setConfirmation] = useState<string>('')
  const confirmationRef = useRef<HTMLDivElement>(null)
  const [showCalendarModal, setShowCalendarModal] = useState(false)
  const [calendarMovie, setCalendarMovie] = useState<any | null>(null)
  const [calendarLinks, setCalendarLinks] = useState<{ google: string; ics: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [recommended, setRecommended] = useState<any[]>([])
  const [voted, setVoted] = useState<string[]>([])
  const scheduledTitles = useMemo(() => new Set(movies.map((m) => m.title)), [movies])

  const handleSearch = async () => {
    if (searchQuery.length < 2) return
    const res = await fetch(`/api/searchMovie?query=${encodeURIComponent(searchQuery)}`)
    const data = await res.json()
    setSearchResults(data)
  }

  const handleRecommend = async (movie: any) => {
    const ref = collection(db, 'recommendedMovies')
    const snapshot = await getDocs(query(ref, where('tmdbId', '==', movie.id)))
    if (snapshot.empty) {
      await addDoc(ref, {
        title: movie.title,
        tmdbId: movie.id,
        votes: 1,
        timestamp: new Date(),
      })
    } else {
      setConfirmation(`${movie.title} has already been recommended!`)
      setTimeout(() => setConfirmation(''), 3000)
      return
    }
    setSearchQuery('')
    setSearchResults([])
    setConfirmation(`${movie.title} was recommended! ✅`)
    setTimeout(() => setConfirmation(''), 3000)
  }

  useEffect(() => {
    const fetchMovies = async () => {
      setMovies([])
      const snapshot = await getDocs(collection(db, 'movies'))
      const data = snapshot.docs.map((doc) => {
        const movie = doc.data() as { date: string; time: string; [key: string]: any }
        return { id: doc.id, ...movie }
      })

      const sorted = data.sort(
        (a, b) => getMovieDateTime(a).getTime() - getMovieDateTime(b).getTime()
      )
      setMovies(sorted)

      const now = new Date()
      setUpcomingMovies(sorted.filter((m) => getMovieDateTime(m) > now))
      setPastMovies(
        sorted
          .filter((m) => getMovieDateTime(m) <= now)
          .sort((a, b) => getMovieDateTime(b).getTime() - getMovieDateTime(a).getTime())
      )
    }
    fetchMovies()
  }, [])

  useEffect(() => {
    if (upcomingMovies.length === 0) return
    const fetchAllRsvps = async () => {
      const result: Record<string, any[]> = {}
      await Promise.all(
        upcomingMovies.map(async (movie) => {
          const q = query(collection(db, 'rsvps'), where('movieId', '==', movie.id))
          const snapshot = await getDocs(q)
          result[movie.id] = snapshot.docs.map((doc) => doc.data())
        })
      )
      setRsvps(result)
    }
    fetchAllRsvps()
  }, [upcomingMovies])

  useEffect(() => {
    if (confirmation.includes("You're in") && confirmationRef.current) {
      confirmationRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [confirmation])

  useEffect(() => {
    const fetchRecommended = async () => {
      const snapshot = await getDocs(collection(db, 'recommendedMovies'))
      const sorted = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => (b.votes || 0) - (a.votes || 0))
      setRecommended(sorted)
    }
    fetchRecommended()
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('votedMovies')
    if (stored) {
      setVoted(JSON.parse(stored))
    }
  }, [])

  const handleRSVP = async (movieId: string, e: React.FormEvent) => {
    e.preventDefault()
    const { name, email, seat } = formData[movieId] || {}
    const reservedSeats = (rsvps[movieId] || []).map((r) => r.seat)

    if (!name || !email || seat === null) {
      setConfirmation('Please complete all fields including seat selection.')
      setTimeout(() => setConfirmation(''), 4000)
      return
    }

    if (reservedSeats.includes(seat)) {
      setConfirmation(`Oops! Seat ${seat} was just taken. Try another one.`)
      setTimeout(() => setConfirmation(''), 4000)
      return
    }

    try {
      await addDoc(collection(db, 'rsvps'), {
        movieId,
        name,
        email,
        seat,
        timestamp: new Date(),
      })

      const selectedMovie = upcomingMovies.find((m) => m.id === movieId)
      if (selectedMovie) {
        console.log('Selected movie for calendar:', selectedMovie)
        if (!selectedMovie.date || !selectedMovie.time) {
          throw new Error("Missing date or time for this movie.")
        }
        // Convert "7 PM" or "7:00 PM" to 24-hour time
        const [rawHour, modifier] = selectedMovie.time.split(' ')
        let hour = parseInt(rawHour)
        if (modifier === 'PM' && hour !== 12) hour += 12
        if (modifier === 'AM' && hour === 12) hour = 0
        const formattedHour = hour.toString().padStart(2, '0')
        
        const startDateTime = new Date(`${selectedMovie.date}T${formattedHour}:00:00`)
        const endDateTime = new Date(startDateTime.getTime() + 3 * 60 * 60 * 1000) // 3 hours

        const formatForCalendar = (date: Date) =>
          date.toISOString().replace(/-|:|\.\d{3}/g, '').slice(0, 15) + 'Z'

        const formattedStart = formatForCalendar(startDateTime)
        const formattedEnd = formatForCalendar(endDateTime)

        const title = `${selectedMovie.title} - Rodarte Reels & Rye`
        const location = "6760 Woodland Reserve Ct. Cincinnati, OH 45243"
        const details = encodeURIComponent("Join us for movies, bourbon, and bonding.")

        const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
          title
        )}&dates=${formattedStart}/${formattedEnd}&details=${details}&location=${encodeURIComponent(
          location
        )}&sf=true&output=xml`

        const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${title}
DTSTART:${formattedStart}
DTEND:${formattedEnd}
DESCRIPTION:Join us for movies, bourbon, and bonding.
LOCATION:${location}
END:VEVENT
END:VCALENDAR`

        const icsBlob = new Blob([icsContent], { type: 'text/calendar' })
        const icsUrl = URL.createObjectURL(icsBlob)

        setCalendarMovie(selectedMovie)
        setCalendarLinks({ google: googleUrl, ics: icsUrl })
        setShowCalendarModal(true)
      }

      setRsvps((prev) => ({
        ...prev,
        [movieId]: [...(prev[movieId] || []), { name, seat }],
      }))
      setFormData((prev) => ({
        ...prev,
        [movieId]: { name: '', email: '', seat: null },
      }))
      setConfirmation(`You're in for ${name}! 🎉`)
      setTimeout(() => setConfirmation(''), 4000)
    } catch (err: any) {
      console.error('RSVP error:', err?.message || err)
      setConfirmation(`Something went wrong: ${err?.message || 'unknown error'}`)
      setTimeout(() => setConfirmation(''), 4000)
    }
  }

  return (
  <main className="min-h-screen px-4 py-8 sm:px-6 md:px-10 bg-porcelain dark:bg-charcoal text-text-primary-light dark:text-text-primary-dark space-y-12">
      <section className="relative w-full min-h-[60vh] px-6 py-20 flex items-center justify-center rounded-3xl overflow-hidden shadow-xl bg-surface-light dark:bg-surface-dark">
        <img
          src="/banner-overlay.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-70 pointer-events-none"
        />
        {/* subtle sparkle / film‑grain overlay */}
        <div className="absolute inset-0 bg-[url('/grain.png')] bg-cover opacity-10 pointer-events-none" />
        <div className="relative z-10 text-center text-white">
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight font-serif mb-4">Reels & Rye</h1>
          <p className="text-lg sm:text-xl text-neutral-300 max-w-md mx-auto">
            Movies. Bourbon. Brotherhood.
          </p>

          {upcomingMovies.length > 0 ? (() => {
            const firstMovie = upcomingMovies[0];
            try {
              const [timePart, modifier] = firstMovie.time.split(' ');
              const hour = parseInt(timePart, 10);
              const adjustedHour = (modifier === 'PM' && hour !== 12)
                ? hour + 12
                : (modifier === 'AM' && hour === 12 ? 0 : hour);
              const formattedHour = adjustedHour.toString().padStart(2, '0');
              const dateObj = new Date(`${firstMovie.date}T${formattedHour}:00:00`);

              const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
              const month = dateObj.toLocaleDateString('en-US', { month: 'long' });
              const day = dateObj.getDate();
              const suffix = (day === 1 || day === 21 || day === 31)
                ? 'st' : (day === 2 || day === 22)
                ? 'nd' : (day === 3 || day === 23)
                ? 'rd' : 'th';

              return (
                <div className="mt-6 bg-white/10 border border-white/10 backdrop-blur-md px-6 py-4 rounded-xl shadow-md inline-block">
                  <p className="text-sm uppercase text-text-secondary-light tracking-wide mb-1">Next Screening</p>
                  <p className="text-lg font-semibold">
                    {weekday}, {month} {day}{suffix} at {firstMovie.time} – <span className="text-amber-300">{firstMovie.title}</span>
                  </p>
                </div>
              );
            } catch {
              return (
                <div className="mt-6 bg-white/10 border border-white/10 backdrop-blur-md px-6 py-4 rounded-xl shadow-md inline-block">
                  <p className="text-sm uppercase text-neutral-300 tracking-wide mb-1">Next Screening</p>
                  <p className="text-lg font-semibold">
                    {firstMovie.date} at {firstMovie.time} – <span className="text-amber-300">{firstMovie.title}</span>
                  </p>
                </div>
              );
            }
          })() : (
            <div className="mt-6 bg-white/10 border border-white/10 backdrop-blur-md px-6 py-4 rounded-xl shadow-md inline-block">
              <p className="text-sm uppercase text-neutral-300 tracking-wide mb-1">No upcoming screenings</p>
            </div>
          )}
        </div>
        <div className="absolute bottom-4 text-xs text-neutral-400 text-center w-full">
          ⬇️ Scroll down to RSVP or recommend a movie
        </div>
      </section>

      <div id="rsvp" className="px-4 py-10 space-y-16">
        <div ref={confirmationRef}></div>

        {confirmation && (
          <div className="fixed top-4 right-4 bg-bourbon text-white px-6 py-3 rounded-lg shadow-lg z-50 transition-all duration-300 dark:bg-leather dark:text-porcelain">
            {confirmation}
          </div>
        )}

        {movies.length === 0 ? (
          <p className="text-center text-gray-400 italic animate-pulse dark:text-gray-500">
            Loading movie magic…
          </p>
        ) : upcomingMovies.length === 0 ? (
          <p className="text-center text-gray-400 italic dark:text-gray-500">
            No upcoming screenings.
          </p>
        ) : (
          upcomingMovies.map((movie) => {
          const reservedSeats = (rsvps[movie.id] || []).map((r) => r.seat)
          const takenSet = new Set([...reservedSeats, 1]) // seat 1 is always host‑occupied
          const allSeatsTaken = [1, 2, 3, 4, 5].every(seat => takenSet.has(seat))
            const angerLevel = getAngerLevel(movie.runtime)

            return (
              <div
                key={movie.id}
                className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-start
           bg-surface-light/80 dark:bg-surface-dark/60 backdrop-blur-sm
           rounded-2xl shadow-xl ring-1 ring-black/5 dark:ring-white/10
           hover:scale-[1.01] hover:shadow-2xl transition"
              >
                <section className="p-6">
                <h2 className="text-3xl font-serif font-bold mb-1 tracking-tight">{movie.title}</h2>
                  <div className="inline-block bg-brass/20 dark:bg-brass/30 text-brass text-sm font-semibold px-3 py-1 rounded-full mb-3">
  🥃 Sip of the Night: {movie.pairing}
</div>
                  {(() => {
                    try {
                      const [timePart, modifier] = movie.time.split(' ')
                      const hour = parseInt(timePart, 10)
                      if (isNaN(hour) || !movie.date || !modifier) throw new Error("Invalid time format")
 
                      const adjustedHour = (modifier === 'PM' && hour !== 12)
                        ? hour + 12
                        : (modifier === 'AM' && hour === 12 ? 0 : hour)
 
                      const formattedHour = adjustedHour.toString().padStart(2, '0')
                      const fullDate = new Date(`${movie.date}T${formattedHour}:00:00`)
 
                      const weekday = fullDate.toLocaleDateString('en-US', { weekday: 'long' })
                      const month = fullDate.toLocaleDateString('en-US', { month: 'long' })
                      const day = fullDate.getDate()
                      const suffix = (day === 1 || day === 21 || day === 31)
                        ? 'st' : (day === 2 || day === 22)
                        ? 'nd' : (day === 3 || day === 23)
                        ? 'rd' : 'th'
 
                      return (
                        <p className="text-gray-500 dark:text-gray-400 mb-2">
                          🗓️ {weekday}, {month} {day}{suffix} at {movie.time}
                        </p>
                      )
                    } catch {
                      return (
                        <p className="text-gray-500 dark:text-gray-400 mb-2">
                          🗓️ {movie.date} at {movie.time}
                        </p>
                      )
                    }
                  })()}
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    className="w-full max-w-[240px] mx-auto rounded shadow mb-4"
                  />
                  <div className="space-y-3">
                    <details className="mb-2">
                    <summary className="cursor-pointer text-sm font-semibold text-brass bg-brass/20 dark:bg-brass/30 px-4 py-2 rounded-md shadow-lg ring-1 ring-bourbon/20 dark:ring-leather/20 hover:bg-brass/30 dark:hover:bg-brass/40 transition">
                        About this Movie
                      </summary>
                      <div className="mt-2 space-y-3">
                      <p className="leading-relaxed text-gray-700 dark:text-gray-300 text-balance">{movie.synopsis}</p>
                        <hr className="border-gray-300 dark:border-gray-600" />
                        <a
                          href={movie.imdb}
                          target="_blank"
                          rel="noopener noreferrer" 
                        className="text-sm text-text-link-light hover:underline pl-1 dark:text-text-link-dark"
                        >
                          🎥 Watch the trailer
                        </a>
                      </div>
                    </details>
                    <p className="text-sm text-gray-500 dark:text-gray-400">🎭 {movie.genre}</p>
                    <p className="text-gray-500 dark:text-gray-400">Runtime: {movie.runtime} min</p>
                  </div>
                  <div className="flex items-center mt-2">
                    <span className="mr-2 text-sm">Angry Wife Meter:</span>
                    <div className="relative w-48 h-2 bg-gray-200 dark:bg-gray-600 rounded-xl overflow-hidden" title="Estimated household tension">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${angerLevel}%`,
                          background: `linear-gradient(to right, #fecaca, #f87171, #b91c1c)`
                        }}
                      ></div>
                    </div>
                    <span className={`ml-2 text-xl ${angerLevel === 100 ? 'animate-pulse' : ''}`}>{getWifeMood(movie.runtime)}</span>
                  </div>
                </section>

                <section className="p-6 md:border-l md:border-gray-200 dark:md:border-gray-700">
                <h3 className="text-lg sm:text-xl font-semibold font-serif mb-4">Reserve Your Seat</h3>
                  {allSeatsTaken ? (
                    <div className="relative">
                      {/* blurred seat grid */}
                      <div className="pointer-events-none opacity-40 blur-sm">
                        {/* the existing seat‑grid JSX will be rendered here */}
                        <div className="grid grid-cols-3 grid-rows-2 sm:grid-cols-5 gap-6 justify-center mb-6 max-w-md mx-auto">
                          {[1, 2, 3, 4, 5].map((seat) => (
                            <div key={seat} className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-300 dark:bg-gray-700 rounded-xl" />
                          ))}
                        </div>
                      </div>
                    
                      {/* frosted overlay */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-white/60 dark:bg-charcoal/60 backdrop-blur-lg rounded-lg ring-1 ring-bourbon/30 dark:ring-leather/30">
                        {/* bourbon glass with splash */}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          className="w-12 h-12 text-bourbon dark:text-leather mb-4 animate-bounce"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <rect x="4" y="3" width="16" height="2" rx="1" />
                          <path d="M6 6h12l-1 10a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3L6 6Z" />
                          <rect x="7" y="18" width="10" height="2" rx="1" />
                          <path className="fill-porcelain" d="M8 12h8v4H8z" /> {/* bourbon liquid */}
                        </svg>
                        <h4 className="text-xl font-semibold mb-1 dark:text-[#DCC99A]">Screening Full</h4>
                        <p className="text-text-secondary-light max-w-xs">
                          This barrel's tapped &nbsp;— check next month!
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 grid-rows-2 sm:grid-cols-5 gap-6 justify-center mb-6 max-w-md mx-auto">
                        {[1, 2, 3, 4, 5].map((seat) => {
                          const isHostSeat = seat === 1
                          const taken = isHostSeat || reservedSeats.includes(seat)
                          const guest = isHostSeat ? "Jim" : rsvps[movie.id]?.find((r) => r.seat === seat)?.name
                          const selected = formData[movie.id]?.seat === seat
                          return (
                            <div key={seat} className="text-center group relative">
                              <button
  disabled={taken}
  title={
    isHostSeat
      ? 'Host seat'
      : taken
      ? `Reserved by ${guest || 'guest'}`
      : `Seat ${seat}`
  }
                                onClick={() => {
                                  setFormData({
                                    [movie.id]: {
                                      ...(formData[movie.id] || { name: '', email: '', seat: null }),
                                      seat,
                                    },
                                  })
                                  setConfirmation(`Seat ${seat} selected!`)
                              setTimeout(() => setConfirmation(''), 2000)
  
                              setTimeout(() => {
                                const input = document.querySelector(`#name-${movie.id}`) as HTMLInputElement | null
                                if (input) {
                                  input.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                  input.focus()
                                }
                              }, 250)
                            }}
                              className={`w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center font-bold text-lg rounded-xl shadow-md hover:scale-105 transform transition duration-200 ease-in-out ${
                                  taken
                                    ? 'bg-gray-300 text-white cursor-not-allowed dark:bg-gray-700'
                              : selected
                                  ? 'bg-bourbon text-porcelain ring-2 ring-offset-2 ring-bourbon/30 animate-pulse'
                                    : 'bg-white hover:bg-amber-100 border border-gray-300 text-black dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:hover:bg-amber-900'
                                }`}
                              >
                              {taken ? (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  className="w-6 h-6 text-amber-700 dark:text-amber-400"
                                  aria-hidden="true"
                                >
                                  {/* rim */}
                                  <rect x="4" y="3" width="16" height="2" rx="1" />
                                  {/* body */}
                                  <path d="M6 6h12l-1 10a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3L6 6Z" />
                                  {/* base */}
                                  <rect x="7" y="18" width="10" height="2" rx="1" />
                                </svg>
                              ) : (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                  className="w-6 h-6"
                                >
                                  <path d="M4 10c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v3H4v-3z" />
                                  <path d="M2 16h20v2H2z" />
                                  <path d="M7 10V8h10v2H7z" />
                                </svg>
                              )}
                              </button>
                              {!taken && (
                                <p className="text-sm mt-2 font-medium text-gray-700 dark:text-gray-300">{seat}</p>
                              )}
                              {taken && guest && (
                                <p className="text-xs text-text-secondary-light text-center mt-1">{guest.split(' ')[0]}</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      <form
  onSubmit={(e) => handleRSVP(movie.id, e)}
  className="space-y-4 mt-4"
>
  <input
    id={`name-${movie.id}`}
    type="text"
    placeholder="Name (select a seat first)"
    value={formData[movie.id]?.name || ''}
    disabled={formData[movie.id]?.seat === null}
    onChange={(e) =>
      setFormData((prev) => ({
        ...prev,
        [movie.id]: {
          ...(prev[movie.id] || { seat: null, email: '' }),
          name: e.target.value,
        },
      }))
    }
    className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md ${
      formData[movie.id]?.seat === null
        ? 'opacity-40 cursor-not-allowed dark:bg-gray-800'
        : 'dark:bg-gray-700'
    }`}
    required
  />
  <input
    type="email"
    placeholder="Email (select a seat first)"
    value={formData[movie.id]?.email || ''}
    disabled={formData[movie.id]?.seat === null}
    onChange={(e) =>
      setFormData((prev) => ({
        ...prev,
        [movie.id]: {
          ...(prev[movie.id] || { seat: null, name: '' }),
          email: e.target.value,
        },
      }))
    }
    className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md ${
      formData[movie.id]?.seat === null
        ? 'opacity-40 cursor-not-allowed dark:bg-gray-800'
        : 'dark:bg-gray-700'
    }`}
    required
  />

  {formData[movie.id]?.seat !== null ? (
    <button
      type="submit"
      disabled={!formData[movie.id]?.name || !formData[movie.id]?.email}
      className={`w-full py-2 rounded-md ring-1 ring-bourbon/30 shadow-md transition
      ${
        !formData[movie.id]?.name || !formData[movie.id]?.email
          ? 'bg-bourbon/50 text-porcelain/70 cursor-not-allowed'
          : 'bg-bourbon text-porcelain hover:bg-bourbon/90 active:scale-95 active:translate-y-[1px] dark:bg-leather dark:text-charcoal dark:hover:bg-leather/90'
      }`}
    >
      🎟️ Save My Spot
    </button>
  ) : (
    <p className="text-sm text-center text-text-secondary-light">
      ▶️ Choose a seat to continue
    </p>
  )}
</form>
                      
                    </>
                  )}
                </section>
              </div>
            )
          })
        )}
      </div>

      {showCalendarModal && calendarMovie && calendarLinks && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowCalendarModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md text-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold">📅 Add to Your Calendar</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Would you like to add <strong>{calendarMovie.title}</strong> to your calendar?
            </p>
            <div className="flex justify-center gap-4">
              <a
                href={calendarLinks.google}
                target="_blank"
                rel="noopener noreferrer"
              className="bg-bourbon text-porcelain px-4 py-2 rounded shadow hover:bg-bourbon/90 active:scale-95 active:translate-y-[1px] transition"
              >
                Google Calendar
              </a>
              <a
                href={calendarLinks.ics}
                download={`${calendarMovie.title}-Rodarte.ics`}
              className="bg-brass/40 text-charcoal px-4 py-2 rounded shadow ring-1 ring-brass/60 hover:bg-brass/50 active:scale-95 active:translate-y-[1px] transition dark:text-porcelain"
              >
                iCalendar / Outlook
              </a>
            </div>
            <button
              onClick={() => setShowCalendarModal(false)}
              className="text-sm text-gray-500 hover:underline mt-2"
            >
              No thanks
            </button>
          </div>
        </div>
      )}
    <section className="max-w-2xl mx-auto py-10 px-6 rounded-xl bg-white/80 dark:bg-gray-800/80 shadow-lg ring-1 ring-black/5 backdrop-blur-sm">
      <h3 className="text-lg font-semibold mb-2 text-center">
        🎬 Not seeing something you like? Recommend our next movie.
      </h3>
      <div className="flex flex-col sm:flex-row gap-2 justify-center items-center mb-4">
        <input
          type="text"
          placeholder="Search for a movie"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800"
        />
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-bourbon text-white rounded-md hover:bg-bourbon/90 dark:bg-leather dark:text-charcoal dark:hover:bg-leather/90"
        >
          Search
        </button>
      </div>
      {searchResults.length > 0 && (
        <ul className="space-y-2 max-w-md mx-auto">
          {searchResults.map((movie: any) => (
            <li
              key={movie.id}
              className="flex items-center gap-4 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg"
            >
              {movie.poster && (
                <img
                  src={movie.poster}
                  alt={`Poster for ${movie.title}`}
                  className="w-10 h-14 object-cover rounded shadow"
                />
              )}
              <div className="flex-1 text-sm text-gray-800 dark:text-white">
                <p className="font-medium">{movie.title}</p>
                <button
                  className="mt-1 text-xs bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-700"
                  onClick={() => handleRecommend(movie)}
                >
                  Recommend
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>

    {recommended.length > 0 && (
        <section className="max-w-2xl mx-auto py-10 px-6 rounded-xl bg-white/80 dark:bg-gray-800/80 shadow-lg ring-1 ring-black/5 backdrop-blur-sm mt-12">
        <h3 className="text-lg font-semibold mb-4 text-center">
          📢 Top Recommended Movies
        </h3>
        <ul className="space-y-2 text-left">
          {recommended.map((movie: any) => (
            <li
              key={movie.id}
              className="flex justify-between items-center bg-white dark:bg-gray-800 px-4 py-2 rounded shadow"
            >
              <span className="text-sm font-medium text-gray-900 dark:text-white">{movie.title}</span>
                {scheduledTitles.has(movie.title) ? (
                  <>
                    <div className="w-20 text-sm text-green-600 font-medium text-center">Scheduled</div>
                    <div className="w-20"></div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-end gap-4 items-center min-w-[120px]">
                      <button
                        onClick={async () => {
                          const ref = doc(db, 'recommendedMovies', movie.id)
                          await updateDoc(ref, { votes: (movie.votes || 0) + 1 })
                          const snapshot = await getDocs(collection(db, 'recommendedMovies'))
                          const sorted = snapshot.docs
                            .map(doc => ({ id: doc.id, ...doc.data() }))
                            .sort((a: any, b: any) => (b.votes || 0) - (a.votes || 0))
                          setRecommended(sorted)
                        }}
                        disabled={voted.includes(movie.id)}
                        title={voted.includes(movie.id) ? "Thanks for voting!" : "Upvote"}
                        className={`transition-opacity duration-300 ${
                          voted.includes(movie.id)
                            ? 'opacity-40 cursor-not-allowed'
                            : 'text-green-600 hover:text-green-800'
                        }`}
                      >
                        👍
                      </button>
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {movie.votes || 0}
                      </span>
                      <button
                        onClick={async () => {
                          const ref = doc(db, 'recommendedMovies', movie.id)
                          await updateDoc(ref, { votes: (movie.votes || 0) - 1 })
                          const updated = recommended.map((m: any) =>
                            m.id === movie.id ? { ...m, votes: (m.votes || 0) - 1 } : m
                          )
                          setRecommended(updated.sort((a, b) => (b.votes || 0) - (a.votes || 0)))
                        }}
                        disabled={voted.includes(movie.id)}
                        title={voted.includes(movie.id) ? "Thanks for voting!" : "Downvote"}
                        className={`transition-opacity duration-300 ${
                          voted.includes(movie.id)
                            ? 'opacity-40 cursor-not-allowed'
                            : 'text-red-600 hover:text-red-800'
                        }`}
                      >
                        👎
                      </button>
                    </div>
                  </>
                )}
            </li>
          ))}
        </ul>
      </section>
    )}
    {pastMovies.length > 0 && (
      <section className="max-w-2xl mx-auto py-10 px-6 rounded-xl bg-white/80 dark:bg-gray-800/80 shadow-lg ring-1 ring-black/5 backdrop-blur-sm mt-12">
        <h3 className="text-lg font-semibold mb-4 text-center">📽️ Past Screenings</h3>
        <ul className="space-y-2 text-left">
          {pastMovies.map((movie) => {
            const dateStr = getMovieDateTime(movie).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })
            return (
              <li
                key={movie.id}
                className="flex justify-between items-center bg-white dark:bg-gray-800 px-4 py-2 rounded shadow"
              >
                <span className="font-medium">{movie.title}</span>
                <div className="flex gap-4 items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-300">{dateStr}</span>
                  {movie.rating && <span className="text-sm">⭐ {movie.rating}</span>}
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    )}
  </main>
  )
}