import { useState } from "react";

const ZOOM = 2.5;

export default function ProductImageMagnifier({
  image,
  productName,
  onEnlarge,
}) {
  const [position, setPosition] = useState(null);

  function magnify(event) {
    // Touch screens use the full-image view instead of a hover lens.
    if (
      event.pointerType !== "mouse" ||
      !window.matchMedia(
        "(min-width: 901px) and (hover: hover) and (pointer: fine)",
      ).matches
    )
      return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const lensWidth = bounds.width / ZOOM;
    const lensHeight = bounds.height / ZOOM;
    // Keep the lens inside the image, even when the cursor reaches an edge.
    const left = Math.max(
      0,
      Math.min(
        event.clientX - bounds.left - lensWidth / 2,
        bounds.width - lensWidth,
      ),
    );
    const top = Math.max(
      0,
      Math.min(
        event.clientY - bounds.top - lensHeight / 2,
        bounds.height - lensHeight,
      ),
    );
    setPosition({ left, top, height: bounds.height });
  }

  return (
    <div className="pd-magnifier">
      <button
        type="button"
        className="pd-main-image"
        aria-label="Zoom product image"
        onClick={onEnlarge}
        onBlur={() => setPosition(null)}
      >
        <span
          className="pd-image-stage"
          onPointerMove={magnify}
          onPointerLeave={() => setPosition(null)}
        >
          <img src={image.url} alt={productName} draggable="false" />
          {position && (
            <span
              className="pd-magnifier-lens"
              aria-hidden="true"
              style={{
                left: position.left,
                top: position.top,
                width: `${100 / ZOOM}%`,
                height: `${100 / ZOOM}%`,
              }}
            />
          )}
        </span>
        <span className="pd-zoom-hint">
          <span className="pd-hover-hint">Move over the image to magnify</span>
          <span className="pd-touch-hint">
            Tap or click the image to enlarge
          </span>
        </span>
      </button>
      {position && (
        <div
          className="pd-magnifier-preview"
          aria-hidden="true"
          style={{ height: position.height }}
        >
          <img
            src={image.url}
            alt=""
            draggable="false"
            style={{
              width: `${ZOOM * 100}%`,
              height: `${ZOOM * 100}%`,
              left: -position.left * ZOOM,
              top: -position.top * ZOOM,
            }}
          />
        </div>
      )}
    </div>
  );
}
