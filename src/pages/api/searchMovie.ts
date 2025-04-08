// src/pages/api/searchMovie.ts

import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const query = req.query.query as string

  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' })
  }

  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'TMDB API key not set' })
  }

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}&api_key=${apiKey}`
    )
    const data = await response.json()

    if (!data.results) {
      return res.status(500).json({ error: 'Failed to fetch TMDB results' })
    }

    const topResults = data.results.slice(0, 5).map((movie: any) => ({
      id: movie.id,
      title: movie.title,
      poster: movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : null,
    }))

    res.status(200).json(topResults)
  } catch (error) {
    console.error('TMDB search error:', error)
    res.status(500).json({ error: 'Search failed' })
  }
}