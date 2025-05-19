// src/pages/api/suggestedMovies.ts
import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const suggestions = {
    TopPicks: [
      { title: 'Inception' },
      { title: 'The Dark Knight' },
      { title: 'Heat' },
    ],
    CriticFavorites: [
      { title: 'The Godfather' },
      { title: 'No Country for Old Men' },
    ]
  }

  res.status(200).json(suggestions)
}