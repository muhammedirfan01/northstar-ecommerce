import { useEffect, useRef, useState } from "react";
import { ImagePlus, RotateCw, ZoomIn, ZoomOut, X } from "lucide-react";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";

function CropImage({ file, onSave, onClose }) {
  const dialog = useRef(null);
  const image = useRef(null);
  const cropper = useRef(null);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const url = URL.createObjectURL(file);
    dialog.current.showModal();
    image.current.src = url;
    cropper.current = new Cropper(image.current, {
      aspectRatio: 1,
      viewMode: 1,
      autoCropArea: 0.9,
      background: false,
      ready() {
        setReady(true);
      },
    });
    return () => {
      cropper.current.destroy();
      URL.revokeObjectURL(url);
    };
  }, [file]);

  function saveCrop() {
    setSaving(true);
    const canvas = cropper.current.getCroppedCanvas({
      width: 1200,
      height: 1200,
      fillColor: "#fff",
      imageSmoothingQuality: "high",
    });
    if (!canvas) {
      setSaving(false);
      setError("The image could not be opened. Choose another image.");
      return;
    }
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setSaving(false);
          setError("Could not crop this image.");
          return;
        }
        onSave(
          new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, {
            type: "image/webp",
          }),
        );
      },
      "image/webp",
      0.85,
    );
  }

  return (
    <dialog
      ref={dialog}
      className="cm-dialog catalog-crop-dialog"
      aria-labelledby="crop-title"
      onCancel={(event) => {
        event.stopPropagation();
        if (saving) event.preventDefault();
      }}
      onClose={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <h2 id="crop-title">Crop image</h2>
      <p>
        Move or resize the square. The saved image will be resized to 1200 ×
        1200 pixels.
      </p>
      <div className="catalog-crop-area">
        <img ref={image} alt="Image to crop" />
      </div>
      {error && (
        <p className="cm-error" role="alert">
          {error}
        </p>
      )}
      <div className="catalog-crop-tools">
        <button
          type="button"
          className="cm-button"
          aria-label="Zoom in"
          onClick={() => cropper.current.zoom(0.1)}
        >
          <ZoomIn size={18} />
        </button>
        <button
          type="button"
          className="cm-button"
          aria-label="Zoom out"
          onClick={() => cropper.current.zoom(-0.1)}
        >
          <ZoomOut size={18} />
        </button>
        <button
          type="button"
          className="cm-button"
          onClick={() => cropper.current.rotate(90)}
        >
          <RotateCw size={16} /> Rotate
        </button>
      </div>
      <div className="catalog-actions">
        <button
          className="cm-button"
          type="button"
          disabled={saving}
          onClick={onClose}
        >
          Skip image
        </button>
        <button
          className="catalog-primary"
          type="button"
          disabled={saving || !ready}
          onClick={saveCrop}
        >
          {saving ? "Saving…" : "Use cropped image"}
        </button>
      </div>
    </dialog>
  );
}

export default function ImageUploader({
  images,
  onChange,
  max = 6,
  disabled = false,
}) {
  const [queue, setQueue] = useState([]);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const urls = useRef([]);
  useEffect(
    () => () => urls.current.forEach((url) => URL.revokeObjectURL(url)),
    [],
  );

  async function chooseImages(files) {
    setError("");
    if (images.length + files.length > max) {
      setError(`You can add up to ${max} image${max === 1 ? "" : "s"}.`);
      return;
    }
    setChecking(true);
    try {
      for (const file of files) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
          throw new Error(
            "Choose JPG, PNG or WebP images. PDF and other files are not allowed.",
          );
        if (file.size > 5 * 1024 * 1024)
          throw new Error("Each image must be smaller than 5 MB.");
        let bitmap;
        try {
          bitmap = await createImageBitmap(file);
        } catch {
          throw new Error("One of these files is not a readable image.");
        }
        const tooLarge = bitmap.width * bitmap.height > 25_000_000;
        bitmap.close();
        if (tooLarge)
          throw new Error("Choose images smaller than 25 megapixels.");
      }
      setQueue(files);
    } catch (error) {
      setError(error.message);
    } finally {
      setChecking(false);
    }
  }

  function addCropped(file) {
    const url = URL.createObjectURL(file);
    urls.current.push(url);
    onChange([...images, { key: url, url, file }]);
    setQueue(queue.slice(1));
  }

  return (
    <div className="catalog-images">
      <label className="catalog-upload">
        <ImagePlus size={24} />
        <strong>
          {checking ? "Checking images…" : "Choose images to crop and upload"}
        </strong>
        <span>
          JPG, PNG or WebP · 5 MB per image · {images.length}/{max} selected
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple={max > 1}
          disabled={
            disabled || checking || images.length >= max || queue.length > 0
          }
          onChange={(event) => {
            chooseImages(Array.from(event.target.files));
            event.target.value = "";
          }}
        />
      </label>
      {error && (
        <p className="cm-error" role="alert">
          {error}
        </p>
      )}
      <div className="catalog-image-grid">
        {images.map((item, index) => (
          <div className="catalog-image-card" key={item.id || item.key}>
            <img src={item.url} alt={`Selected image ${index + 1}`} />
            <span>{index === 0 ? "Primary image" : `Image ${index + 1}`}</span>
            <button
              className="catalog-image-remove"
              type="button"
              disabled={disabled}
              aria-label={`Remove image ${index + 1}`}
              onClick={() => onChange(images.filter((image) => image !== item))}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
      {queue.length > 0 && (
        <CropImage
          key={queue[0].name + queue.length}
          file={queue[0]}
          onSave={addCropped}
          onClose={() => setQueue(queue.slice(1))}
        />
      )}
    </div>
  );
}
