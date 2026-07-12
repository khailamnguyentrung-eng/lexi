import { randomUUID } from "crypto";
import type { CapturePayload, CaptureMetadata, CaptureType, RawImageData } from "./types";

export class CaptureValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaptureValidationError";
  }
}

/**
 * Factory for TEXT_SELECTION captures.
 * Assigns id (UUID) and capturedAt (ISO timestamp) automatically.
 * Throws CaptureValidationError if text is blank.
 */
export function createTextSelectionCapture(
  text: string,
  metadata?: Partial<CaptureMetadata>,
): CapturePayload {
  if (!text || text.trim().length === 0) {
    throw new CaptureValidationError("Text selection cannot be empty");
  }
  return {
    id: randomUUID(),
    type: "TEXT_SELECTION",
    extractedText: text.trim(),
    metadata: {
      capturedAt: new Date().toISOString(),
      sourceApp: "browser",
      ...metadata,
    },
  };
}

/**
 * Factory for image captures (IMAGE_UPLOAD and SCREENSHOT_REGION).
 * Assigns id (UUID) and capturedAt (ISO timestamp) automatically.
 * Throws CaptureValidationError if image data is absent or dimensions are invalid.
 */
export function createImageCapture(
  type: "IMAGE_UPLOAD" | "SCREENSHOT_REGION",
  image: RawImageData,
  mimeType?: "image/png" | "image/jpeg" | "image/webp",
  metadata?: Partial<CaptureMetadata>,
): CapturePayload {
  if (!image.base64 || image.base64.trim().length === 0) {
    throw new CaptureValidationError("Image capture must have non-empty base64 data");
  }
  if (image.widthPx <= 0 || image.heightPx <= 0) {
    throw new CaptureValidationError(
      "Image capture dimensions must be positive (widthPx > 0, heightPx > 0)",
    );
  }
  return {
    id: randomUUID(),
    type,
    image,
    mimeType,
    metadata: {
      capturedAt: new Date().toISOString(),
      sourceApp: "browser",
      ...metadata,
    },
  };
}

const IMAGE_CAPTURE_TYPES: CaptureType[] = [
  "SCREENSHOT_REGION",
  "IMAGE_UPLOAD",
];

/**
 * Validates a CapturePayload is well-formed.
 * Throws CaptureValidationError on the first violation found.
 * Pure — no I/O, no side effects.
 */
export function validateCapturePayload(payload: CapturePayload): void {
  if (!payload.id) {
    throw new CaptureValidationError("CapturePayload.id is required");
  }
  if (!payload.type) {
    throw new CaptureValidationError("CapturePayload.type is required");
  }
  if (!payload.metadata?.capturedAt) {
    throw new CaptureValidationError(
      "CapturePayload.metadata.capturedAt is required",
    );
  }

  if (payload.type === "TEXT_SELECTION") {
    if (!payload.extractedText || payload.extractedText.trim().length === 0) {
      throw new CaptureValidationError(
        "TEXT_SELECTION payload must have non-empty extractedText",
      );
    }
    return;
  }

  if (IMAGE_CAPTURE_TYPES.includes(payload.type)) {
    if (!payload.image) {
      throw new CaptureValidationError(
        `${payload.type} payload must include image data`,
      );
    }
  }
}
