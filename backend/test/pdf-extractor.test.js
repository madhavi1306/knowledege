import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { extractPdfPages } from '../src/services/pdf-extractor.js'

test('Node invokes PyMuPDF and removes its temporary extraction output', async () => {
  const storageDir = await mkdtemp(path.join(os.tmpdir(), 'knowflow-pdf-extractor-'))
  const pdfPath = path.join(storageDir, 'study.pdf')
  try {
    const pdf = await PDFDocument.create()
    const page = pdf.addPage()
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    page.drawText('Photosynthesis converts light into chemical energy.', {
      x: 50,
      y: 700,
      size: 12,
      font,
    })
    await writeFile(pdfPath, await pdf.save())

    const result = await extractPdfPages(pdfPath, { storageDir })

    assert.equal(result.pageCount, 1)
    assert.match(result.pages[0].originalText, /Photosynthesis converts light/)
    assert.equal(result.pages[0].pageNumber, 1)
    assert.deepEqual(await readdir(path.join(storageDir, '.tmp')), [])
  } finally {
    await rm(storageDir, { recursive: true, force: true })
  }
})
