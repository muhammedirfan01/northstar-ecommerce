import { useEffect, useState } from "react";
import "./review-photos.css";

export default function ReviewPhotos({ images = [] }) {
  if (!images.length) return null;
  return (
    <div className="review-photos">
      {images.map((image, index) => (
        <a
          key={image.id}
          href={image.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open review photo ${index + 1}`}
        >
          <img
            src={image.url}
            alt={`Customer review photo ${index + 1}`}
            loading="lazy"
          />
        </a>
      ))}
    </div>
  );
}

function FilePreview({ file, onRemove }) {
  const [url] = useState(() => URL.createObjectURL(file));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <div className="review-photo-preview">
      <img src={url} alt={file.name} />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
      >
        Remove
      </button>
    </div>
  );
}

export function ReviewImageInput({
  images,
  files,
  onImagesChange,
  onFilesChange,
  onError,
  disabled,
}) {
  function choose(event) {
    const selected = [...event.target.files];
    event.target.value = "";
    if (images.length + files.length + selected.length > 3) {
      onError(
        "You can add up to 3 review photos. Remove a photo to add another.",
      );
      return;
    }
    if (
      selected.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp"].includes(file.type),
      )
    ) {
      onError("Choose JPG, PNG or WebP photos only.");
      return;
    }
    if (selected.some((file) => file.size > 5 * 1024 * 1024)) {
      onError("Each review photo must be 5 MB or smaller.");
      return;
    }
    onError("");
    onFilesChange([...files, ...selected]);
  }
  return (
    <fieldset className="review-photo-input" disabled={disabled}>
      <legend>Photos (optional)</legend>
      <p className="shop-help">
        Add up to 3 photos. JPG, PNG or WebP, up to 5 MB each.
      </p>
      <label className="review-photo-upload">
        Add review photos
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={choose}
        />
      </label>
      <div className="review-photo-previews">
        {images.map((image, index) => (
          <div className="review-photo-preview" key={image.id}>
            <img src={image.url} alt={`Saved review photo ${index + 1}`} />
            <button
              type="button"
              aria-label={`Remove saved photo ${index + 1}`}
              onClick={() =>
                onImagesChange(images.filter((item) => item.id !== image.id))
              }
            >
              Remove
            </button>
          </div>
        ))}
        {files.map((file, index) => (
          <FilePreview
            key={`${file.name}-${file.lastModified}-${index}`}
            file={file}
            onRemove={() =>
              onFilesChange(files.filter((_, position) => position !== index))
            }
          />
        ))}
      </div>
    </fieldset>
  );
}
