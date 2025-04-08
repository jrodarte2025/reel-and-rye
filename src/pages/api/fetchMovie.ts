import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const title = req.query.title as string
  const apiKey = process.env.TMDB_API_KEY

  if (!title) {
    return res.status(400).json({ error: 'Missing title' })
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'Missing TMDB API key' })
  }

  try {
    console.log("Fetching TMDB search for:", title)

    const searchRes = await fetch(
      `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(title)}&api_key=${apiKey}`
    )
    const searchData = await searchRes.json()
    console.log("TMDB search results:", searchData)

    const match = searchData.results?.[0]

    if (!match) {
      console.warn("No movie match found in TMDB search.")
      return res.status(404).json({ error: 'Movie not found' })
    }

    const detailRes = await fetch(
      `https://api.themoviedb.org/3/movie/${match.id}?api_key=${apiKey}`
    )
    const detail = await detailRes.json()
    console.log("TMDB movie details:", detail)

    res.status(200).json({
      poster: detail.poster_path
        ? `https://image.tmdb.org/t/p/w500${detail.poster_path}`
        : null,
      synopsis: detail.overview,
      genre: Array.isArray(detail.genres)
        ? detail.genres.map((g: any) => g.name).join(', ')
        : 'N/A',
      runtime: detail.runtime,
      imdb: `https://www.imdb.com/title/${detail.imdb_id}`,
    })
  } catch (error) {
    console.error('fetchMovie error:', error)
    res.status(500).json({ error: 'Failed to fetch movie info' })
  }
}