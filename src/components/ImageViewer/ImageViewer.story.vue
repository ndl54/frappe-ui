<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '../Button'
import ImageViewer from './ImageViewer.vue'

const open = ref(false)
const images = [
  {
    src: 'https://picsum.photos/id/1025/1200/800',
    alt: 'Landscape image',
  },
  {
    src: 'https://picsum.photos/id/1069/900/1200',
    alt: 'Portrait image',
  },
]
</script>

<template>
  <Story :layout="{ type: 'grid', width: '400px' }">
    <Variant title="Gallery">
      <Button @click="open = true">Open image viewer</Button>
      <ImageViewer v-model:open="open" :images="images" :initial-index="0" />
    </Variant>
  </Story>
</template>
