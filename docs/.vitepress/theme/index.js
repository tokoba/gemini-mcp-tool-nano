import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout,
  setup() {
    // Force dark mode on initial load
    if (typeof window !== 'undefined' && !localStorage.getItem('vitepress-theme-appearance')) {
      localStorage.setItem('vitepress-theme-appearance', 'dark')
    }
  }
}