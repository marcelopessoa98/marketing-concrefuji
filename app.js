const PHOTO_MM = { width: 30, height: 40 };
const PAGE_MM = { width: 210, height: 297 };
const LAYOUT_MM = { marginX: 10, marginY: 10, gapX: 2, gapY: 4 };
const MAX_PHOTOS = 36;
const CROP_SIZE = { width: 900, height: 1200 };
const BIRTHDAY_SIZE = { width: 1080, height: 1920 };

const docPhotoInput = document.querySelector("#photoInput");
const dropZone = document.querySelector("#dropZone");
const cropStage = document.querySelector("#cropStage");
const cropCanvas = document.querySelector("#cropCanvas");
const cropContext = cropCanvas.getContext("2d");
const zoomRange = document.querySelector("#zoomRange");
const centerButton = document.querySelector("#centerButton");
const quantityInput = document.querySelector("#quantityInput");
const downloadButton = document.querySelector("#downloadButton");
const sheetPreview = document.querySelector("#sheetPreview");

const birthdayNameInput = document.querySelector("#birthdayNameInput");
const birthdayPhotoInput = document.querySelector("#birthdayPhotoInput");
const birthdayDropZone = document.querySelector("#birthdayDropZone");
const birthdayCanvas = document.querySelector("#birthdayCanvas");
const birthdayContext = birthdayCanvas.getContext("2d");
const birthdayZoomRange = document.querySelector("#birthdayZoomRange");
const birthdayCenterButton = document.querySelector("#birthdayCenterButton");
const birthdayDownloadButton = document.querySelector("#birthdayDownloadButton");
const tabButtons = document.querySelectorAll(".tab-button");
const toolSections = document.querySelectorAll(".tool-section");

let sourceImage = null;
let imageState = {
  scale: 1,
  minScale: 1,
  offsetX: 0,
  offsetY: 0,
};
let dragState = null;
let croppedDataUrl = "";

let birthdayPhoto = null;
let birthdayPhotoState = {
  scale: 1,
  minScale: 1,
  offsetX: 0,
  offsetY: 0,
};
let birthdayDragState = null;
let birthdayAssetsReady = false;

const birthdayAssetSources = {
  background: "assets/birthday/image1.jpeg",
  redBalloons: "assets/birthday/image2.png",
  paleBalloon: "assets/birthday/image3.png",
  shadow: "assets/birthday/image4.png",
  paper: "assets/birthday/image5.png",
  logo: "assets/birthday/image6.png",
  paleBalloonAlt: "assets/birthday/image7.png",
};
const birthdayAssets = {};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function loadImageFile(file, onLoad) {
  if (!file || !file.type.startsWith("image/")) return;

  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => onLoad(image);
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
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

function getCanvasPoint(event, canvas, outputSize) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * outputSize.width,
    y: ((event.clientY - rect.top) / rect.height) * outputSize.height,
  };
}

function beginDrag(event) {
  if (!sourceImage) return;
  const point = getCanvasPoint(event, cropCanvas, CROP_SIZE);
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
  const point = getCanvasPoint(event, cropCanvas, CROP_SIZE);
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

function drawImageCover(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawRotatedImage(ctx, image, x, y, width, height, degrees, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  ctx.restore();
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fitText(ctx, text, maxWidth, startSize, minSize, fontFamily, weight = "400") {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px ${fontFamily}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  } while (size >= minSize);
  return minSize;
}

function drawCenteredText(ctx, text, x, y, maxWidth, startSize, minSize, fontFamily, color, weight = "400") {
  const size = fitText(ctx, text, maxWidth, startSize, minSize, fontFamily, weight);
  ctx.font = `${weight} ${size}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function splitBirthdayName(value) {
  const words = value.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (words.length === 0) return ["Nome", ""];
  if (words.length === 1) return [words[0], ""];
  return [words[0], words.slice(1).join(" ")];
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";

  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });

  if (line) lines.push(line);
  return lines;
}

function resetBirthdayPhotoState() {
  if (!birthdayPhoto) return;

  const frame = { width: 660, height: 660 };
  const minScale = Math.max(frame.width / birthdayPhoto.width, frame.height / birthdayPhoto.height);
  birthdayPhotoState = {
    scale: minScale,
    minScale,
    offsetX: (frame.width - birthdayPhoto.width * minScale) / 2,
    offsetY: (frame.height - birthdayPhoto.height * minScale) / 2,
  };
  birthdayZoomRange.value = "1";
}

function constrainBirthdayPhotoState() {
  if (!birthdayPhoto) return;

  const frame = { width: 660, height: 660 };
  const renderedWidth = birthdayPhoto.width * birthdayPhotoState.scale;
  const renderedHeight = birthdayPhoto.height * birthdayPhotoState.scale;
  const minX = frame.width - renderedWidth;
  const minY = frame.height - renderedHeight;

  birthdayPhotoState.offsetX = renderedWidth <= frame.width ? (frame.width - renderedWidth) / 2 : clamp(birthdayPhotoState.offsetX, minX, 0);
  birthdayPhotoState.offsetY = renderedHeight <= frame.height ? (frame.height - renderedHeight) / 2 : clamp(birthdayPhotoState.offsetY, minY, 0);
}

function drawBirthdayPhotoCard(ctx) {
  const card = { x: 176, y: 306, width: 728, height: 760, angle: -2.8 };
  const photo = { x: 34, y: 34, width: 660, height: 660 };

  ctx.save();
  ctx.translate(card.x + card.width / 2, card.y + card.height / 2);
  ctx.rotate((card.angle * Math.PI) / 180);
  ctx.translate(-card.width / 2, -card.height / 2);

  ctx.drawImage(birthdayAssets.shadow, 34, 654, 662, 115);
  ctx.drawImage(birthdayAssets.paper, 0, 0, card.width, card.width);

  ctx.save();
  roundedRectPath(ctx, photo.x, photo.y, photo.width, photo.height, 4);
  ctx.clip();
  ctx.fillStyle = "#f3f3f0";
  ctx.fillRect(photo.x, photo.y, photo.width, photo.height);

  if (birthdayPhoto) {
    constrainBirthdayPhotoState();
    ctx.drawImage(
      birthdayPhoto,
      photo.x + birthdayPhotoState.offsetX,
      photo.y + birthdayPhotoState.offsetY,
      birthdayPhoto.width * birthdayPhotoState.scale,
      birthdayPhoto.height * birthdayPhotoState.scale,
    );
  } else {
    ctx.fillStyle = "#a9b0bd";
    ctx.font = "800 38px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Foto", photo.x + photo.width / 2, photo.y + photo.height / 2);
  }

  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.86)";
  ctx.lineWidth = 9;
  ctx.strokeRect(photo.x, photo.y, photo.width, photo.height);
  ctx.restore();
}

function drawBirthdayLogo(ctx) {
  ctx.drawImage(birthdayAssets.logo, 68, 1718, 104, 105);
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.font = "900 20px Anton, Impact, Arial Black, sans-serif";
  const concreteWidth = ctx.measureText("CONCRE").width;
  const fujiWidth = ctx.measureText("FUJI").width;
  const totalWidth = concreteWidth + fujiWidth;
  const startX = 120 - totalWidth / 2;
  const y = 1844;

  ctx.fillStyle = "#202020";
  ctx.fillText("CONCRE", startX, y);
  ctx.fillStyle = "#cc0000";
  ctx.fillText("FUJI", startX + concreteWidth, y);
}

function drawBirthdayPost() {
  const ctx = birthdayContext;
  ctx.clearRect(0, 0, BIRTHDAY_SIZE.width, BIRTHDAY_SIZE.height);
  ctx.fillStyle = "#f7f5f0";
  ctx.fillRect(0, 0, BIRTHDAY_SIZE.width, BIRTHDAY_SIZE.height);

  if (!birthdayAssetsReady) {
    ctx.fillStyle = "#657085";
    ctx.font = "800 34px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Carregando modelo...", BIRTHDAY_SIZE.width / 2, BIRTHDAY_SIZE.height / 2);
    return;
  }

  drawImageCover(ctx, birthdayAssets.background, 0, 0, BIRTHDAY_SIZE.width, BIRTHDAY_SIZE.height);
  drawRotatedImage(ctx, birthdayAssets.redBalloons, -116, 180, 426, 898, 3.55);
  drawRotatedImage(ctx, birthdayAssets.redBalloons, 656, -26, 405, 853, 13.72);
  drawRotatedImage(ctx, birthdayAssets.paleBalloonAlt, 50, 94, 270, 660, 11.91);
  drawRotatedImage(ctx, birthdayAssets.paleBalloon, 800, 644, 242, 591, 8.48);
  drawRotatedImage(ctx, birthdayAssets.paleBalloon, -42, 803, 259, 632, -3.06);

  drawBirthdayPhotoCard(ctx);

  const [firstName, lastName] = splitBirthdayName(birthdayNameInput.value);
  const scriptFont = '"Feeling Passionate", "Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive';
  drawCenteredText(ctx, firstName, 540, 1128, 840, 158, 76, scriptFont, "#cc0000");
  if (lastName) {
    drawCenteredText(ctx, lastName, 540, 1278, 880, 198, 88, scriptFont, "#cc0000");
  }

  const message =
    "Que seu dia seja incrível e que todos os seus desejos se realizem. Que sua vida seja repleta de amor, saúde e prosperidade.";
  ctx.font = "700 33px 'Open Sans', Arial, sans-serif";
  ctx.fillStyle = "#cc0000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  wrapText(ctx, message, 760).slice(0, 4).forEach((line, index, lines) => {
    ctx.fillText(line, 540, 1470 + (index - (lines.length - 1) / 2) * 38);
  });

  drawCenteredText(ctx, "FELIZ ANIVERSÁRIO", 540, 1660, 620, 70, 42, "Anton, Impact, Arial Black, sans-serif", "#cc0000", "900");
  drawBirthdayLogo(ctx);
}

function updateBirthdayZoom() {
  if (!birthdayPhoto) return;

  const previousScale = birthdayPhotoState.scale;
  const nextScale = birthdayPhotoState.minScale * Number(birthdayZoomRange.value);
  const centerX = 330;
  const centerY = 330;
  const imagePointX = (centerX - birthdayPhotoState.offsetX) / previousScale;
  const imagePointY = (centerY - birthdayPhotoState.offsetY) / previousScale;

  birthdayPhotoState.scale = nextScale;
  birthdayPhotoState.offsetX = centerX - imagePointX * nextScale;
  birthdayPhotoState.offsetY = centerY - imagePointY * nextScale;
  drawBirthdayPost();
}

function beginBirthdayDrag(event) {
  if (!birthdayPhoto) return;
  const point = getCanvasPoint(event, birthdayCanvas, BIRTHDAY_SIZE);
  birthdayDragState = {
    x: point.x,
    y: point.y,
    offsetX: birthdayPhotoState.offsetX,
    offsetY: birthdayPhotoState.offsetY,
  };
  birthdayCanvas.setPointerCapture?.(event.pointerId);
}

function moveBirthdayDrag(event) {
  if (!birthdayDragState || !birthdayPhoto) return;
  event.preventDefault();
  const point = getCanvasPoint(event, birthdayCanvas, BIRTHDAY_SIZE);
  birthdayPhotoState.offsetX = birthdayDragState.offsetX + point.x - birthdayDragState.x;
  birthdayPhotoState.offsetY = birthdayDragState.offsetY + point.y - birthdayDragState.y;
  drawBirthdayPost();
}

function endBirthdayDrag(event) {
  birthdayDragState = null;
  birthdayCanvas.releasePointerCapture?.(event.pointerId);
}

function downloadBirthdayPng() {
  if (!birthdayPhoto || !birthdayAssetsReady) return;

  const link = document.createElement("a");
  const name = birthdayNameInput.value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "aniversariante";
  link.href = birthdayCanvas.toDataURL("image/png");
  link.download = `post-aniversariante-${name}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function handleToolTabs(event) {
  const button = event.target.closest(".tab-button");
  if (!button) return;

  tabButtons.forEach((item) => item.classList.toggle("is-active", item === button));
  toolSections.forEach((section) => {
    const isActive = section.id === `${button.dataset.tool}Tool`;
    section.classList.toggle("is-active", isActive);
  });
}

function wireDropZone(zone, onFile) {
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("is-over");
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("is-over");
  });

  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("is-over");
    onFile(event.dataTransfer.files[0]);
  });
}

docPhotoInput.addEventListener("change", (event) => {
  loadImageFile(event.target.files[0], (image) => {
    sourceImage = image;
    resetImageState();
    zoomRange.disabled = false;
    centerButton.disabled = false;
    downloadButton.disabled = false;
    drawCrop();
  });
});
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

birthdayPhotoInput.addEventListener("change", (event) => {
  loadImageFile(event.target.files[0], (image) => {
    birthdayPhoto = image;
    resetBirthdayPhotoState();
    birthdayZoomRange.disabled = false;
    birthdayCenterButton.disabled = false;
    birthdayDownloadButton.disabled = false;
    drawBirthdayPost();
  });
});
birthdayNameInput.addEventListener("input", drawBirthdayPost);
birthdayZoomRange.addEventListener("input", updateBirthdayZoom);
birthdayCenterButton.addEventListener("click", () => {
  resetBirthdayPhotoState();
  drawBirthdayPost();
});
birthdayDownloadButton.addEventListener("click", downloadBirthdayPng);
birthdayCanvas.addEventListener("pointerdown", beginBirthdayDrag);
birthdayCanvas.addEventListener("pointermove", moveBirthdayDrag);
birthdayCanvas.addEventListener("pointerup", endBirthdayDrag);
birthdayCanvas.addEventListener("pointercancel", endBirthdayDrag);

document.querySelector(".tool-tabs").addEventListener("click", handleToolTabs);
wireDropZone(dropZone, (file) => {
  loadImageFile(file, (image) => {
    sourceImage = image;
    resetImageState();
    zoomRange.disabled = false;
    centerButton.disabled = false;
    downloadButton.disabled = false;
    drawCrop();
  });
});
wireDropZone(birthdayDropZone, (file) => {
  loadImageFile(file, (image) => {
    birthdayPhoto = image;
    resetBirthdayPhotoState();
    birthdayZoomRange.disabled = false;
    birthdayCenterButton.disabled = false;
    birthdayDownloadButton.disabled = false;
    drawBirthdayPost();
  });
});

Promise.all(Object.entries(birthdayAssetSources).map(([key, src]) => loadImage(src).then((image) => [key, image])))
  .then((entries) => {
    entries.forEach(([key, image]) => {
      birthdayAssets[key] = image;
    });
    birthdayAssetsReady = true;
    drawBirthdayPost();
  })
  .catch(() => {
    birthdayContext.fillStyle = "#cc0000";
    birthdayContext.font = "800 32px system-ui, sans-serif";
    birthdayContext.textAlign = "center";
    birthdayContext.fillText("Não foi possível carregar o modelo.", BIRTHDAY_SIZE.width / 2, BIRTHDAY_SIZE.height / 2);
  });

document.fonts?.ready.then(drawBirthdayPost);

drawCrop();
renderSheetPreview();
drawBirthdayPost();
