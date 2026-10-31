import { useEffect, useRef, useState } from "react";
export default function ImageZoom({ image, onClose }) {
  const ref = useRef(null);
  const [zoom, setZoom] = useState(1.5);
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="shop-zoom"
      aria-label="Product image zoom"
      onClose={onClose}
    >
      <div className="shop-zoom-tools">
        <label>
          Zoom
          <input
            type="range"
            min="1"
            max="3"
            step="0.25"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="shop-zoom-scroll">
        <img
          src={image.url}
          alt="Enlarged product"
          style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
        />
      </div>
    </dialog>
  );
}
