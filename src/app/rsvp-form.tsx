'use client'

import { useState } from 'react'
import { db } from '../lib/firebase'
import { collection, addDoc } from 'firebase/firestore'

export default function RSVPForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('idle')

    try {
      const rsvpRef = collection(db, 'rsvps')
      await addDoc(rsvpRef, {
        name,
        email,
        timestamp: new Date(),
      })
      setStatus('success')
      setName('')
      setEmail('')
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <h2 className="text-xl font-bold">Reserve Your Seat</h2>
      <input
        className="w-full border border-gray-300 px-4 py-2 rounded"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        type="email"
        className="w-full border border-gray-300 px-4 py-2 rounded"
        placeholder="Your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <button
        type="submit"
        className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
      >
        RSVP
      </button>
      {status === 'success' && (
        <p className="text-green-600">You're in! See you at the movie.</p>
      )}
      {status === 'error' && (
        <p className="text-red-600">Something went wrong. Try again.</p>
      )}
    </form>
  )
}