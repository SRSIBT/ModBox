import { onBeforeUnmount, onMounted, watch } from 'vue'

/**
 * 全局天气特效（雨 / 雪）
 * @param {import('vue').Ref<HTMLCanvasElement|null>} canvasRef 画布 ref
 * @param {import('vue').Ref<string>} weatherRef 天气类型 ref：'rain' | 'snow' | 'none'
 */
export function useWeather(canvasRef, weatherRef) {
  let animationFrameId = null
  let particles = []
  let resizeTimer = null

  function startWeather(type) {
    const canvas = canvasRef.value
    if (!canvas) return
    if (animationFrameId) cancelAnimationFrame(animationFrameId)
    particles = []

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const cw = window.innerWidth
    const ch = window.innerHeight

    canvas.width = cw * dpr
    canvas.height = ch * dpr
    // 用 setTransform 而不是 scale：像素比固定，重复调用不会叠加缩放
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    if (type === 'none') {
      ctx.clearRect(0, 0, cw, ch)
      return
    }

    const count = type === 'rain' ? 60 : 120
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * cw,
        y: Math.random() * ch,
        length: type === 'rain' ? Math.random() * 16 + 6 : Math.random() * 2 + 1,
        speedY: type === 'rain' ? Math.random() * 6 + 6 : Math.random() * 1 + 0.5,
        speedX: type === 'rain' ? (Math.random() - 0.5) * 0.5 : Math.random() * 1 - 0.5,
        opacity: Math.random() * 0.5 + 0.3,
        swing: Math.random() * Math.PI * 2
      })
    }

    function animate() {
      ctx.clearRect(0, 0, cw, ch)
      particles.forEach((p) => {
        p.y += p.speedY
        if (type === 'rain') {
          p.x += p.speedX
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(p.x + p.speedX * 5, p.y + p.length)
          ctx.strokeStyle = `rgba(180, 220, 255, ${p.opacity})`
          ctx.lineWidth = 1.2
          ctx.stroke()
        } else {
          p.swing += 0.02
          p.x += Math.sin(p.swing) * 0.5 + p.speedX
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.length, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`
          ctx.fill()
        }
        if (p.y > ch + 20) {
          p.y = -20
          p.x = Math.random() * cw
        }
      })
      animationFrameId = requestAnimationFrame(animate)
    }
    animate()
  }

  // 监听天气变化，实时切换全局特效
  watch(weatherRef, (type) => startWeather(type), { flush: 'post' })

  onMounted(() => startWeather(weatherRef.value))

  // 画布是按窗口尺寸画的，窗口大小变了必须按新尺寸重开，否则雨雪只落在旧范围内
  const onResize = () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => startWeather(weatherRef.value), 150)
  }
  window.addEventListener('resize', onResize)

  onBeforeUnmount(() => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId)
    window.removeEventListener('resize', onResize)
    clearTimeout(resizeTimer)
  })

  return { startWeather }
}
