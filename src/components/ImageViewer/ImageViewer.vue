<template>
  <Teleport :to="portalTarget || 'body'">
    <Transition
      enter-active-class="transition-opacity duration-150 ease-in-out"
      leave-active-class="transition-opacity duration-150 ease-in-out"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
      appear
    >
      <div
        v-if="open && currentImage"
        ref="imageContainer"
        class="fixed inset-0 z-[100] flex touch-none flex-col items-center justify-center overflow-hidden bg-black/70"
        role="dialog"
        aria-modal="true"
        aria-label="Image viewer"
        tabindex="-1"
        @mousemove="handleActivity"
        @touchstart="handleActivity"
        @touchmove="handleActivity"
      >
        <div
          ref="backdropElement"
          class="absolute inset-0 z-0"
          aria-hidden="true"
          @click="close"
        />

        <div class="relative z-10 flex max-h-full max-w-full items-center">
          <img
            :src="currentImage.src"
            :alt="currentImage.alt || 'Image preview'"
            class="block max-h-screen max-w-screen select-none object-contain"
            :style="imageStyle"
            draggable="false"
            @mousedown="handlePanStart"
          />
        </div>

        <div
          v-if="currentImage.alt"
          class="absolute bottom-4 z-10 max-w-[min(90vw,48rem)] rounded-4 bg-surface-gray-7 px-3 py-2 text-center text-sm text-white transition-opacity duration-300"
          :class="{ 'pointer-events-none opacity-0': !isControlsVisible }"
        >
          {{ currentImage.alt }}
        </div>

        <div
          ref="controlsBar"
          class="absolute top-4 z-20 flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-center gap-2 rounded-4 bg-surface-gray-7 p-1.5 shadow-xl transition-opacity duration-300"
          :class="{ 'pointer-events-none opacity-0': !isControlsVisible }"
          @touchstart.stop
          @touchmove.stop
          @touchend.stop
          @mousedown.stop
          @wheel.stop
        >
          <div v-if="images.length > 1" class="flex items-center gap-1">
            <Button
              :icon="LucideChevronLeft"
              label="Previous image"
              tooltip="Previous image"
              variant="ghost"
              class="!text-white hover:!bg-surface-gray-6"
              @click.stop="previousImage"
            />
            <span
              class="min-w-12 select-none text-center text-sm tabular-nums text-white"
              aria-live="polite"
            >
              {{ currentIndex + 1 }}/{{ images.length }}
            </span>
            <Button
              :icon="LucideChevronRight"
              label="Next image"
              tooltip="Next image"
              variant="ghost"
              class="!text-white hover:!bg-surface-gray-6"
              @click.stop="nextImage"
            />
          </div>

          <div class="flex items-center gap-1">
            <Button
              :icon="LucideMinus"
              label="Zoom out"
              tooltip="Zoom out"
              variant="ghost"
              class="!text-white hover:!bg-surface-gray-6"
              @click.stop="zoomOut"
            />
            <Button
              :label="`${zoomLevel}%`"
              tooltip="Reset zoom"
              variant="ghost"
              class="min-w-14 !text-white hover:!bg-surface-gray-6"
              @click.stop="resetZoom"
            />
            <Button
              :icon="LucidePlus"
              label="Zoom in"
              tooltip="Zoom in"
              variant="ghost"
              class="!text-white hover:!bg-surface-gray-6"
              @click.stop="zoomIn"
            />
          </div>

          <div class="flex items-center gap-1">
            <Button
              v-if="downloadable"
              :icon="LucideDownload"
              label="Download image"
              tooltip="Download image"
              variant="ghost"
              class="!text-white hover:!bg-surface-gray-6"
              @click.stop="downloadImage"
            />
            <Button
              :icon="isFullscreen ? LucideMinimize : LucideMaximize"
              :label="isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'"
              :tooltip="isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'"
              variant="ghost"
              class="hidden !text-white hover:!bg-surface-gray-6 sm:inline-flex"
              @click.stop="toggleFullscreen"
            />
            <Button
              :icon="LucideX"
              label="Close image viewer"
              tooltip="Close"
              variant="ghost"
              class="!text-white hover:!bg-surface-gray-6"
              @click.stop="close"
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  toRef,
  useTemplateRef,
  watch,
} from 'vue'
import Button from '../Button/Button.vue'
import { useImageNavigation } from '../../composables/useImageNavigation'
import { useTouchHandler } from '../../composables/useTouchHandler'
import { useZoomPan } from '../../composables/useZoomPan'
import type { ImageViewerImage } from './types'
import { usePortalTarget } from '../../composables/usePortalTarget'
const portalTarget = usePortalTarget()

const LucideChevronLeft = 'lucide-chevron-left'
const LucideChevronRight = 'lucide-chevron-right'
const LucideDownload = 'lucide-download'
const LucideMaximize = 'lucide-maximize'
const LucideMinimize = 'lucide-minimize'
const LucideMinus = 'lucide-minus'
const LucidePlus = 'lucide-plus'
const LucideX = 'lucide-x'

const props = withDefaults(
  defineProps<{
    open: boolean
    images: ImageViewerImage[]
    initialIndex?: number
    downloadable?: boolean
  }>(),
  {
    images: () => [],
    initialIndex: 0,
    downloadable: true,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const imageContainer = useTemplateRef<HTMLElement>('imageContainer')
const backdropElement = useTemplateRef<HTMLElement>('backdropElement')
const controlsBar = useTemplateRef<HTMLElement>('controlsBar')
const isFullscreen = ref(false)
const touchStartZoom = ref(100)
const isControlsVisible = ref(true)
const inactivityTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const inactivityTimeout = 3000
let previousBodyOverflow: string | null = null

const {
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
} = useZoomPan({
  containerRef: imageContainer,
  isEnabled: toRef(props, 'open'),
})

const { currentIndex, nextImage, previousImage } = useImageNavigation({
  initialIndex: toRef(props, 'initialIndex'),
  imageCount: computed(() => props.images.length),
  onNavigate: resetZoom,
})

const currentImage = computed(
  () => props.images[currentIndex.value] || props.images[0] || null,
)
const imageStyle = computed(() => ({
  transform: `scale(${zoomLevel.value / 100}) translate(${panPosition.value.x}px, ${panPosition.value.y}px)`,
  transformOrigin: 'center center',
  cursor:
    zoomLevel.value > 100
      ? isMousePanning.value
        ? 'grabbing'
        : 'grab'
      : 'default',
  transition: isPanning.value
    ? 'none'
    : 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
}))

const {
  isPanning: isTouchPanning,
  isPinching,
  isAnimatingPan,
} = useTouchHandler({
  targetRef: imageContainer,
  zoomLevel,
  panThreshold: 10,
  onSwipeLeft: () => {
    if (zoomLevel.value <= 100) nextImage()
  },
  onSwipeRight: () => {
    if (zoomLevel.value <= 100) previousImage()
  },
  onDoubleTap: (event) => {
    if (controlsBar.value?.contains(event.target as Node)) return
    if (zoomLevel.value > 100) {
      resetZoom()
    } else {
      zoomLevel.value = 200
      panPosition.value = { x: 0, y: 0 }
    }
  },
  onTap: (event) => {
    if (event.target === backdropElement.value) close()
  },
  onPanStart: () => {
    if (zoomLevel.value <= 100) return
    initialPanPositionOnGestureStart.value = { ...panPosition.value }
  },
  onPanMove: (deltaX, deltaY) => {
    if (zoomLevel.value <= 100) return
    panPosition.value = {
      x: initialPanPositionOnGestureStart.value.x + deltaX,
      y: initialPanPositionOnGestureStart.value.y + deltaY,
    }
  },
  onPanAnimate: (deltaX, deltaY) => {
    panPosition.value = {
      x: panPosition.value.x + deltaX,
      y: panPosition.value.y + deltaY,
    }
  },
  onPinchStart: () => {
    touchStartZoom.value = zoomLevel.value
    initialPanPositionOnGestureStart.value = { ...panPosition.value }
  },
  onPinchMove: (scale) => {
    const nextZoom = touchStartZoom.value * scale
    let finalZoom = Math.max(25, Math.min(300, Math.round(nextZoom)))
    if (finalZoom > snapThresholdLower && finalZoom < snapThresholdUpper) {
      finalZoom = 100
    }
    zoomLevel.value = finalZoom
  },
  onPinchEnd: () => {
    if (zoomLevel.value < 100) resetZoom()
    initialPanPositionOnGestureStart.value = { x: 0, y: 0 }
  },
})

const isPanning = computed(
  () =>
    isMousePanning.value ||
    isTouchPanning.value ||
    isPinching.value ||
    isAnimatingPan.value,
)

function showControlsAndResetTimer() {
  isControlsVisible.value = true
  if (inactivityTimer.value) clearTimeout(inactivityTimer.value)
  inactivityTimer.value = setTimeout(() => {
    if (!isPanning.value) {
      isControlsVisible.value = false
    } else {
      showControlsAndResetTimer()
    }
  }, inactivityTimeout)
}

function handleActivity() {
  if (!isPinching.value || !isControlsVisible.value) {
    showControlsAndResetTimer()
  }
}

function close() {
  emit('update:open', false)
  resetZoom()
  clearInactivityTimer()
}

function clearInactivityTimer() {
  if (!inactivityTimer.value) return
  clearTimeout(inactivityTimer.value)
  inactivityTimer.value = null
}

function downloadImage() {
  if (!currentImage.value) return
  const link = document.createElement('a')
  link.href = currentImage.value.src
  const fallbackName =
    currentImage.value.alt?.replace(/[^a-z0-9]/gi, '_').toLowerCase() ||
    currentImage.value.src.split('/').pop() ||
    'download'
  link.download =
    currentImage.value.downloadName ||
    (fallbackName.includes('.') ? fallbackName : `${fallbackName}.jpg`)
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function toggleFullscreen() {
  if (!isFullscreen.value) {
    imageContainer.value?.requestFullscreen?.()
  } else {
    document.exitFullscreen?.()
  }
}

function handleFullscreenChange() {
  isFullscreen.value = Boolean(document.fullscreenElement)
}

function handleKeyDown(event: KeyboardEvent) {
  if (!props.open) return
  handleActivity()
  switch (event.key) {
    case 'ArrowLeft':
      if (!isPanning.value) previousImage()
      break
    case 'ArrowRight':
      if (!isPanning.value) nextImage()
      break
    case '+':
    case '=':
      zoomIn()
      break
    case '-':
      zoomOut()
      break
    case '0':
      resetZoom()
      break
    case 'Escape':
      close()
      break
    case 'f':
    case 'F':
      toggleFullscreen()
      break
    default:
      return
  }
  event.preventDefault()
}

function lockBodyScroll() {
  if (previousBodyOverflow !== null) return
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
}

function unlockBodyScroll() {
  if (previousBodyOverflow === null) return
  document.body.style.overflow = previousBodyOverflow
  previousBodyOverflow = null
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      currentIndex.value = Math.min(
        Math.max(props.initialIndex, 0),
        Math.max(props.images.length - 1, 0),
      )
      resetZoom()
      isControlsVisible.value = true
      showControlsAndResetTimer()
      lockBodyScroll()
      await nextTick()
      imageContainer.value?.focus()
    } else {
      clearInactivityTimer()
      unlockBodyScroll()
      if (isFullscreen.value) document.exitFullscreen?.()
    }
  },
  { immediate: true },
)

onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('keydown', handleKeyDown)
  clearInactivityTimer()
  unlockBodyScroll()
  if (isFullscreen.value) document.exitFullscreen?.()
})
</script>
