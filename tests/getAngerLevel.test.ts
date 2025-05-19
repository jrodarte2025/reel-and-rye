import { describe, it, expect } from 'vitest'
import { getAngerLevel } from '../src/app/page'

describe('getAngerLevel', () => {
  it('returns 0 for runtime below 60', () => {
    expect(getAngerLevel(50)).toBe(0)
  })

  it('returns scaled percentage for runtime between 60 and 160', () => {
    expect(getAngerLevel(110)).toBeCloseTo(50)
  })

  it('returns 100 for runtime above 160', () => {
    expect(getAngerLevel(200)).toBe(100)
  })
})
