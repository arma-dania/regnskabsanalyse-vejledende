/**
 * Laver en PNG ud af en graf, så den kan lægges ind i Word-dokumentet.
 * Returnerer null, hvis grafen ikke er tegnet endnu.
 */
export async function svgTilPng (svgEl, skala = 2) {
  if (!svgEl) return null
  const bredde = svgEl.clientWidth || parseFloat(svgEl.getAttribute('width')) || 520
  const hoejde = svgEl.clientHeight || parseFloat(svgEl.getAttribute('height')) || 220

  const klon = svgEl.cloneNode(true)
  klon.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  klon.setAttribute('width', bredde)
  klon.setAttribute('height', hoejde)

  const baggrund = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  baggrund.setAttribute('width', '100%')
  baggrund.setAttribute('height', '100%')
  baggrund.setAttribute('fill', '#ffffff')
  klon.insertBefore(baggrund, klon.firstChild)

  const xml = new XMLSerializer().serializeToString(klon)
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)

  const billede = await new Promise((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = url
  })

  const canvas = document.createElement('canvas')
  canvas.width = bredde * skala
  canvas.height = hoejde * skala
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(billede, 0, 0, canvas.width, canvas.height)

  const dataUrl = canvas.toDataURL('image/png')
  const base64 = dataUrl.split(',')[1]
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  return { bytes, bredde, hoejde }
}

/** Henter alle tegnede grafer fra siden, nøgle = nøgletallets nummer. */
export async function hentAlleGrafer () {
  const ud = {}
  const noder = document.querySelectorAll('[data-graf-nr]')
  for (const node of noder) {
    const nr = parseInt(node.getAttribute('data-graf-nr'), 10)
    const svg = node.querySelector('svg')
    try {
      const png = await svgTilPng(svg)
      if (png) ud[nr] = png
    } catch { /* grafen springes over, hvis den ikke kan tegnes */ }
  }
  return ud
}
