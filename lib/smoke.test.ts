import { describe, it, expect } from 'vitest'
import { hello } from './smoke'

describe('smoke', () => {
  it('proves the test runner works', () => {
    expect(hello()).toBe('brocode')
  })
})
