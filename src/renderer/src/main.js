import { createApp } from 'vue'
import { createPinia } from 'pinia'
import axios from 'axios'
import App from './App.vue'

// 打包后页面是 file://，接口必须走本地 Express，不能用 file:///api
if (window.location.protocol === 'file:') {
  axios.defaults.baseURL = 'http://localhost:3000'
}

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
