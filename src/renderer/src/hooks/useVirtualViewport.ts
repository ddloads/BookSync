import { RefObject, useEffect, useState } from 'react'

interface VirtualViewportOptions {
  overscanPx?: number
}

interface VirtualViewportState {
  scrollTop: number
  viewportHeight: number
}

export function useVirtualViewport(
  scrollContainerRef: RefObject<HTMLElement | null>,
  options: VirtualViewportOptions = {}
): VirtualViewportState {
  const { overscanPx = 0 } = options
  const [state, setState] = useState<VirtualViewportState>({ scrollTop: 0, viewportHeight: 0 })

  useEffect(() => {
    const element = scrollContainerRef.current
    if (!element) return

    let frameId: number | null = null

    const update = () => {
      frameId = null
      setState({
        scrollTop: Math.max(0, element.scrollTop - overscanPx),
        viewportHeight: element.clientHeight + overscanPx * 2
      })
    }

    const scheduleUpdate = () => {
      if (frameId !== null) return
      frameId = window.requestAnimationFrame(update)
    }

    update()

    element.addEventListener('scroll', scheduleUpdate, { passive: true })
    const resizeObserver = new ResizeObserver(scheduleUpdate)
    resizeObserver.observe(element)

    return () => {
      element.removeEventListener('scroll', scheduleUpdate)
      resizeObserver.disconnect()
      if (frameId !== null) window.cancelAnimationFrame(frameId)
    }
  }, [overscanPx, scrollContainerRef])

  return state
}
