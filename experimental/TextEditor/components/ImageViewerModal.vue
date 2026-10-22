<template>
  <ImageViewer
    :open="show"
    :images="images"
    :initial-index="initialIndex"
    @update:open="emit('update:show', $event)"
  />
</template>

<script setup lang="ts">
import ImageViewer from '../../../src/components/ImageViewer/ImageViewer.vue'
import type { ImageViewerImage } from '../../../src/components/ImageViewer/types'

withDefaults(
  defineProps<{
    show: boolean
    images: ImageViewerImage[]
    initialIndex?: number
  }>(),
  {
    images: () => [],
    initialIndex: 0,
  },
)

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()
</script>
