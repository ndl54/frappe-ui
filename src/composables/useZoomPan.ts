import { ref, watch, onUnmounted, type Ref } from 'vue'

interface UseZoomPanOptions {
  containerRef: Ref<HTMLElement | null>
  isEnabled: Ref<boolean>
}

interface ZoomAroundPointOptions {
  currentZoom: number
  nextZoom: number
  panPosition: { x: number; y: number }
  cursor: { x: number; y: number }
  container: { left: number; top: number; width: number; height: number }
}

export function calculateZoomAroundPoint({
  currentZoom,
  nextZoom,
  panPosition,
  cursor,
  container,
}: ZoomAroundPointOptions) {
  if (currentZoom <= 0 || nextZoom <= 0) return panPosition

  const currentScale = currentZoom / 100
  const nextScale = nextZoom / 100
  const cursorOffset = {
    x: cursor.x - (container.left + container.width / 2),
    y: cursor.y - (container.top + container.height / 2),
  }

  return {
    x: panPosition.x + cursorOffset.x * (1 / nextScale - 1 / currentScale),
    y: panPosition.y + cursorOffset.y * (1 / nextScale - 1 / currentScale),
  }
}

export function useZoomPan({ containerRef, isEnabled }: UseZoomPanOptions) {
  const zoomLevel = ref(100)
  const panPosition = ref({ x: 0, y: 0 })
  const isMousePanning = ref(false)
  const startMousePanCoords = ref({ x: 0, y: 0 })
  const initialPanPositionOnGestureStart = ref({ x: 0, y: 0 })
  let removeDocumentPanListeners: (() => void) | null = null

  const snapThresholdLower = 90
  const snapThresholdUpper = 110

  watch(zoomLevel, (newZoom, oldZoom) => {
    if (newZoom <= 100 && oldZoom > 100) {
      panPosition.value = { x: 0, y: 0 }
    }
  })

  function zoomIn() {
    zoomLevel.value = Math.min(zoomLevel.value + 25, 300)
  }

  function zoomOut() {
    const newZoom = Math.max(zoomLevel.value - 25, 25)
    if (zoomLevel.value > 100 && newZoom < 100) {
      zoomLevel.value = 100
    } else {
      zoomLevel.value = newZoom
    }
  }

  function resetZoom() {
    zoomLevel.value = 100
    panPosition.value = { x: 0, y: 0 }
    isMousePanning.value = false
    initialPanPositionOnGestureStart.value = { x: 0, y: 0 }
  }

  function handlePanStart(event: MouseEvent) {
    if (zoomLevel.value <= 100) return
    event.preventDefault()
    isMousePanning.value = true
    startMousePanCoords.value = { x: event.clientX, y: event.clientY }
    initialPanPositionOnGestureStart.value = { ...panPosition.value }

    removeDocumentPanListeners?.()

    const handlePanMove = (moveEvent: MouseEvent) => {
      if (!isMousePanning.value) return
      const deltaX = moveEvent.clientX - startMousePanCoords.value.x
      const deltaY = moveEvent.clientY - startMousePanCoords.value.y
      const zoomFactor = zoomLevel.value / 100

      panPosition.value = {
        x: initialPanPositionOnGestureStart.value.x + deltaX / zoomFactor,
        y: initialPanPositionOnGestureStart.value.y + deltaY / zoomFactor,
      }
    }

    const handlePanEnd = () => {
      isMousePanning.value = false
      removeDocumentPanListeners?.()
    }

    removeDocumentPanListeners = () => {
      document.removeEventListener('mousemove', handlePanMove)
      document.removeEventListener('mouseup', handlePanEnd)
      removeDocumentPanListeners = null
    }
    document.addEventListener('mousemove', handlePanMove)
    document.addEventListener('mouseup', handlePanEnd)
  }

  function handleWheel(event: WheelEvent) {
    if (!isEnabled.value) return

    const container = containerRef.value
    if (container?.contains(event.target as Node)) {
      event.preventDefault()

      let dampingFactor = event.ctrlKey ? 0.5 : 0.2

      const zoomChange = -event.deltaY * dampingFactor
      const currentZoom = zoomLevel.value
      const newZoom = Math.round(currentZoom + zoomChange)
      let clampedZoom = Math.max(25, Math.min(300, newZoom))

      if (
        (currentZoom > 100 && clampedZoom < 100) ||
        (currentZoom < 100 && clampedZoom > 100)
      ) {
        if (Math.abs(100 - clampedZoom) < Math.abs(zoomChange) * 1.5) {
          clampedZoom = 100
        }
      }

      if (clampedZoom !== currentZoom) {
        panPosition.value = calculateZoomAroundPoint({
          currentZoom,
          nextZoom: clampedZoom,
          panPosition: panPosition.value,
          cursor: { x: event.clientX, y: event.clientY },
          container: container.getBoundingClientRect(),
        })
        zoomLevel.value = clampedZoom
      }
    }
  }

  watch(
    containerRef,
    (container, previousContainer) => {
      previousContainer?.removeEventListener('wheel', handleWheel, {
        capture: true,
      })
      container?.addEventListener('wheel', handleWheel, {
        passive: false,
        capture: true,
      })
    },
    { immediate: true },
  )

  onUnmounted(() => {
    const container = containerRef.value
    if (container) {
      container.removeEventListener('wheel', handleWheel, { capture: true })
    }
    removeDocumentPanListeners?.()
    isMousePanning.value = false
  })

  return {
    zoomLevel,
    panPosition,
    isMousePanning,
    initialPanPositionOnGestureStart,
    zoomIn,
    zoomOut,
    resetZoom,
    handlePanStart,
    snapThresholdLower,
    snapThresholdUpper,
  }
}
