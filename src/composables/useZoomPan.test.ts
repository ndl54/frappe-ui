import { describe, expect, it } from 'vitest'
import { calculateZoomAroundPoint } from './useZoomPan'

describe('calculateZoomAroundPoint', () => {
  const container = { left: 100, top: 50, width: 800, height: 600 }

  it('keeps the center fixed', () => {
    expect(
      calculateZoomAroundPoint({
        currentZoom: 100,
        nextZoom: 200,
        panPosition: { x: 0, y: 0 },
        cursor: { x: 500, y: 350 },
        container,
      }),
    ).toEqual({ x: 0, y: 0 })
  })

  it('adjusts pan so an off-center cursor remains anchored', () => {
    expect(
      calculateZoomAroundPoint({
        currentZoom: 100,
        nextZoom: 200,
        panPosition: { x: 0, y: 0 },
        cursor: { x: 700, y: 250 },
        container,
      }),
    ).toEqual({ x: -100, y: 50 })
  })

  it('preserves an existing pan while zooming out', () => {
    expect(
      calculateZoomAroundPoint({
        currentZoom: 200,
        nextZoom: 100,
        panPosition: { x: -100, y: 50 },
        cursor: { x: 700, y: 250 },
        container,
      }),
    ).toEqual({ x: 0, y: 0 })
  })
})
