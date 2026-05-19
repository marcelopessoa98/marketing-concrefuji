const PHOTO_MM = { width: 30, height: 40 };
const PAGE_MM = { width: 210, height: 297 };
const LAYOUT_MM = { marginX: 10, marginY: 10, gapX: 2, gapY: 4 };
const MAX_PHOTOS = 36;
const CROP_SIZE = { width: 900, height: 1200 };

const input = document.querySelector("#photoInput");
const dropZone = document.querySelector("#dropZone");
const cropStage = document.querySelector("#cropStage");
const cropCanvas = document.querySelector("#cropCanvas");
const cropContext = cropCanvas.getContext("2d");
const zoomRange = document.querySelector("#zoomRange");
const centerButton = document.querySelector("#centerButton");
const quantityInput = document.querySelector("#quantityInput");
const downloadButton = document.querySelector("#downloadButton");
const sheetPreview = document.querySelector("#sheetPreview");

let sourceImage = null;
let imageState = {
  scale: 1,
  minScale: 1,
  offsetX: 0,
  offsetY: 0,
};
let dragState = null;
let croppedDataUrl = "";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getQuantity() {
  return clamp(Number(quantityInput.value) || 1, 1, MAX_PHOTOS);
}

function getLayoutSlots(count) {
  const columns = 6;
  const slots = [];

  for (let index = 0; index < count; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    slots.push({
      x: LAYOUT_MM.marginX + column * (PHOTO_MM.width + LAYOUT_MM.gapX),
      y: LAYOUT_MM.marginY + row * (PHOTO_MM.height + LAYOUT_MM.gapY),
      width: PHOTO_MM.width,
      height: PHOTO_MM.height,
    });
  }

  return slots;
}

function mmToPercentX(mm) {
  return (mm / PAGE_MM.width) * 100;
}

function mmToPercentY(mm) {
  return (mm / PAGE_MM.height) * 100;
}

function renderSheetPreview() {
  const quantity = getQuantity();
  quantityInput.value = quantity;
  sheetPreview.innerHTML = "";

  getLayoutSlots(quantity).forEach((slot) => {
    const item = document.createElement("div");
    item.className = `photo-slot${croppedDataUrl ? "" : " is-empty"}`;
    item.style.left = `${mmToPercentX(slot.x)}%`;
    item.style.top = `${mmToPercentY(slot.y)}%`;
    item.style.width = `${mmToPercentX(slot.width)}%`;

    if (croppedDataUrl) {
      const img = document.createElement("img");
      img.alt = "";
      img.src = croppedDataUrl;
      item.appendChild(img);
    }

    sheetPreview.appendChild(item);
  });
}

function resetImageState() {
  if (!sourceImage) return;

  const scaleX = CROP_SIZE.width / sourceImage.width;
  const scaleY = CROP_SIZE.height / sourceImage.height;
  const minScale = Math.max(scaleX, scaleY);

  imageState = {
    scale: minScale,
    minScale,
    offsetX: (CROP_SIZE.width - sourceImage.width * minScale) / 2,
    offsetY: (CROP_SIZE.height - sourceImage.height * minScale) / 2,
  };

  zoomRange.min = "1";
  zoomRange.max = "3";
  zoomRange.value = "1";
}

function constrainImageState() {
  if (!sourceImage) return;

  const renderedWidth = sourceImage.width * imageState.scale;
  const renderedHeight = sourceImage.height * imageState.scale;
  const minX = CROP_SIZE.width - renderedWidth;
  const minY = CROP_SIZE.height - renderedHeight;

  imageState.offsetX = renderedWidth <= CROP_SIZE.width ? (CROP_SIZE.width - renderedWidth) / 2 : clamp(imageState.offsetX, minX, 0);
  imageState.offsetY = renderedHeight <= CROP_SIZE.height ? (CROP_SIZE.height - renderedHeight) / 2 : clamp(imageState.offsetY, minY, 0);
}

function drawCrop() {
  cropContext.clearRect(0, 0, CROP_SIZE.width, CROP_SIZE.height);
  cropContext.fillStyle = "#ffffff";
  cropContext.fillRect(0, 0, CROP_SIZE.width, CROP_SIZE.height);

  if (!sourceImage) {
    cropContext.fillStyle = "#7b8494";
    cropContext.font = "700 34px system-ui, sans-serif";
    cropContext.textAlign = "center";
    cropContext.fillText("Foto 3x4", CROP_SIZE.width / 2, CROP_SIZE.height / 2);
    return;
  }

  constrainImageState();
  cropContext.imageSmoothingEnabled = true;
  cropContext.imageSmoothingQuality = "high";
  cropContext.drawImage(
    sourceImage,
    imageState.offsetX,
    imageState.offsetY,
    sourceImage.width * imageState.scale,
    sourceImage.height * imageState.scale,
  );

  croppedDataUrl = cropCanvas.toDataURL("image/jpeg", 0.94);
  renderSheetPreview();
}

function loadImageFile(file) {
  if (!file || !file.type.startsWith("image/")) return;

  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      sourceImage = image;
      resetImageState();
      zoomRange.disabled = false;
      centerButton.disabled = false;
      downloadButton.disabled = false;
      drawCrop();
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function getStagePoint(event) {
  const rect = cropCanvas.getBoundingClientRect();
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;

  return {
    x: ((clientX - rect.left) / rect.width) * CROP_SIZE.width,
    y: ((clientY - rect.top) / rect.height) * CROP_SIZE.height,
  };
}

function beginDrag(event) {
  if (!sourceImage) return;
  const point = getStagePoint(event);
  dragState = {
    x: point.x,
    y: point.y,
    offsetX: imageState.offsetX,
    offsetY: imageState.offsetY,
  };
  cropStage.setPointerCapture?.(event.pointerId);
}

function moveDrag(event) {
  if (!dragState || !sourceImage) return;
  event.preventDefault();
  const point = getStagePoint(event);
  imageState.offsetX = dragState.offsetX + point.x - dragState.x;
  imageState.offsetY = dragState.offsetY + point.y - dragState.y;
  drawCrop();
}

function endDrag(event) {
  dragState = null;
  cropStage.releasePointerCapture?.(event.pointerId);
}

function updateZoom() {
  if (!sourceImage) return;

  const previousScale = imageState.scale;
  const zoomFactor = Number(zoomRange.value);
  const nextScale = imageState.minScale * zoomFactor;
  const centerX = CROP_SIZE.width / 2;
  const centerY = CROP_SIZE.height / 2;
  const imagePointX = (centerX - imageState.offsetX) / previousScale;
  const imagePointY = (centerY - imageState.offsetY) / previousScale;

  imageState.scale = nextScale;
  imageState.offsetX = centerX - imagePointX * nextScale;
  imageState.offsetY = centerY - imagePointY * nextScale;
  drawCrop();
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function dataUrlToJpegBytes(dataUrl) {
  return base64ToBytes(dataUrl.split(",")[1]);
}

function pdfText(value) {
  return new TextEncoder().encode(value);
}

function buildPdf(imageBytes) {
  const point = 72 / 25.4;
  const pageWidth = PAGE_MM.width * point;
  const pageHeight = PAGE_MM.height * point;
  const slots = getLayoutSlots(getQuantity());
  const imageObjectId = 4;

  const commands = slots
    .map((slot) => {
      const x = slot.x * point;
      const y = pageHeight - (slot.y + slot.height) * point;
      const width = slot.width * point;
      const height = slot.height * point;
      return `q\n${width.toFixed(3)} 0 0 ${height.toFixed(3)} ${x.toFixed(3)} ${y.toFixed(3)} cm\n/Im1 Do\nQ`;
    })
    .join("\n");

  const contentBytes = pdfText(commands);
  const objects = [
    pdfText("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"),
    pdfText("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"),
    pdfText(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(3)} ${pageHeight.toFixed(3)}] /Resources << /XObject << /Im1 ${imageObjectId} 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
    ),
    [
      pdfText(
        `${imageObjectId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${CROP_SIZE.width} /Height ${CROP_SIZE.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`,
      ),
      imageBytes,
      pdfText("\nendstream\nendobj\n"),
    ],
    [
      pdfText(`5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`),
      contentBytes,
      pdfText("\nendstream\nendobj\n"),
    ],
  ];

  const parts = [pdfText("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")];
  const offsets = [0];
  let position = parts[0].length;

  objects.forEach((objectPart) => {
    offsets.push(position);
    const chunks = Array.isArray(objectPart) ? objectPart : [objectPart];
    chunks.forEach((chunk) => {
      parts.push(chunk);
      position += chunk.length;
    });
  });

  const xrefStart = position;
  const xrefLines = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f "];
  for (let i = 1; i < offsets.length; i += 1) {
    xrefLines.push(`${String(offsets[i]).padStart(10, "0")} 00000 n `);
  }

  parts.push(
    pdfText(
      `${xrefLines.join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`,
    ),
  );

  return new Blob(parts, { type: "application/pdf" });
}

function downloadPdf() {
  if (!croppedDataUrl) return;

  const blob = buildPdf(dataUrlToJpegBytes(croppedDataUrl));
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  link.href = URL.createObjectURL(blob);
  link.download = `fotos-3x4-${date}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

input.addEventListener("change", (event) => loadImageFile(event.target.files[0]));
quantityInput.addEventListener("input", renderSheetPreview);
downloadButton.addEventListener("click", downloadPdf);
zoomRange.addEventListener("input", updateZoom);
centerButton.addEventListener("click", () => {
  resetImageState();
  drawCrop();
});

cropStage.addEventListener("pointerdown", beginDrag);
cropStage.addEventListener("pointermove", moveDrag);
cropStage.addEventListener("pointerup", endDrag);
cropStage.addEventListener("pointercancel", endDrag);

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("is-over");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("is-over");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-over");
  loadImageFile(event.dataTransfer.files[0]);
});

drawCrop();
renderSheetPreview();
