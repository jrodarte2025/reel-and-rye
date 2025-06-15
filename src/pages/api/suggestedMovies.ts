// src/pages/api/suggestedMovies.ts
// Last updated: <today's date> for clean redeploy
import type { NextApiRequest, NextApiResponse } from 'next'

interface MovieSuggestion {
  title: string;
}
interface Suggestions {
  TopPicks: MovieSuggestion[];
  CriticFavorites: MovieSuggestion[];
  lastUpdated: string;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Suggestions>
) {
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

  res.setHeader(
    'Cache-Control',
    'public, s-maxage=86400, stale-while-revalidate=86400'
  );

  res.status(200).json({
    ...suggestions,
    lastUpdated: new Date().toISOString(),
  });
}