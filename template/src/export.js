import { jsPDF } from 'jspdf'
import { cardToSVG } from './svg.js'

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

function safeName(name) {
  return (name || 'card').replace(/[^\w가-힣 .-]/g, '_').trim() || 'card'
}

export function exportSVG(card) {
  const svg = cardToSVG(card)
  triggerDownload(
    new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
    `${safeName(card.name)}.svg`,
  )
}

// Rasterize a card's SVG to a PNG data URL at `scale`x resolution.
export function cardToPNGDataURL(card, scale = 2) {
  const svg = cardToSVG(card)
  const svgUrl =
    'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(card.width * scale)
      canvas.height = Math.round(card.height * scale)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      try {
        resolve(canvas.toDataURL('image/png'))
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => reject(new Error('SVG rasterization failed'))
    img.src = svgUrl
  })
}

export async function exportPNG(card, scale = 2) {
  const dataUrl = await cardToPNGDataURL(card, scale)
  const blob = await (await fetch(dataUrl)).blob()
  triggerDownload(blob, `${safeName(card.name)}.png`)
}

// One card per PDF page, page size = card pixel size.
export async function exportPDF(cards, filename = 'canvas-studio') {
  if (!cards.length) return
  let pdf
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i]
    const png = await cardToPNGDataURL(c, 2)
    const orientation = c.width >= c.height ? 'landscape' : 'portrait'
    if (i === 0) {
      pdf = new jsPDF({ orientation, unit: 'px', format: [c.width, c.height], hotfixes: ['px_scaling'] })
    } else {
      pdf.addPage([c.width, c.height], orientation)
    }
    pdf.addImage(png, 'PNG', 0, 0, c.width, c.height)
  }
  pdf.save(`${safeName(filename)}.pdf`)
}
